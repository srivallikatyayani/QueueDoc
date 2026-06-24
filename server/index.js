import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connectDB } from './db.js';
import Token from './models/Token.js';
import ClinicConfig from './models/ClinicConfig.js';
import AuditLog from './models/AuditLog.js';
import getNextToken from './utils/getNextToken.js';
import { calculateEffectiveAvg } from './waitTimeAlgo.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const debouncedClients = new Set();

const getCurrentDay = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function logEvent(type, tokenNum, desc) {
  try {
    await AuditLog.create({
      event_type: type,
      token_number: tokenNum,
      description: desc,
      clinic_day: getCurrentDay()
    });
    // Broadcast new logs so receptionist can see them live
    const logs = await AuditLog.find({ clinic_day: getCurrentDay() }).sort({ timestamp: -1 }).limit(50);
    io.emit('audit:update', logs);
  } catch (err) {
    console.error("Failed to log event:", err);
  }
}

async function getFullState() {
  const currentDay = getCurrentDay();
  
  let tokens = await Token.find({ clinic_day: currentDay }).lean();
  
  tokens.sort((a, b) => {
    // Priority status sorting
    const statusOrder = { 'in_consultation': 1, 'waiting': 2, 'holding': 3, 'called': 4 };
    const aStatus = statusOrder[a.status] || 5;
    const bStatus = statusOrder[b.status] || 5;
    if (aStatus !== bStatus) return aStatus - bStatus;
    
    // Urgent first for waiting/holding
    const aPriority = (a.priority === 'urgent' && ['waiting', 'holding'].includes(a.status)) ? 1 : 2;
    const bPriority = (b.priority === 'urgent' && ['waiting', 'holding'].includes(b.status)) ? 1 : 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    return a.token_number - b.token_number;
  });

  tokens = tokens.map(t => ({ ...t, id: t._id.toString() }));

  const config = await ClinicConfig.findById('config').lean();
  const manualSeed = config ? config.avg_consultation_seconds : 300;
  const globalDelay = config && config.global_delay_seconds ? config.global_delay_seconds : 0;
  
  const completed = tokens.filter(t => t.status === 'done' && t.called_at && t.completed_at)
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
    .map(t => ({
      duration_seconds: (new Date(t.completed_at).getTime() - new Date(t.called_at).getTime()) / 1000
    }));

  const { effectiveAvgSeconds, sampleCount } = calculateEffectiveAvg(completed, manualSeed);
  
  const currentToken = tokens.find(t => t.status === 'in_consultation' || t.status === 'called') || null;
  
  return {
    currentToken,
    queue: tokens,
    effectiveAvgSeconds,
    sampleCount,
    globalDelay,
    lastUpdated: new Date().toISOString()
  };
}

async function broadcastUpdate() {
  const state = await getFullState();
  io.emit('queue:update', state);
}

// Timeout storage to clear auto-no-shows if patient arrives
const timeouts = {};

