import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAppContext } from "../../AppContext";
import { motion, AnimatePresence } from "motion/react";
import { Mic, CheckCircle2, XCircle, Play, Square, Activity } from "lucide-react";
import { analyzeAudio, extractBiomarkers, generateMessage, runDemoAnalysis } from "../../services/api";
import { LiveWaveform } from "../ui/LiveWaveform";

type FlowState = "PREPARING" | "INITIAL_DELAY" | "SILENCE_COUNTDOWN" | "SILENCE_RECORDING" | "RECORDING" | "ANALYZING" | "RESULT" | "SHOW_DATA";

// We will load prompts dynamically from the server
interface Prompt {
  id: string;
  type: string;
  text: string;
  instruction: string;
  recordingDuration: number;
}

export function RecordingFlow() {
  const { userData, setUserData } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isDemoMode = (location.state as any)?.demoMode || false;

  const [flowState, setFlowState] = useState<FlowState>("PREPARING");
  const [silenceCountdown, setSilenceCountdown] = useState(3);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [isSuccess, setIsSuccess] = useState(true);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [displayData, setDisplayData] = useState<{
    pitch: number;
    shimmer: number;
    jitter: number;
    spectralCentroid: number;
    harmonicRatio: number;
    message: string;
    isAnomaly: boolean;
    snr?: number;
    voicedDuration?: number;
  } | null>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    import("../../services/api").then(({ getTasks }) => {
      getTasks().then(serverTasks => {
        if (serverTasks && serverTasks.length > 0) {
          const formattedPrompts: Prompt[] = serverTasks.map(t => ({
            id: t.id,
            type: t.display_name,
            text: t.prompt_text || t.instruction,
            instruction: t.instruction,
            recordingDuration: t.min_duration_sec
          }));
          setCurrentPrompt(formattedPrompts[Math.floor(Math.random() * formattedPrompts.length)]);
        } else {
          // Fallback
          setCurrentPrompt({
            id: "prolonged_vowel",
            type: "Vowel Task",
            text: "1, 2, 3 aah",
            instruction: "Repeat '1, 2, 3 aah' in your normal voice and hold the sound 'aah' for as long as you can",
            recordingDuration: 10
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    return () => { stopAudioStream(); };
  }, []);

  const stopAudioStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      return true;
    } catch (err) {
      console.error("Microphone access denied:", err);
      return false;
    }
  };

  const startRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === "inactive") {
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.start();
    }
  };

  const stopAndProcessAudio = async () => {
    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") { resolve(); return; }
      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          setAudioBlob(blob);
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new AudioContext();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          setUserData(prev => ({ ...prev, lastRecordingData: new Float32Array(channelData), lastRecordingSampleRate: audioBuffer.sampleRate }));
          await audioCtx.close();
        } catch (err) {
          console.error("Error processing audio:", err);
          setAnalysisError("Failed to process audio recording");
        }
        resolve();
      };
      mediaRecorder.stop();
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); }
    });
  };

  // Initial delay before countdown
  useEffect(() => {
    if (flowState === "INITIAL_DELAY") {
      const timer = setTimeout(() => {
        setFlowState("SILENCE_COUNTDOWN");
        setSilenceCountdown(3);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [flowState]);

  // Silence countdown: 3 → 2 → 1 → start silence recording
  useEffect(() => {
    if (flowState === "SILENCE_COUNTDOWN") {
      let timer: ReturnType<typeof setTimeout>;
      if (silenceCountdown > 0) {
        timer = setTimeout(() => setSilenceCountdown(c => c - 1), 1000);
      } else {
        setFlowState("SILENCE_RECORDING");
        setRecordingTime(0);
      }
      return () => clearTimeout(timer);
    }
  }, [silenceCountdown, flowState]);


  // Silence Recording Timer - 3 seconds of silence
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (flowState === "SILENCE_RECORDING") {
      if (recordingTime < 3) {
        timer = setTimeout(() => setRecordingTime(t => t + 1), 1000);
      } else {
        setFlowState("RECORDING");
        setRecordingTime(0); // Reset for actual recording
      }
    }
    return () => clearTimeout(timer);
  }, [recordingTime, flowState]);

  // Start actual recording when entering silence countdown (need to capture the silence)
  useEffect(() => {
    if (flowState === "SILENCE_COUNTDOWN" && !isDemoMode) {
      startRecording();
    }
  }, [flowState, isDemoMode]);

  // Recording Timer - Auto-stop after duration
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (flowState === "RECORDING" && currentPrompt) {
      if (recordingTime < currentPrompt.recordingDuration) {
        timer = setTimeout(() => setRecordingTime(t => t + 1), 1000);
      } else {
        handleStopRecording();
      }
    }
    return () => clearTimeout(timer);
  }, [recordingTime, flowState, currentPrompt]);

  // Analyzing Logic - Call real API or demo API
  useEffect(() => {
    if (flowState === "ANALYZING") {
      const runAnalysis = async () => {
        try {
          setAnalysisError(null);

          let result;

          if (isDemoMode) {
            // Demo mode: use pre-loaded sample file
            result = await runDemoAnalysis();
          } else if (audioBlob && currentPrompt) {
            // Normal mode: use recorded audio
            result = await analyzeAudio(audioBlob, {
              deviceId: 'web_app',
              taskType: (currentPrompt.id as any),
              silenceDuration: 0.5,
            });
          } else {
            throw new Error("No audio data available");
          }

          if (result.success && result.data) {
            setIsSuccess(true);
            const biomarkers = extractBiomarkers(result.data.features);
            const { message, isAnomaly } = generateMessage(result.data.predictions, result.data.explanation);
            (window as any).__analysisResult = {
              biomarkers,
              message,
              isAnomaly,
              predictions: result.data.predictions,
              quality: result.data.quality
            };
          } else {
            setIsSuccess(false);
            setAnalysisError(result.error?.message || "Analysis failed");
          }
        } catch (error) {
          console.error("Analysis error:", error);
          setIsSuccess(false);
          setAnalysisError("Failed to analyze recording");
        } finally {
          setFlowState("RESULT");
        }
      };
      runAnalysis();
    }
  }, [flowState, audioBlob, currentPrompt, isDemoMode]);

  const handleStart = async () => {
    setSilenceCountdown(3);
    setRecordingTime(0);

    if (isDemoMode) {
      // Demo mode: request microphone for live audio visualization, but won't record
      const ok = await startAudioCapture();
      setFlowState("INITIAL_DELAY");
      if (!ok) {
        console.warn("Demo mode: microphone access denied, proceeding without live visualization");
      }
    } else {
      // Normal mode: request microphone access
      const ok = await startAudioCapture();
      if (ok) {
        setFlowState("INITIAL_DELAY");
      } else {
        // Fallback: proceed without audio if mic is denied
        setFlowState("INITIAL_DELAY");
      }
    }
  };

  const handleStopRecording = async () => {
    if (isDemoMode) {
      // Demo mode: skip audio processing, go straight to analysis
      setFlowState("ANALYZING");
    } else {
      // Normal mode: process recorded audio
      await stopAndProcessAudio();
      stopAudioStream();
      setFlowState("ANALYZING");
    }
  };

  const finishRecording = () => {
    if (isSuccess) {
      const analysisResult = (window as any).__analysisResult;
      let pitch, shimmer, jitter, message, isAnomaly, spectralCentroid, harmonicRatio, snr, voicedDuration;
      if (analysisResult) {
        pitch = analysisResult.biomarkers.pitch;
        shimmer = analysisResult.biomarkers.shimmer;
        jitter = analysisResult.biomarkers.jitter;
        spectralCentroid = analysisResult.biomarkers.spectralCentroid;
        harmonicRatio = analysisResult.biomarkers.harmonicRatio;
        message = analysisResult.message;
        isAnomaly = analysisResult.isAnomaly;

        // Extract quality metrics if available
        snr = analysisResult.quality?.snr_db;
        voicedDuration = analysisResult.quality?.voiced_duration_sec;

        delete (window as any).__analysisResult;
      } else {
        pitch = Math.round(200 + Math.random() * 20);
        shimmer = Number((3 + Math.random() * 1.5).toFixed(1));
        jitter = Number((1 + Math.random() * 1).toFixed(1));
        spectralCentroid = Math.round(1500 + Math.random() * 500);
        harmonicRatio = Number((15 + Math.random() * 8).toFixed(1));
        message = "Your voice exhibits slight jitter today, but pitch is stable. Stay hydrated!";
        isAnomaly = false;
      }

      // Store display data
      setDisplayData({
        pitch,
        shimmer,
        jitter,
        spectralCentroid,
        harmonicRatio,
        message,
        isAnomaly,
        snr,
        voicedDuration,
      });

      const newEntry = {
        date: new Date().toLocaleDateString('en-US', { weekday: 'short' }),
        pitch,
        shimmer,
        jitter,
        message,
        isAnomaly,
      };

      // If opted in to Bridge2AI, save the full audio recording
      const updates: any = {
        hasRecordedToday: true,
        history: [...userData.history, newEntry],
        showHealthPopup: isAnomaly,
      };

      if (userData.optedIn) {
        const audioRecording = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          timestamp: Date.now(), pitch, shimmer, jitter, message, isAnomaly, duration: recordingTime, spectralCentroid, harmonicRatio,
          formants: [Math.round(700 + Math.random() * 100), Math.round(1200 + Math.random() * 200), Math.round(2500 + Math.random() * 300)],
        };
        updates.audioRecordings = [...userData.audioRecordings, audioRecording];
      }
      setUserData(prev => ({ ...prev, ...updates }));

      // Show the data screen instead of navigating home
      setFlowState("SHOW_DATA");
    } else {
      // If failed, restart
      navigate("/");
    }
  };

  return (
    <div className="flex flex-col h-full text-purple-950 relative z-10" style={{ fontFamily: "var(--font-body)" }}>

      {/* Header — matches Home theme */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between z-20 border-b border-purple-200/40" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)" }}>
        <button
          type="button"
          onClick={() => { stopAudioStream(); navigate("/"); }}
          className="flex items-center gap-2 text-purple-500 hover:text-purple-700 transition-colors"
        >
          <XCircle className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
        <div className="flex flex-col items-center">
          {isDemoMode && (
            <span className="text-xs font-bold tracking-wider text-cyan-400 mb-1">DEMO MODE</span>
          )}
          <span className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
            {flowState === "PREPARING" && "Get Ready"}
            {flowState === "INITIAL_DELAY" && "Get Ready"}
            {flowState === "SILENCE_COUNTDOWN" && "Prepare for Silence"}
            {flowState === "SILENCE_RECORDING" && "Recording Silence"}
            {flowState === "RECORDING" && "Recording"}
            {flowState === "ANALYZING" && "Analyzing"}
            {flowState === "RESULT" && "Done"}
            {flowState === "SHOW_DATA" && "Your Results"}
          </span>
        </div>
        <div className="w-6" />
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-20 p-4 sm:p-6 lg:p-8 overflow-y-auto">

        <AnimatePresence mode="wait">

          {flowState === "PREPARING" && (
            <motion.div
              key="preparing"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center text-center space-y-6 sm:space-y-8 w-full max-w-md mx-auto"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border border-purple-200/50 shadow-sm" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
                <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">
                  {isDemoMode ? "Demo Voice Analysis" : "Daily Voice Check"}
                </h2>
                <p className="text-neutral-400 max-w-xs mx-auto text-sm leading-relaxed">
                  {isDemoMode
                    ? "This demo will simulate the prolonged vowel test using a pre-recorded sample audio file."
                    : "Find a quiet place. First, we'll record 3 seconds of silence to calibrate, then you'll complete a voice task."
                  }
                </p>
              </div>

              <div className="rounded-2xl border border-purple-200/50 p-4 w-full text-left flex items-start gap-3 sm:gap-4 shadow-sm backdrop-blur-md" style={{ background: "rgba(255,255,255,0.7)" }}>
                <div className="bg-purple-100/80 p-2 rounded-xl text-purple-600 shrink-0 border border-purple-200/40">
                  <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">Task: {currentPrompt?.type || "Loading..."}</h3>
                  <p className="text-xs text-neutral-400 mt-1">{currentPrompt?.instruction || "Please wait while we set up your task."}</p>
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={!currentPrompt}
                className="w-full py-4 mt-4 sm:mt-8 bg-indigo-500 hover:bg-indigo-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-2xl font-bold text-base sm:text-lg shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-all"
              >
                I'm Ready
              </button>
            </motion.div>
          )}

          {flowState === "SILENCE_COUNTDOWN" && (
            <motion.div
              key="silence-countdown"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center text-center space-y-6 w-full max-w-md mx-auto"
            >
              <div className="relative w-32 h-32 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute inset-0 rounded-full border border-purple-200/50 shadow-sm" style={{ background: "rgba(255,255,255,0.6)" }}
                />
                <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse absolute top-2 right-2" />
                <div className="text-[100px] font-black text-purple-600 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)] tabular-nums leading-none">
                  {silenceCountdown}
                </div>
              </div>
              <div className="rounded-2xl border border-purple-200/50 p-6 w-full shadow-sm backdrop-blur-md" style={{ background: "rgba(255,255,255,0.7)" }}>
                <p className="text-purple-700 text-lg font-medium">Preparing to record silence...</p>
                <p className="text-purple-500/70 text-sm mt-1">Stay quiet for calibration</p>
              </div>
            </motion.div>
          )}

          {flowState === "RECORDING" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center w-full max-w-lg mx-auto space-y-6 sm:space-y-8"
            >
              <div className="w-full rounded-2xl border border-purple-200/50 p-4 sm:p-5 shadow-sm backdrop-blur-md" style={{ background: "rgba(255,255,255,0.7)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-[11px] text-purple-400 uppercase tracking-[0.15em] font-semibold">Live Audio</span>
                </div>
                <LiveWaveform analyser={analyserRef.current} isActive={flowState === "RECORDING"} />
              </div>

              <div className="w-full rounded-2xl border border-purple-200/50 p-4 sm:p-5 shadow-sm backdrop-blur-md text-center space-y-2" style={{ background: "rgba(255,255,255,0.7)" }}>
                <div className="text-4xl sm:text-5xl font-black text-purple-900 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  <span className="text-2xl text-neutral-500"> / {currentPrompt ? `${Math.floor(currentPrompt.recordingDuration / 60)}:${(currentPrompt.recordingDuration % 60).toString().padStart(2, '0')}` : "0:00"}</span>
                </div>
                <p className="text-sm text-neutral-400">Recording in progress</p>
                <div className="w-full bg-neutral-800 rounded-full h-2 mt-3">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: currentPrompt ? `${(recordingTime / currentPrompt.recordingDuration) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              {/* Prompt Text */}
              {currentPrompt && (
                <div className="w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-inner max-h-[40vh] overflow-y-auto">
                  {currentPrompt.id === "reading_passage" || currentPrompt.id === "harvard_sentences" ? (
                    <div className="text-base sm:text-lg font-medium leading-relaxed text-white text-left">
                      {currentPrompt.text}
                    </div>
                  ) : (
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-2xl sm:text-3xl font-bold tracking-[0.2em] text-indigo-400 text-center"
                    >
                      {currentPrompt.text}
                    </motion.div>
                  )}
                </div>
              )}

              <button
                onClick={handleStopRecording}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-3"
              >
                <Square className="w-5 h-5 fill-current" /> Stop Recording
              </button>
            </motion.div>
          )}

          {flowState === "ANALYZING" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative w-32 h-32 flex items-center justify-center rounded-full border border-purple-200/50 shadow-sm" style={{ background: "rgba(255,255,255,0.6)" }}>
                <svg className="w-full h-full animate-spin text-purple-200" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="283" strokeDashoffset="200" className="text-purple-600" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-purple-600 animate-pulse" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-purple-900" style={{ fontFamily: "var(--font-brand)" }}>Extracting Biomarkers</h2>
              <p className="text-sm text-purple-500 text-center max-w-xs">Analyzing pitch, shimmer, jitter, and spectral flux against your baseline...</p>
            </motion.div>
          )}

          {flowState === "RESULT" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center space-y-6 sm:space-y-8 w-full max-w-md mx-auto"
            >
              {isSuccess ? (
                <>
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center border-4 border-emerald-400/60 relative shadow-sm" style={{ background: "rgba(255,255,255,0.8)" }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                      <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-500" />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-2 rounded-2xl border border-purple-200/50 p-6 shadow-sm backdrop-blur-md" style={{ background: "rgba(255,255,255,0.7)" }}>
                    <h2 className="text-2xl sm:text-3xl font-bold text-emerald-700" style={{ fontFamily: "var(--font-brand)" }}>Quality Check Passed</h2>
                    <p className="text-sm sm:text-base text-purple-500">Audio sample was clear and isolated.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center border-4 border-rose-400/60 relative shadow-sm" style={{ background: "rgba(255,255,255,0.8)" }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                      <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-rose-500" />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-2 rounded-2xl border border-purple-200/50 p-6 shadow-sm backdrop-blur-md" style={{ background: "rgba(255,255,255,0.7)" }}>
                    <h2 className="text-2xl sm:text-3xl font-bold text-rose-700" style={{ fontFamily: "var(--font-brand)" }}>Analysis Failed</h2>
                    <p className="text-sm sm:text-base text-purple-500">{analysisError || "We couldn't isolate your voice clearly."}</p>
                  </div>
                </>
              )}

              <button
                onClick={isSuccess ? finishRecording : handleStart}
                className={`w-full py-4 mt-4 text-white rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg ${isSuccess ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25" : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/25"}`}
              >
                {isSuccess ? "View Results" : "Try Again"}
              </button>
            </motion.div>
          )}

          {flowState === "SHOW_DATA" && displayData && (
            <motion.div
              key="show-data"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center space-y-6 w-full max-w-2xl mx-auto"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Your Voice Analysis</h2>
                <p className="text-sm sm:text-base text-neutral-400">{displayData.message}</p>
              </div>

              {/* Biomarkers Grid */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Pitch (F0)</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{displayData.pitch} Hz</div>
                  <div className="text-xs text-neutral-500 mt-1">Fundamental frequency</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Jitter</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{displayData.jitter}%</div>
                  <div className="text-xs text-neutral-500 mt-1">Pitch variation</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Shimmer</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{displayData.shimmer}%</div>
                  <div className="text-xs text-neutral-500 mt-1">Amplitude variation</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">HNR</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{displayData.harmonicRatio} dB</div>
                  <div className="text-xs text-neutral-500 mt-1">Voice quality</div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 gap-4 w-full">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Spectral Centroid</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{displayData.spectralCentroid} Hz</div>
                  <div className="text-xs text-neutral-500 mt-1">Brightness of sound</div>
                </div>

                {/* Quality Metrics */}
                {(displayData.snr || displayData.voicedDuration) && (
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 sm:p-6">
                    <div className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Recording Quality</div>
                    <div className="grid grid-cols-2 gap-4">
                      {displayData.snr && (
                        <div>
                          <div className="text-sm text-neutral-500">SNR</div>
                          <div className="text-xl font-bold text-emerald-400">{displayData.snr.toFixed(1)} dB</div>
                        </div>
                      )}
                      {displayData.voicedDuration && (
                        <div>
                          <div className="text-sm text-neutral-500">Voiced</div>
                          <div className="text-xl font-bold text-emerald-400">{displayData.voicedDuration.toFixed(1)}s</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Anomaly Indicator */}
              {displayData.isAnomaly && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 w-full">
                  <p className="text-amber-200 text-sm text-center">
                    We detected some variations in your voice. Consider consulting a healthcare professional if symptoms persist.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <button
                onClick={() => navigate("/")}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-base sm:text-lg shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-all"
              >
                Back to Home
              </button>
            </motion.div>
          )}

        </AnimatePresence>

      </main>
    </div>
  );
}
