import { useState, useEffect, useRef } from 'react';
import { socket } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Search, Clock, AlertCircle, Volume2, AlertTriangle, Activity } from 'lucide-react';

export default function Display() {
  const [queue, setQueue] = useState([]);
  const [currentToken, setCurrentToken] = useState(null);
  const [effectiveAvg, setEffectiveAvg] = useState(300);
  const [sampleCount, setSampleCount] = useState(0);
  const [globalDelay, setGlobalDelay] = useState(0);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevTokenRef = useRef(null);
  
  const [searchToken, setSearchToken] = useState('');
  
  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    
    const handleStateUpdate = (state) => {
      setQueue(state.queue);
      setCurrentToken(state.currentToken);
      setEffectiveAvg(state.effectiveAvgSeconds);
      setSampleCount(state.sampleCount);
      setGlobalDelay(state.globalDelay || 0);
      setLastUpdated(Date.now());
    };

    socket.on('queue:full_state', handleStateUpdate);
    socket.on('queue:update', handleStateUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('queue:full_state');
      socket.off('queue:update');
    };
  }, []);

  // Voice Announcement
  useEffect(() => {
    if (currentToken && currentToken.status === 'called') {
      if (prevTokenRef.current !== currentToken.token_number) {
        prevTokenRef.current = currentToken.token_number;
        if ('speechSynthesis' in window) {
          // Play a small ding if possible, then speak
          const utterance = new SpeechSynthesisUtterance(`Token number ${currentToken.token_number}, please proceed to the doctor.`);
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      }
    } else if (!currentToken) {
      prevTokenRef.current = null;
    }
  }, [currentToken]);

  const waitingQueue = queue.filter(q => q.status === 'waiting' || q.status === 'holding');
  
  const getWaitInfo = (tokenNumStr) => {
    if (!tokenNumStr) return { peopleAhead: waitingQueue.length, waitSeconds: waitingQueue.length * effectiveAvg };
    
    const num = parseInt(tokenNumStr);
    const idx = waitingQueue.findIndex(q => q.token_number === num);
    
    if (idx === -1) {
      if (currentToken && currentToken.token_number === num) return { isCurrent: true };
      return { notFound: true };
    }
    
    return { peopleAhead: idx, waitSeconds: (idx + 1) * effectiveAvg };
  };

  const waitInfo = getWaitInfo(searchToken);
  
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  let displayWaitSeconds = (waitInfo.waitSeconds || 0) + globalDelay;
  
  if (lastUpdated && displayWaitSeconds > 0) {
    const elapsed = Math.floor((Date.now() - lastUpdated) / 1000);
    displayWaitSeconds = Math.max(0, displayWaitSeconds - elapsed);
  }

  const mins = Math.floor(displayWaitSeconds / 60);
  const secs = displayWaitSeconds % 60;
  
  const totalQueueWaitTime = (waitingQueue.length * effectiveAvg) + globalDelay;
  const isEscalated = displayWaitSeconds > 30 * 60;
  
  const getHealthBadge = () => {
    if (totalQueueWaitTime < 15 * 60) return { label: 'Light Load', color: 'bg-green-100 text-green-700 border-green-200' };
    if (totalQueueWaitTime < 45 * 60) return { label: 'Moderate Load', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { label: 'Heavy Load', color: 'bg-red-100 text-red-700 border-red-200' };
  };
  const healthBadge = getHealthBadge();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-inter relative overflow-hidden">
      
      {/* Reconnect Banner */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-red-500 text-white py-2 px-4 flex items-center justify-center gap-2 font-medium z-50 shadow-md absolute top-0 w-full"
          >
            <WifiOff className="w-5 h-5" />
            Connection lost. Reconnecting...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delay Banner */}
      <AnimatePresence>
        {globalDelay > 0 && isConnected && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-amber-500 text-white py-3 px-4 flex items-center justify-center gap-3 font-semibold z-40 shadow-md w-full"
          >
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            The doctor is currently delayed by {globalDelay / 60} minutes. We apologize for the inconvenience. All wait times below have been updated.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto pt-20">
        
        {/* Main Display */}
        <div className="text-center mb-16 relative w-full">
          {/* Health Badge placed absolutely to the side on desktop, or above on mobile */}
          <div className="absolute top-0 right-0 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold shadow-sm bg-white">
            <Activity className="w-4 h-4 text-slate-500" />
            <span className={`px-2 py-0.5 rounded-full ${healthBadge.color}`}>{healthBadge.label}</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-teal-800 tracking-wide uppercase mb-4 opacity-80 flex justify-center items-center gap-3">
            Now Serving
            {currentToken && currentToken.status === 'called' && <Volume2 className="w-6 h-6 text-teal-500 animate-pulse" />}
          </h2>
          <div className="h-48 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              {currentToken ? (
                <motion.div
                  key={currentToken.token_number}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.08, 1], opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="text-[120px] md:text-[160px] font-black tabular-nums leading-none text-teal-600 drop-shadow-xl"
                >
                  #{currentToken.token_number}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-4xl md:text-6xl font-bold text-slate-300"
                >
                  Waiting...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Wait Time Info Card */}
        <div className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
            <motion.div 
              className={`h-full ${isEscalated ? 'bg-amber-500' : 'bg-teal-500'}`}
              initial={{ width: 0 }}
              animate={{ width: waitInfo.peopleAhead === 0 ? '100%' : `${Math.max(5, 100 - (waitInfo.peopleAhead * 5))}%` }}
              transition={{ duration: 1 }}
            />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Find My Token</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="number" 
                  placeholder="Enter token #"
                  value={searchToken}
                  onChange={(e) => setSearchToken(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition-all font-tabular-nums font-semibold text-lg"
                />
              </div>
            </div>

            <div className="w-full md:w-2/3 flex flex-col items-center md:items-end text-center md:text-right">
              {waitInfo.notFound ? (
                <div className="text-xl font-medium text-slate-400">Token not found in queue</div>
              ) : waitInfo.isCurrent ? (
                <div className="text-2xl font-bold text-teal-600 animate-pulse">It's your turn!</div>
              ) : (
                <>
                  <div className="text-lg font-medium text-slate-600 mb-1">
                    {searchToken ? <span className="font-bold text-slate-800">You are</span> : "Currently"} 
                    <span className="text-teal-600 font-bold mx-2">{waitInfo.peopleAhead}</span> 
                    {waitInfo.peopleAhead === 1 ? 'person' : 'people'} ahead {searchToken ? 'of you' : 'in line'}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className={`w-6 h-6 ${isEscalated ? 'text-amber-500' : 'text-teal-500'}`} />
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Estimated Wait:</span>
                      <div className={`text-3xl font-bold tabular-nums ${isEscalated ? 'text-amber-500' : 'text-teal-600'}`}>
                        {mins}:{secs.toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex justify-center md:justify-between items-center">
            {/* Mobile health badge */}
            <div className="md:hidden flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold bg-white">
              <span className={`px-2 py-0.5 rounded-full ${healthBadge.color}`}>{healthBadge.label}</span>
            </div>
            
            <div className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 tooltip-container cursor-help flex items-center gap-1.5 ml-auto">
              <AlertCircle className="w-3.5 h-3.5" />
              {sampleCount >= 3 
                ? `Estimate based on real pace of last ${sampleCount} consultations`
                : "Estimate based on clinic's baseline average"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
