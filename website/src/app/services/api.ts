/**
 * API Service for Voice Health Analysis
 * Interfaces with the Flask backend ML pipeline
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Backend response shapes (match Flask response.py) ──────────────────────

/** Raw envelope returned by the Flask API */
interface ApiEnvelope {
  status: 'success' | 'error';
  code: number;
  message: string;
  data: Record<string, any> | null;
  errors: {
    type: string;
    suggestion?: string;
    failed_checks?: any[];
    passed_checks?: any[];
    warnings?: any[];
  } | null;
  meta: {
    request_id: string;
    timestamp: string;
    processing_time_ms: number;
  };
}

/** A single condition prediction from the ML pipeline */
export interface ConditionPrediction {
  condition: string;
  condition_name: string;
  probability: number;        // 0.0–1.0
  probability_percent: number; // 0–100
  severity_tier: 'low' | 'moderate' | 'elevated' | 'high';
  features_used: string[];
  feature_values: Record<string, number>;
  reference_thresholds: Record<string, any>;
}

/** Explanation from the analysis pipeline */
export interface Explanation {
  summary: string;
  details?: string;
  disclaimer?: string;
  model_version?: string;
  flag?: 'green' | 'yellow' | 'orange' | 'red';
  flag_label?: string;
  recommendation?: string;
  probability_percent?: number;
}

/** A voice task definition */
export interface TaskItem {
  id: string;
  display_name: string;
  instruction: string;
  prompt_text?: string;
  min_duration_sec: number;
}

// ─── Frontend-friendly shapes ────────────────────────────────────────────────

export interface AnalysisResult {
  success: boolean;
  data?: {
    quality: Record<string, any>;
    preprocessing?: Record<string, any>;
    features: Record<string, number>;
    predictions: ConditionPrediction[];
    explanation: Explanation;
  };
  error?: {
    type: string;
    message: string;
    suggestion?: string;
  };
  requestId: string;
  processingTimeMs?: number;
}

export interface HealthCheckResult {
  success: boolean;
  data?: {
    version: string;
    model_loaded: boolean;
    model_version: string;
    gpu_available: boolean;
  };
  message: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Analyze audio file using the ML pipeline.
 * Maps the Flask envelope into a typed AnalysisResult.
 */
export async function analyzeAudio(
  audioBlob: Blob,
  options: {
    deviceId?: string;
    taskType?: 'prolonged_vowel' | 'max_phonation_time' | 'glides' | 'harvard_sentences' | 'loudness';
    silenceDuration?: number;
  } = {}
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('device_id', options.deviceId || 'web_app');
  formData.append('task_type', options.taskType || 'prolonged_vowel');
  formData.append('silence_duration_sec', String(options.silenceDuration || 0.5));

  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: formData,
    });

    const envelope: ApiEnvelope = await response.json();

    if (envelope.status !== 'success' || !envelope.data) {
      return {
        success: false,
        error: {
          type: envelope.errors?.type || 'unknown_error',
          message: envelope.message || 'Analysis failed',
          suggestion: envelope.errors?.suggestion,
        },
        requestId: envelope.meta?.request_id || 'unknown',
      };
    }

    return {
      success: true,
      data: {
        quality: envelope.data.quality,
        preprocessing: envelope.data.preprocessing,
        features: envelope.data.features,
        predictions: envelope.data.predictions,
        explanation: envelope.data.explanation,
      },
      requestId: envelope.meta.request_id,
      processingTimeMs: envelope.meta.processing_time_ms,
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: {
        type: 'network_error',
        message: error instanceof Error ? error.message : 'Network error occurred',
        suggestion: 'Please check your connection and ensure the backend server is running.',
      },
      requestId: 'local_error',
    };
  }
}

/**
 * Validate audio quality without full analysis.
 */
export async function validateAudio(
  audioBlob: Blob,
  options: {
    deviceId?: string;
    taskType?: 'prolonged_vowel' | 'max_phonation_time' | 'glides' | 'harvard_sentences' | 'loudness';
    silenceDuration?: number;
  } = {}
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('device_id', options.deviceId || 'web_app');
  formData.append('task_type', options.taskType || 'prolonged_vowel');
  formData.append('silence_duration_sec', String(options.silenceDuration || 0.5));

  try {
    const response = await fetch(`${API_BASE_URL}/validate`, {
      method: 'POST',
      body: formData,
    });

    const envelope: ApiEnvelope = await response.json();

    if (envelope.status !== 'success') {
      return {
        success: false,
        error: {
          type: envelope.errors?.type || 'unknown_error',
          message: envelope.message || 'Validation failed',
          suggestion: envelope.errors?.suggestion,
        },
        requestId: envelope.meta?.request_id || 'unknown',
      };
    }

    return {
      success: true,
      data: {
        quality: envelope.data?.quality || {},
        features: {},
        predictions: [],
        explanation: { summary: '' },
      },
      requestId: envelope.meta.request_id,
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: {
        type: 'network_error',
        message: error instanceof Error ? error.message : 'Network error occurred',
      },
      requestId: 'local_error',
    };
  }
}