io.on('connection', async (socket) => {
  const state = await getFullState();
  socket.emit('queue:full_state', state);

  // Send initial logs to new client
  const logs = await AuditLog.find({ clinic_day: getCurrentDay() }).sort({ timestamp: -1 }).limit(50);
  socket.emit('audit:update', logs);

  const withDebounce = (eventName, handler) => {
    return async (...args) => {
      const key = `${socket.id}-${eventName}`;
      if (debouncedClients.has(key)) return;
      debouncedClients.add(key);
      setTimeout(() => debouncedClients.delete(key), 600);
      try {
        await handler(...args);
      } catch (err) {
        console.error(`Error in ${eventName}:`, err);
      }
    };
  };

  socket.on('patient:add', withDebounce('patient:add', async (data) => {
    const next_num = await getNextToken();
    await Token.create({
      token_number: next_num,
      name: data.name || `Walk-in #${next_num}`,
      phone: data.phone || null,
      priority: data.priority || 'normal',
      status: 'waiting',
      clinic_day: getCurrentDay(),
      created_at: new Date()
    });
    
    await logEvent('add', next_num, `Added ${data.priority === 'urgent' ? 'urgent ' : ''}patient to queue`);
    socket.emit('patient:added', { token_number: next_num });
    await broadcastUpdate();
  }));

  socket.on('queue:callNext', withDebounce('queue:callNext', async () => {
    const currentDay = getCurrentDay();
    const active = await Token.findOne({ clinic_day: currentDay, status: { $in: ['in_consultation', 'called'] } });
    if (active) return; 
    
    const nextToken = await Token.findOne({ clinic_day: currentDay, status: 'waiting' })
      .sort({ priority: -1, token_number: 1 });
      
    if (nextToken) {
      // True DB-Level Atomic Lock: Only updates if status is still 'waiting'
      const updated = await Token.findOneAndUpdate(
        { _id: nextToken._id, status: 'waiting' },
        { $set: { status: 'called', called_at: new Date() } },
        { new: true }
      );
      
      if (!updated) return; // Another server instance grabbed it!
      
      await logEvent('call', nextToken.token_number, `Called patient to consultation room`);
      
      // Auto-No-Show Timeout (2 mins = 120000ms)
      const timeoutId = setTimeout(async () => {
        const checkToken = await Token.findById(nextToken._id);
        if (checkToken && checkToken.status === 'called') {
          await Token.findByIdAndUpdate(nextToken._id, { status: 'no_show' });
          await logEvent('auto_skip', nextToken.token_number, `Auto-skipped due to no-show timeout (2m)`);
          await broadcastUpdate();
        }
      }, 120000);
      timeouts[nextToken._id.toString()] = timeoutId;

      // Check if holding patients need auto-reinsert
      const waitingCount = await Token.countDocuments({ clinic_day: currentDay, status: 'waiting' });
      if (waitingCount <= 3) {
        // Find holding patients that were created before the 3rd person in line
        const holdingPatients = await Token.find({ clinic_day: currentDay, status: 'holding' });
        for (const hp of holdingPatients) {
          await Token.findByIdAndUpdate(hp._id, { status: 'waiting' });
          await logEvent('unhold', hp.token_number, `Auto-reinserted patient from hold (nearing turn)`);
        }
      }

      await broadcastUpdate();
    }
  }));

  const clearAutoSkip = (idStr) => {
    if (timeouts[idStr]) {
      clearTimeout(timeouts[idStr]);
      delete timeouts[idStr];
    }
  };

  socket.on('patient:markDone', withDebounce('patient:markDone', async (data) => {
    clearAutoSkip(data.id);
    const t = await Token.findByIdAndUpdate(data.id, { 
      status: 'done', 
      completed_at: new Date() 
    });
    if (t) await logEvent('done', t.token_number, `Consultation completed`);
    await broadcastUpdate();
  }));

  socket.on('patient:noShow', withDebounce('patient:noShow', async (data) => {
    clearAutoSkip(data.id);
    const t = await Token.findByIdAndUpdate(data.id, { status: 'no_show' });
    if (t) await logEvent('no_show', t.token_number, `Patient marked as no-show manually`);
    await broadcastUpdate();
  }));

  socket.on('patient:cancel', withDebounce('patient:cancel', async (data) => {
    clearAutoSkip(data.id);
    const t = await Token.findByIdAndUpdate(data.id, { status: 'cancelled' });
    if (t) await logEvent('cancel', t.token_number, `Token cancelled`);
    await broadcastUpdate();
  }));

  socket.on('patient:hold', withDebounce('patient:hold', async (data) => {
    const t = await Token.findByIdAndUpdate(data.id, { status: 'holding' });
    if (t) await logEvent('hold', t.token_number, `Patient stepped out (placed on hold)`);
    await broadcastUpdate();
  }));

  socket.on('patient:unhold', withDebounce('patient:unhold', async (data) => {
    const t = await Token.findByIdAndUpdate(data.id, { status: 'waiting' });
    if (t) await logEvent('unhold', t.token_number, `Patient returned from hold`);
    await broadcastUpdate();
  }));

  socket.on('config:addDelay', withDebounce('config:addDelay', async (data) => {
    // Add 15 mins (900 seconds)
    const config = await ClinicConfig.findById('config');
    const newDelay = (config ? config.global_delay_seconds || 0 : 0) + 900;
    
    await ClinicConfig.findByIdAndUpdate('config', { 
      global_delay_seconds: newDelay 
    }, { upsert: true });
    
    await logEvent('delay', null, `Doctor delayed by 15 minutes. Total delay: ${newDelay/60}m`);
    await broadcastUpdate();
  }));
});

const publicPath = path.join(__dirname, '../dist');
app.use(express.static(publicPath));

app.use((req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
