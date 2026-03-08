import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, X, Activity, Zap, TrendingUp, WavesIcon, Radio } from "lucide-react";

const GLOSSARY_TERMS = [
  {
    term: "Pitch (Fundamental Frequency)",
    icon: Activity,
    color: "indigo",
    definition: "The perceived frequency of your voice, measured in Hertz (Hz). It's what makes voices sound 'high' or 'low'.",
    clinicalSignificance: "Changes in pitch can indicate vocal cord tension, inflammation, or neurological conditions affecting voice control.",
    normalRange: "Adult males: 85-180 Hz, Adult females: 165-255 Hz",
  },
  {
    term: "Jitter",
    icon: TrendingUp,
    color: "amber",
    definition: "The cycle-to-cycle variation in the frequency of vocal fold vibration. It measures how consistently your vocal cords vibrate.",
    clinicalSignificance: "Elevated jitter can indicate vocal cord irregularities, muscle tension, or early signs of neurological disorders like Parkinson's disease.",
    normalRange: "Healthy voices: < 1.04% (typically 0.5-1.0%)",
  },
  {
    term: "Shimmer",
    icon: Zap,
    color: "emerald",
    definition: "The cycle-to-cycle variation in the amplitude (loudness) of vocal fold vibration. It measures stability in voice volume.",
    clinicalSignificance: "Increased shimmer can suggest vocal cord lesions, inflammation, or incomplete glottal closure affecting voice quality.",
    normalRange: "Healthy voices: < 3.81% (typically 2-3.5%)",
  },
  {
    term: "Spectral Centroid",
    icon: WavesIcon,
    color: "cyan",
    definition: "The 'center of mass' of the sound spectrum, indicating where most of the sound energy is concentrated in terms of frequency.",
    clinicalSignificance: "Changes can reflect alterations in vocal tract shape or resonance patterns, useful for tracking voice quality over time.",
    normalRange: "Varies by individual; consistency is more important than absolute values",
  },
  {
    term: "Harmonic-to-Noise Ratio (HNR)",
    icon: Radio,
    color: "purple",
    definition: "The ratio of harmonic (periodic) sound to noise (aperiodic) sound in your voice. Higher values indicate a clearer, more tonal voice.",
    clinicalSignificance: "Low HNR values can indicate breathiness, hoarseness, or vocal pathology affecting voice clarity.",
    normalRange: "Healthy voices: > 13 dB (typically 15-25 dB)",
  },
];

export function VoiceTermsGlossary() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Help Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-full shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center transition-all group"
      >
        <HelpCircle className="w-7 h-7 text-white group-hover:rotate-12 transition-transform" />
      </motion.button>

      {/* Glossary Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800 px-6 py-5 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-2xl font-black text-white mb-1">Voice Biomarker Glossary</h2>
                  <p className="text-sm text-neutral-400">Clinical vocal terms explained</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] px-6 py-6 space-y-6">
                {GLOSSARY_TERMS.map((item, idx) => {
                  const Icon = item.icon;
                  const colorClasses = {
                    indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', ring: 'ring-indigo-500/50' },
                    amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', ring: 'ring-amber-500/50' },
                    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', ring: 'ring-emerald-500/50' },
                    cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', ring: 'ring-cyan-500/50' },
                    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', ring: 'ring-purple-500/50' },
                  }[item.color];

                  return (
                    <motion.div
                      key={item.term}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`${colorClasses.bg} border ${colorClasses.border} rounded-2xl p-6 hover:ring-2 ${colorClasses.ring} transition-all`}
                    >
                      {/* Term Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`w-12 h-12 ${colorClasses.bg} border ${colorClasses.border} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-6 h-6 ${colorClasses.text}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-xl font-bold ${colorClasses.text} mb-2`}>{item.term}</h3>
                          <p className="text-neutral-300 leading-relaxed text-sm">{item.definition}</p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3 pl-16">
                        <div>
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Clinical Significance
                          </div>
                          <p className="text-sm text-neutral-400 leading-relaxed">
                            {item.clinicalSignificance}
                          </p>
                        </div>

                        <div className="bg-neutral-900/50 rounded-lg px-4 py-3">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Normal Range
                          </div>
                          <p className={`text-sm font-medium ${colorClasses.text}`}>
                            {item.normalRange}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Footer Note */}
                <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-2xl p-5 mt-8">
                  <h4 className="text-sm font-bold text-white mb-2">Important Note</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    These biomarkers are for informational and research purposes only. They are not intended for
                    medical diagnosis. If you have concerns about your voice or health, please consult with a
                    healthcare professional or speech-language pathologist.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