/**
 * Check server health.
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const envelope: ApiEnvelope = await response.json();
    return {
      success: envelope.status === 'success',
      data: envelope.data as any,
      message: envelope.message,
    };
  } catch {
    return {
      success: false,
      message: 'Server unavailable',
    };
  }
}

/**
 * Run demo mode - uses the sample audio file from the server.
 * Fetches the sample file and runs it through the analysis pipeline.
 */
export async function runDemoAnalysis(): Promise<AnalysisResult> {
  try {
    // Fetch the sample audio file from the server
    const sampleResponse = await fetch('/samples/Voice%20260307_182607.m4a');

    if (!sampleResponse.ok) {
      return {
        success: false,
        error: {
          type: 'demo_error',
          message: 'Failed to fetch demo audio file',
          suggestion: 'Ensure the server is running and the sample file exists.',
        },
        requestId: 'demo_error',
      };
    }

    const audioBlob = await sampleResponse.blob();

    // Run the analysis with the sample file
    return await analyzeAudio(audioBlob, {
      deviceId: 'demo_mode',
      taskType: 'prolonged_vowel',
      silenceDuration: 0.5,
    });
  } catch (error) {
    console.error('Demo Mode Error:', error);
    return {
      success: false,
      error: {
        type: 'demo_error',
        message: error instanceof Error ? error.message : 'Demo mode failed',
        suggestion: 'Please ensure the backend server is running.',
      },
      requestId: 'demo_error',
    };
  }
}

// ─── Helper functions ────────────────────────────────────────────────────────

/**
 * Convert ML feature dict into user-friendly biomarker values.
 *
 * Searches multiple possible key names for each biomarker because
 * the backend feature dict key names depend on the extraction path
 * (senselab B2AI vs Praat fallback).
 */
export function extractBiomarkers(features: Record<string, number>) {
  const get = (keys: string[], fallback: number): number => {
    for (const k of keys) {
      if (features[k] !== undefined && features[k] !== null && !isNaN(features[k])) {
        return features[k];
      }
    }
    console.warn(`No valid feature found for keys: ${keys.join(', ')}, using fallback: ${fallback}`);
    return fallback;
  };

  // F0 (Pitch) - OpenSMILE and Praat both provide this
  const pitch = get(
    [
      'opensmile.F0semitoneFrom27.5Hz_sma3nz_amean',  // OpenSMILE F0 mean
      'praat.pitch.f0_mean_hz',                        // Praat F0 mean
      'praat.f0.mean_hz',
      'pitch_mean',
      'f0_mean'
    ],
    210
  );

  // Jitter - Local jitter percentage
  const jitter = get(
    [
      'praat.jitter.local_percent',
      'praat.jitter.rap_percent',
      'jitter_local'
    ],
    1.2
  );

  // Shimmer - Local shimmer percentage
  const shimmer = get(
    [
      'praat.shimmer.local_percent',
      'praat.shimmer.apq3_percent',
      'shimmer_local'
    ],
    3.4
  );

  // HNR (Harmonics-to-Noise Ratio)
  const hnr = get(
    [
      'praat.hnr.mean_db',
      'praat.harmonicity.mean',
      'hnr_mean'
    ],
    18.5
  );

  // Spectral Centroid
  const spectral = get(
    [
      'opensmile.spectralFlux_sma3_amean',
      'spectral_centroid_mean',
      'praat.spectral_centroid.mean'
    ],
    1500
  );

  // Log what we found for debugging
  console.log('Extracted biomarkers:', {
    pitch: Math.round(pitch),
    jitter: Number(jitter.toFixed(2)),
    shimmer: Number(shimmer.toFixed(2)),
    harmonicRatio: Number(hnr.toFixed(1)),
    spectralCentroid: Math.round(spectral),
  });

  return {
    pitch: Math.round(pitch),
    jitter: Number(jitter.toFixed(2)),
    shimmer: Number(shimmer.toFixed(2)),
    harmonicRatio: Number(hnr.toFixed(1)),
    spectralCentroid: Math.round(spectral),
  };
}

/**
 * Derive a user-facing message from the ML predictions array and
 * the LLM explanation object.
 */
export function generateMessage(
  predictions: ConditionPrediction[],
  explanation: Explanation
): {
  message: string;
  isAnomaly: boolean;
  flag: 'green' | 'yellow' | 'orange' | 'red';
  flagLabel: string;
  recommendation: string;
  probabilityPercent: number;
  details: string;
} {
  if (!predictions?.length || !explanation) {
    return {
      message: 'Analysis complete. Your voice metrics are within normal range.',
      isAnomaly: false,
      flag: 'green',
      flagLabel: 'Healthy',
      recommendation: '',
      probabilityPercent: 0,
      details: '',
    };
  }

  const isAnomaly = predictions.some(
    (p) => p.severity_tier !== 'low'
  );

  const message = explanation.summary || 'Your voice analysis is complete.';

  return {
    message,
    isAnomaly,
    flag: explanation.flag || 'green',
    flagLabel: explanation.flag_label || 'Healthy',
    recommendation: explanation.recommendation || '',
    probabilityPercent: explanation.probability_percent || 0,
    details: explanation.details || '',
  };
}

/**
 * Get available tasks from the server
 */
export async function getTasks(): Promise<TaskItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    const envelope: ApiEnvelope = await response.json();
    return envelope.data?.tasks || [];
  } catch (error) {
    console.error('API Error: Failed to fetch tasks', error);
    return [];
  }
}
