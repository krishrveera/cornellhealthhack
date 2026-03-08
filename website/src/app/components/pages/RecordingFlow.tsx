import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAppContext } from "../../AppContext";
import { motion, AnimatePresence } from "motion/react";
import { Mic, CheckCircle2, XCircle, AlertTriangle, Play, Square, Loader2, Activity } from "lucide-react";

type FlowState = "PREPARING" | "COUNTDOWN" | "RECORDING" | "ANALYZING" | "RESULT";

const PROMPTS = [
  {
    type: "Vowel",
    text: "Ahhhhhhhhhh",
    duration: 5,
  },
  {
    type: "Reading",
    text: "The quick brown fox jumps over the lazy dog.",
    words: ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog."],
    duration: 10,
  }
];

export function RecordingFlow() {
  const { userData, setUserData } = useAppContext();
  const navigate = useNavigate();
  const [flowState, setFlowState] = useState<FlowState>("PREPARING");
  const [countdown, setCountdown] = useState(3);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState(PROMPTS[1]);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isSuccess, setIsSuccess] = useState(true);

  // Initialize
  useEffect(() => {
    // Randomize prompt
    setCurrentPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }, []);

  // Countdown Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (flowState === "COUNTDOWN") {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else {
        setFlowState("RECORDING");
      }
    }
    return () => clearTimeout(timer);
  }, [countdown, flowState]);

  // Recording Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (flowState === "RECORDING") {
      if (recordingTime < currentPrompt.duration) {
        timer = setTimeout(() => setRecordingTime(t => t + 1), 1000);
      } else {
        setFlowState("ANALYZING");
      }
    }
    return () => clearTimeout(timer);
  }, [recordingTime, flowState, currentPrompt.duration]);

  // Karaoke Highlight Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (flowState === "RECORDING" && currentPrompt.type === "Reading") {
      const msPerWord = (currentPrompt.duration * 1000) / currentPrompt.words!.length;
      timer = setInterval(() => {
        setActiveWordIndex(idx => (idx < currentPrompt.words!.length - 1 ? idx + 1 : idx));
      }, msPerWord);
    }
    return () => clearInterval(timer);
  }, [flowState, currentPrompt]);

  // Analyzing Logic
  useEffect(() => {
    if (flowState === "ANALYZING") {
      // Simulate analysis
      const success = Math.random() > 0.2; // 80% pass rate
      setIsSuccess(success);
      setTimeout(() => {
        setFlowState("RESULT");
      }, 3000); // 3 seconds of loading
    }
  }, [flowState]);

  const handleStart = () => {
    setCountdown(3);
    setRecordingTime(0);
    setActiveWordIndex(0);
    setFlowState("COUNTDOWN");
  };

  const finishRecording = () => {
    if (isSuccess) {
      // Generate dummy metrics
      const newEntry = {
        date: new Date().toLocaleDateString('en-US', { weekday: 'short' }),
        pitch: Math.round(200 + Math.random() * 20),
        shimmer: Number((3 + Math.random() * 1.5).toFixed(1)),
        jitter: Number((1 + Math.random() * 1).toFixed(1)),
        message: "Your voice exhibits slight jitter today, but pitch is stable. Stay hydrated!",
        isAnomaly: Math.random() > 0.7,
      };

      setUserData(prev => ({
        ...prev,
        hasRecordedToday: true,
        history: [...prev.history, newEntry],
        showHealthPopup: newEntry.isAnomaly,
      }));
    }
    navigate("/");
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-50 relative z-10 p-6 overflow-hidden">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-12 relative z-20">
        <button 
          onClick={() => navigate("/")}
          className="text-neutral-500 hover:text-white transition-colors"
        >
          <XCircle className="w-6 h-6" />
        </button>
        <span className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
          {flowState === "PREPARING" && "Get Ready"}
          {flowState === "COUNTDOWN" && "Starting soon"}
          {flowState === "RECORDING" && "Recording"}
          {flowState === "ANALYZING" && "Analyzing"}
          {flowState === "RESULT" && "Done"}
        </span>
        <div className="w-6" />
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-20">
        
        <AnimatePresence mode="wait">
          
          {flowState === "PREPARING" && (
            <motion.div 
              key="preparing"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center text-center space-y-8 w-full"
            >
              <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20">
                <Mic className="w-10 h-10 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Daily Voice Check</h2>
                <p className="text-neutral-400 max-w-xs mx-auto text-sm leading-relaxed">
                  Find a quiet place. We will record you holding a sustained vowel or reading a short passage.
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 w-full text-left flex items-start gap-4">
                <div className="bg-neutral-800 p-2 rounded-xl text-neutral-300 shrink-0">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Prompt: {currentPrompt.type}</h3>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">"{currentPrompt.text}"</p>
                </div>
              </div>

              <button 
                onClick={handleStart}
                className="w-full py-4 mt-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-all"
              >
                I'm Ready
              </button>
            </motion.div>
          )}

          {flowState === "COUNTDOWN" && (
            <motion.div 
              key="countdown"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-[120px] font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] tabular-nums"
            >
              {countdown}
            </motion.div>
          )}

          {flowState === "RECORDING" && (
            <motion.div 
              key="recording"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center w-full space-y-12"
            >
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Visualizer Rings */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      scale: [1, 1.2 + Math.random() * 0.3, 1],
                      opacity: [0.3, 0.6, 0.3]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.8 + Math.random() * 0.4,
                      delay: i * 0.2 
                    }}
                    className="absolute inset-0 border-2 border-indigo-500/50 rounded-full"
                  />
                ))}
                
                <div className="z-10 bg-indigo-500 rounded-full w-24 h-24 flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.5)]">
                  <Mic className="w-10 h-10 text-white animate-pulse" />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-medium text-neutral-400 tabular-nums">
                  <span>0:0{recordingTime}</span>
                  <span>0:{currentPrompt.duration < 10 ? `0${currentPrompt.duration}` : currentPrompt.duration}</span>
                </div>
                <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: `${(recordingTime / currentPrompt.duration) * 100}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                    transition={{ ease: "linear", duration: 1 }}
                  />
                </div>
              </div>

              {/* Prompt Text (Karaoke) */}
              <div className="w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center shadow-inner">
                {currentPrompt.type === "Reading" ? (
                  <div className="flex flex-wrap justify-center gap-1.5 text-xl font-medium leading-relaxed">
                    {currentPrompt.words?.map((word, idx) => (
                      <span 
                        key={idx} 
                        className={`transition-colors duration-300 ${idx === activeWordIndex ? "text-indigo-400 font-bold drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]" : idx < activeWordIndex ? "text-neutral-500" : "text-white"}`}
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                ) : (
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-3xl font-bold tracking-[0.2em] text-indigo-400"
                  >
                    {currentPrompt.text}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {flowState === "ANALYZING" && (
            <motion.div 
              key="analyzing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full animate-spin text-indigo-500/30" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="283" strokeDashoffset="200" className="text-indigo-500" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
              </div>
              <h2 className="text-xl font-bold">Extracting Biomarkers</h2>
              <p className="text-sm text-neutral-400 text-center max-w-xs">
                Analyzing pitch, shimmer, jitter, and spectral flux against your baseline...
              </p>
            </motion.div>
          )}

          {flowState === "RESULT" && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center space-y-8 w-full"
            >
              {isSuccess ? (
                <>
                  <div className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500 relative">
                    <motion.div 
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                    >
                      <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-white">Quality Check Passed</h2>
                    <p className="text-neutral-400">Audio sample was clear and isolated.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-32 h-32 bg-rose-500/20 rounded-full flex items-center justify-center border-4 border-rose-500 relative">
                    <motion.div 
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                    >
                      <XCircle className="w-16 h-16 text-rose-400" />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-white">Too Much Noise</h2>
                    <p className="text-neutral-400">We couldn't isolate your voice clearly.</p>
                  </div>
                </>
              )}

              <button 
                onClick={isSuccess ? finishRecording : handleStart}
                className={`w-full py-4 mt-4 text-white rounded-2xl font-bold text-lg transition-all ${isSuccess ? "bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]" : "bg-rose-500 hover:bg-rose-600 shadow-[0_0_30px_-5px_rgba(244,63,94,0.4)]"}`}
              >
                {isSuccess ? "View Results" : "Try Again"}
              </button>
            </motion.div>
          )}

        </AnimatePresence>

      </main>
    </div>
  );
}
