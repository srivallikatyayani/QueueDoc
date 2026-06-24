import { useState, useEffect, useRef } from 'react';
import { socket } from '../App';
import { Clock, User, Phone, AlertCircle, CheckCircle, XCircle, ArrowRight, UserX, PauseCircle, PlayCircle, History, AlertTriangle } from 'lucide-react';

export default function Receptionist() {
  const [queue, setQueue] = useState([]);
  const [currentToken, setCurrentToken] = useState(null);
  const [effectiveAvg, setEffectiveAvg] = useState(300);
  const [sampleCount, setSampleCount] = useState(0);
  const [globalDelay, setGlobalDelay] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Add Patient Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState('normal');
  const [isAdding, setIsAdding] = useState(false);
  const [lastAddedToken, setLastAddedToken] = useState(null);
  const nameInputRef = useRef(null);

  // Settings State
  const [isEditingAvg, setIsEditingAvg] = useState(false);
  const [manualAvgInput, setManualAvgInput] = useState('5');

  // Pending Actions (for undo)
  const [pendingActions, setPendingActions] = useState({});

  useEffect(() => {
    socket.on('queue:full_state', (state) => {
      setQueue(state.queue);
      setCurrentToken(state.currentToken);
      setEffectiveAvg(state.effectiveAvgSeconds);
      setSampleCount(state.sampleCount);
      setGlobalDelay(state.globalDelay);
    });

    socket.on('queue:update', (state) => {
      setQueue(state.queue);
      setCurrentToken(state.currentToken);
      setEffectiveAvg(state.effectiveAvgSeconds);
      setSampleCount(state.sampleCount);
      setGlobalDelay(state.globalDelay);
    });

    socket.on('patient:added', (data) => {
      setLastAddedToken(data.token_number);
      setTimeout(() => setLastAddedToken(null), 3000);
    });

    socket.on('audit:update', (logs) => {
      setAuditLogs(logs);
    });

    return () => {
      socket.off('queue:full_state');
      socket.off('queue:update');
      socket.off('patient:added');
      socket.off('audit:update');
    };
  }, []);

  const handleAddPatient = (e) => {
    if (e) e.preventDefault();
    if (isAdding) return;

    setIsAdding(true);
    socket.emit('patient:add', { name, phone, priority });
    
    setName('');
    setPhone('');
    setPriority('normal');
    
    setTimeout(() => {
      setIsAdding(false);
      nameInputRef.current?.focus();
    }, 600);
  };

  const handleCallNext = () => socket.emit('queue:callNext');
  const handleMarkDone = (id) => socket.emit('patient:markDone', { id });
  const handleHold = (id) => socket.emit('patient:hold', { id });
  const handleUnhold = (id) => socket.emit('patient:unhold', { id });
  const handleAddDelay = () => socket.emit('config:addDelay');

  const executeActionWithUndo = (id, actionType, eventName) => {
    setPendingActions(prev => ({
      ...prev,
      [id]: {
        type: actionType,
        timeoutId: setTimeout(() => {
          socket.emit(eventName, { id });
          setPendingActions(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 5000)
      }
    }));
  };

  const undoAction = (id) => {
    const action = pendingActions[id];
    if (action) {
      clearTimeout(action.timeoutId);
      setPendingActions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const updateManualAvg = () => {
    const mins = parseInt(manualAvgInput, 10);
    if (!isNaN(mins) && mins > 0) {
      socket.emit('config:setAvgTime', { seconds: mins * 60 });
      setIsEditingAvg(false);
    }
  };

  const nextTokenPreview = queue.length > 0 ? Math.max(...queue.map(q => q.token_number)) + 1 : 1;
  const waitingCount = queue.filter(q => q.status === 'waiting' || q.status === 'holding').length;
  const isInConsultation = queue.some(t => t.status === 'in_consultation' || t.status === 'called');

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-inter">
      {/* Left Pane - Quick Add & Tools */}
      <div className="w-[380px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6 pb-2 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-teal-800 mb-1">QueueDoc</h1>
          <p className="text-slate-500 text-sm">Reception Desk</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              Quick Add Patient
            </h2>
            
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name (Optional)</label>
                <input 
                  ref={nameInputRef}
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={`Walk-in #${nextTokenPreview}`}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone (Optional)</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-4 py-2">
                <label className="text-sm font-medium text-slate-700">Priority:</label>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                  <button 
                    type="button"
                    onClick={() => setPriority('normal')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${priority === 'normal' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Normal
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPriority('urgent')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${priority === 'urgent' ? 'bg-red-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <AlertCircle className="w-4 h-4" /> Urgent
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isAdding}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all shadow-md mt-4 flex justify-center items-center gap-2 ${isAdding ? 'bg-teal-400 cursor-not-allowed' : 'bg-teal-700 hover:bg-teal-600 active:scale-[0.98]'}`}
              >
                + Add & Get Token
              </button>
            </form>
            
            <div className={`mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center justify-center transition-opacity duration-300 ${lastAddedToken ? 'opacity-100' : 'opacity-0'}`}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Token #{lastAddedToken} Added Successfully
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Doctor Delay
            </h2>
            <p className="text-sm text-amber-700 mb-4">
              Push a broadcast to all patient screens if the doctor is running behind. Adds 15m to all wait times.
            </p>
            <button 
              onClick={handleAddDelay}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors flex justify-center items-center gap-2"
            >
              Broadcast +15m Delay
            </button>
            {globalDelay > 0 && (
              <p className="mt-3 text-xs font-bold text-center text-amber-800 bg-amber-100 p-2 rounded">
                Current Delay: {globalDelay / 60}m active
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Middle Pane - Live Queue */}
      <div className="flex-1 bg-slate-50 flex flex-col h-screen overflow-hidden border-r border-slate-200">
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              Now Serving: 
              {currentToken ? (
                <span className="text-teal-600 font-tabular-nums text-3xl">#{currentToken.token_number}</span>
              ) : (
                <span className="text-slate-400">None</span>
              )}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span className="font-medium bg-slate-100 px-2 py-1 rounded-md">{waitingCount} Waiting</span>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isEditingAvg ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={manualAvgInput} 
                      onChange={e => setManualAvgInput(e.target.value)}
                      className="w-16 px-1 border rounded"
                    /> min
                    <button onClick={updateManualAvg} className="text-teal-600 font-medium">Save</button>
                  </div>
                ) : (
                  <span 
                    className="cursor-pointer hover:text-teal-600 underline decoration-dotted"
                    onClick={() => {
                      setManualAvgInput(Math.round(effectiveAvg / 60).toString());
                      setIsEditingAvg(true);
                    }}
                  >
                    Est. {Math.round(effectiveAvg / 60)} min/patient
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleCallNext}
            disabled={isInConsultation}
            className={`px-6 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-all ${isInConsultation ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-teal-600 hover:bg-teal-500 text-white hover:shadow-teal-500/30 hover:-translate-y-0.5 active:translate-y-0'}`}
          >
            Call Next <ArrowRight className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 relative">
          {queue.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              <p>Queue is empty for today.</p>
            </div>
          ) : (
            queue.filter(t => !['done', 'no_show', 'cancelled'].includes(t.status)).map(token => {
              const isActive = token.status === 'in_consultation' || token.status === 'called';
              const isHolding = token.status === 'holding';
              const isPending = pendingActions[token.id];
              
              if (isPending) {
                return (
                  <div key={token.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <div className="text-amber-800 font-medium">
                      {isPending.type === 'cancel' ? 'Cancelling' : 'Marking No-show'} Token #{token.token_number}...
                    </div>
                    <button 
                      onClick={() => undoAction(token.id)}
                      className="text-sm px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg font-medium hover:bg-amber-100 transition-colors"
                    >
                      Undo (5s)
                    </button>
                  </div>
                );
              }

              return (
                <div 
                  key={token.id} 
                  className={`rounded-xl p-4 flex justify-between items-center transition-all border ${isActive ? 'bg-teal-50 border-teal-200 shadow-sm' : isHolding ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg font-tabular-nums ${isActive ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20' : token.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-700'}`}>
                      {token.token_number}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                        {token.name} 
                        {token.priority === 'urgent' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Urgent</span>}
                        {isActive && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">Now Serving</span>}
                        {isHolding && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold flex items-center gap-1"><PauseCircle className="w-3 h-3"/> On Hold</span>}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-3">
                        {token.phone && <span><Phone className="w-3 h-3 inline mr-1"/>{token.phone}</span>}
                        <span>Created {new Date(token.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <button 
                        onClick={() => handleMarkDone(token.id)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" /> Mark Done
                      </button>
                    ) : (
                      <>
                        {isHolding ? (
                          <button 
                            onClick={() => handleUnhold(token.id)}
                            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                            title="Resume waiting"
                          >
                            <PlayCircle className="w-5 h-5" /> Unhold
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleHold(token.id)}
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                            title="Patient stepped out"
                          >
                            <PauseCircle className="w-5 h-5" /> Hold
                          </button>
                        )}
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        <button 
                          onClick={() => executeActionWithUndo(token.id, 'no_show', 'patient:noShow')}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="No Show"
                        >
                          <UserX className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => executeActionWithUndo(token.id, 'cancel', 'patient:cancel')}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane - Audit Trail */}
      <div className="w-[320px] shrink-0 bg-white flex flex-col h-screen shadow-[-2px_0_10px_rgba(0,0,0,0.02)] z-10">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
          <History className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-700">Audit Trail</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {auditLogs.length === 0 ? (
            <div className="text-sm text-slate-400 text-center mt-4">No events logged yet.</div>
          ) : (
            auditLogs.map((log, i) => {
              let diffText = null;
              if (i < auditLogs.length - 1) {
                const diffMs = new Date(log.timestamp).getTime() - new Date(auditLogs[i+1].timestamp).getTime();
                const diffSecs = Math.floor(diffMs / 1000);
                if (diffSecs < 60) diffText = `+${diffSecs}s`;
                else if (diffSecs < 3600) diffText = `+${Math.floor(diffSecs/60)}m`;
              }
              
              return (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-12 shrink-0 text-xs text-slate-400 font-tabular-nums pt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="flex-1">
                  <span className={`font-semibold mr-1 ${log.event_type === 'add' ? 'text-blue-600' : log.event_type === 'call' ? 'text-teal-600' : log.event_type === 'delay' ? 'text-amber-600' : 'text-slate-700'}`}>
                    {log.token_number ? `Token ${log.token_number}:` : 'System:'}
                  </span>
                  <span className="text-slate-600">{log.description}</span>
                  {diffText && <span className="ml-2 inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold tracking-wider align-middle" title="Time since last action">{diffText}</span>}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
