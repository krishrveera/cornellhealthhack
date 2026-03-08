import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppContext } from "../../AppContext";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Activity, Info, X, AlertTriangle, Flame, Music, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { RecordedWaveform } from "../ui/RecordedWaveform";
import { Spectrogram } from "../ui/Spectrogram";
import { VoiceTermsGlossary } from "../VoiceTermsGlossary";

export function Home() {
  const { userData, setUserData } = useAppContext();
  const navigate = useNavigate();
  const [showPrompt, setShowPrompt] = useState(!userData.hasRecordedToday);
  const [showHealthPopup, setShowHealthPopup] = useState(false);

  useEffect(() => {
    if (!userData.onboardingComplete) {
      navigate("/onboarding");
    }
    if (userData.showHealthPopup) {
      setShowHealthPopup(true);
    }
  }, [userData.onboardingComplete, userData.showHealthPopup, navigate]);

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

  const handleDemoMode = () => {
    // Navigate to recording flow with demo mode enabled
    navigate("/record", { state: { demoMode: true } });
  };

  if (!userData.onboardingComplete) return null;

  const latestEntry = userData.history.length > 0 ? userData.history[userData.history.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-50 relative z-10">

      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-neutral-900 z-20 bg-neutral-950">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-500" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">AriaPitch</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleDemoMode}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition-colors"
            title="Run Demo Analysis with Sample Audio"
          >
            <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Demo</span>
          </button>
          {userData.optedIn && (
            <button
              onClick={() => navigate("/audio-library")}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
              title="Audio Recordings Library (Bridge2AI)"
            >
              <Music className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Library</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400">
            <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm font-semibold">{userData.streak ?? 0}</span>
          </div>
          <button
            onClick={() => navigate("/onboarding")}
            className={`text-xs px-2 sm:px-3 py-1.5 rounded-full font-medium transition-colors ${userData.optedIn
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-rose-500 text-white hover:bg-rose-600"
              }`}
          >
            <span className="hidden sm:inline">Opt In/Out of Study</span>
            <span className="sm:hidden">Opt {userData.optedIn ? 'In' : 'Out'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${showPrompt ? "blur-sm opacity-50 pointer-events-none" : ""}`}>

        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

            {/* Feed of Messages - iMessage style, newest first */}
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Voice Insights</h2>
              <div className="flex flex-col gap-3 max-h-[420px] lg:max-h-[600px] overflow-y-auto pr-1 -mr-1">
                {[...userData.history].reverse().map((entry, i) => (
                  <div
                    key={i}
                    className={`self-start max-w-full lg:max-w-[85%] px-3 sm:px-4 py-3 rounded-2xl rounded-tl-md ${entry.isAnomaly ? "bg-rose-500/15 border border-rose-500/25" : "bg-neutral-800/90 border border-neutral-700/80"}`}
                  >
                    <div className="flex justify-between items-start mb-1.5 gap-2">
                      <span className="text-xs font-medium text-neutral-400">{entry.date}</span>
                      {entry.isAnomaly && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    </div>
                    <p className={`text-sm leading-relaxed ${entry.isAnomaly ? "text-rose-200" : "text-neutral-200"}`}>
                      {entry.message}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span>Pitch: {entry.pitch}Hz</span>
                      <span>Shimmer: {entry.shimmer}%</span>
                      <span>Jitter: {entry.jitter}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Charts */}
            <section className="space-y-4 lg:pb-8">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Biomarkers</h2>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 space-y-4">
                <div>
                  <div className="flex justify-between items-end flex-wrap gap-2">
                    <h3 className="text-xs sm:text-sm text-neutral-400">Fundamental Frequency (Pitch)</h3>
                    <span className="text-base sm:text-lg font-semibold text-indigo-400">~212 Hz</span>
                  </div>
                  <div className="h-32 sm:h-40 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userData.history}>
                        <Line type="monotone" dataKey="pitch" stroke="#818cf8" strokeWidth={2} dot={{ r: 3, fill: '#818cf8' }} />
                        <ReferenceLine y={200} stroke="#525252" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Healthy", position: "right", fill: "#525252", fontSize: 10 }} />
                        <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px', color: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="h-px bg-neutral-800 my-4" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs text-neutral-400 mb-1">Shimmer</h3>
                    <div className="text-base sm:text-lg font-semibold text-emerald-400">3.4%</div>
                    <div className="h-16 sm:h-20 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={userData.history}>
                          <Line type="monotone" dataKey="shimmer" stroke="#34d399" strokeWidth={2} dot={false} />
                          <ReferenceLine y={3.0} stroke="#525252" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Healthy", position: "right", fill: "#525252", fontSize: 9 }} />
                          <YAxis hide domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs text-neutral-400 mb-1">Jitter</h3>
                    <div className="text-base sm:text-lg font-semibold text-amber-400">1.2%</div>
                    <div className="h-16 sm:h-20 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={userData.history}>
                          <Line type="monotone" dataKey="jitter" stroke="#fbbf24" strokeWidth={2} dot={false} />
                          <ReferenceLine y={1.0} stroke="#525252" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Healthy", position: "right", fill: "#525252", fontSize: 9 }} />
                          <YAxis hide domain={['dataMin - 0.3', 'dataMax + 0.3']} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Latest Recording Waveform & Spectrogram */}
          {userData.lastRecordingData && userData.lastRecordingData.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Latest Recording</h2>
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 space-y-6">

                {/* Waveform with jitter/shimmer animation */}
                <div>
                  <h3 className="text-xs text-neutral-400 mb-3 uppercase tracking-wider">Waveform Analysis</h3>
                  <RecordedWaveform
                    audioData={userData.lastRecordingData}
                    jitter={latestEntry?.jitter ?? 1.2}
                    shimmer={latestEntry?.shimmer ?? 3.4}
                  />
                </div>

                <div className="h-px bg-neutral-800" />

                {/* Spectrogram */}
                <div>
                  <h3 className="text-xs text-neutral-400 mb-3 uppercase tracking-wider">Spectrogram</h3>
                  <Spectrogram
                    audioData={userData.lastRecordingData}
                    sampleRate={userData.lastRecordingSampleRate ?? 44100}
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Frequency distribution over time — brighter colors indicate stronger signal.
                  </p>
                </div>
              </div>
            </section>
          )}

        </div>

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

      {/* Voice Terms Glossary */}
      <VoiceTermsGlossary />
    </div>
  );
}
