import { useState } from "react";
import { useNavigate } from "react-router";
import { useAppContext } from "../../AppContext";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ChevronRight, Activity, ShieldCheck, HeartPulse } from "lucide-react";

export function Onboarding() {
  const { userData, setUserData } = useAppContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({ age: "", gender: "", smoking: "No", voiceDisorders: "None" });

  const handleNext = () => {
    if (step === 1 && !agreed) return;
    if (step === 1) setStep(2);
    else {
      setUserData({ ...userData, optedIn: true, demographics: form, hasRecordedToday: false });
      navigate("/");
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-50 p-6 overflow-y-auto relative z-10">
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col flex-1">
            <div className="flex-1 space-y-8 mt-12">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center">
                  <Activity className="w-10 h-10 text-indigo-400" />
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-center">Bridge2AI Study</h1>
              <p className="text-neutral-400 text-center leading-relaxed">
                We're mapping voice biomarkers to predict health changes. Your daily recordings help build the future of diagnostic medicine with unprecedented accuracy.
              </p>
              
              <div className="space-y-4 bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800">
                <div className="flex gap-3 items-start">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-neutral-300">Your voice data is encrypted and completely anonymized.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <HeartPulse className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-neutral-300">Discover early signs of vocal strain or fatigue before it happens.</p>
                </div>
              </div>

              <label className="flex gap-3 items-center p-4 bg-neutral-900 rounded-2xl border border-neutral-800 cursor-pointer hover:border-indigo-500/50 transition-colors">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${agreed ? "bg-indigo-500 border-indigo-500 text-white" : "border-neutral-600 text-transparent"}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-sm text-neutral-200">I agree to contribute to the Bridge2AI voice study.</span>
                <input type="checkbox" className="hidden" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              </label>
            </div>

            <button
              onClick={handleNext}
              disabled={!agreed}
              className="w-full mt-8 py-4 bg-indigo-500 text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex justify-center items-center gap-2"
            >
              Continue <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col flex-1">
            <div className="flex-1 space-y-6 mt-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">About You</h1>
                <p className="text-neutral-400 mt-2">To contextualize your biomarkers, we need a few baseline details.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Age</label>
                  <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. 28" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Biological Sex</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors appearance-none">
                    <option value="" disabled>Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Smoking History</label>
                  <select value={form.smoking} onChange={(e) => setForm({ ...form, smoking: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors appearance-none">
                    <option value="No">Never</option>
                    <option value="Past">Former</option>
                    <option value="Current">Current</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">History of Voice Disorders</label>
                  <input type="text" value={form.voiceDisorders} onChange={(e) => setForm({ ...form, voiceDisorders: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Nodules, Polyps (or None)" />
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!form.age || !form.gender}
              className="w-full mt-8 py-4 bg-indigo-500 text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex justify-center items-center gap-2"
            >
              Complete Calibration <CheckCircle2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
