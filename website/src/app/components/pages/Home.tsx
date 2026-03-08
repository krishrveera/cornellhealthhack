import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppContext } from "../../AppContext";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Activity, Info, ChevronRight, X, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function Home() {
  const { userData, setUserData } = useAppContext();
  const navigate = useNavigate();
  const [showPrompt, setShowPrompt] = useState(!userData.hasRecordedToday);
  const [showHealthPopup, setShowHealthPopup] = useState(false);

  useEffect(() => {
    if (!userData.optedIn) {
      navigate("/onboarding");
    }
    if (userData.showHealthPopup) {
      setShowHealthPopup(true);
    }
  }, [userData.optedIn, userData.showHealthPopup, navigate]);

  const handleRecord = () => {
    navigate("/record");
  };

  const handleBypass = () => {
    setShowPrompt(false);
  };

  const closeHealthPopup = () => {
    setShowHealthPopup(false);
    setUserData(prev => ({ ...prev, showHealthPopup: false }));
  };

  if (!userData.optedIn) return null;

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-50 relative z-10">
      
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-neutral-900 z-20 bg-neutral-950">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-500" />
          <h1 className="text-xl font-bold tracking-tight">VoiceTracker</h1>
        </div>
        <button 
          onClick={() => navigate("/onboarding")}
          className="text-xs bg-neutral-900 px-3 py-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
        >
          Calibrate
        </button>
      </header>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto p-6 space-y-8 ${showPrompt ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
        
        {/* Feed of Messages */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Voice Insights</h2>
          <div className="space-y-3">
            {userData.history.map((entry, i) => (
              <div key={i} className={`p-4 rounded-2xl ${entry.isAnomaly ? "bg-rose-500/10 border border-rose-500/20" : "bg-neutral-900 border border-neutral-800"}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-neutral-400">{entry.date}</span>
                  {entry.isAnomaly && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                </div>
                <p className={`text-sm leading-relaxed ${entry.isAnomaly ? "text-rose-200" : "text-neutral-200"}`}>
                  {entry.message}
                </p>
                <div className="mt-3 flex gap-3 text-xs text-neutral-500">
                  <span>Pitch: {entry.pitch}Hz</span>
                  <span>Shimmer: {entry.shimmer}%</span>
                  <span>Jitter: {entry.jitter}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Charts */}
        <section className="space-y-4 pb-8">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Biomarkers</h2>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
            <div>
              <div className="flex justify-between items-end">
                <h3 className="text-sm text-neutral-400">Fundamental Frequency (Pitch)</h3>
                <span className="text-lg font-semibold text-indigo-400">~212 Hz</span>
              </div>
              <div className="h-32 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userData.history}>
                    <Line type="monotone" dataKey="pitch" stroke="#818cf8" strokeWidth={2} dot={{ r: 3, fill: '#818cf8' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="h-px bg-neutral-800 my-4" />
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs text-neutral-400 mb-1">Shimmer</h3>
                <div className="text-lg font-semibold text-emerald-400">3.4%</div>
                <div className="h-16 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userData.history}>
                      <Line type="monotone" dataKey="shimmer" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-xs text-neutral-400 mb-1">Jitter</h3>
                <div className="text-lg font-semibold text-amber-400">1.2%</div>
                <div className="h-16 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userData.history}>
                      <Line type="monotone" dataKey="jitter" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Daily Voice Prompt Overlay (BeReal Style) */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-neutral-950/80 backdrop-blur-md"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
              
              <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                <Mic className="w-8 h-8 text-indigo-400" />
              </div>
              
              <h2 className="text-2xl font-bold mb-2">Time to Record!</h2>
              <p className="text-neutral-400 mb-8 text-sm">2 minutes left to capture your daily voice biomarker.</p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleRecord}
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Mic className="w-5 h-5" /> Start Recording
                </button>
                <button 
                  onClick={handleBypass}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-medium transition-colors text-sm"
                >
                  Not in a Quiet Place
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Health Recommendation Popup */}
      <AnimatePresence>
        {showHealthPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-neutral-900 border border-rose-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <button onClick={closeHealthPopup} className="p-2 text-neutral-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">Anomaly Detected</h3>
              <p className="text-neutral-300 text-sm leading-relaxed mb-6">
                Your vocal jitter has increased by 40% compared to your baseline. This could indicate early signs of vocal cord inflammation or fatigue. We recommend resting your voice and consulting an ENT if symptoms persist.
              </p>
              
              <div className="space-y-3">
                <button onClick={closeHealthPopup} className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold transition-colors">
                  Acknowledge
                </button>
                <button className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors text-sm flex items-center justify-center gap-2">
                  <Info className="w-4 h-4" /> Find a Specialist
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
