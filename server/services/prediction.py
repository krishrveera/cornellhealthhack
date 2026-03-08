"""
ML Prediction Service
Uses the trained Voting Ensemble (SVM + RF + XGBoost) classifier.
"""
import os
import logging
from typing import List

import joblib
import numpy as np

logger = logging.getLogger(__name__)

# Model state
_model_data = None
_model_version = "b2ai-voice-v1.0.0"

# Prefix mapping: real-time features have prefixes, training data does not
_PREFIX_MAP = {
    "opensmile.": "",
    "praat_parselmouth.": "",
    "torchaudio_squim.": "",
}


def load_model():
    """Load the trained model into memory. Called once at server startup."""
    global _model_data
    model_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "models", "voice_classifier.joblib"
    )
    if os.path.exists(model_path):
        _model_data = joblib.load(model_path)
        metrics = _model_data.get("metrics", {})
        logger.info(
            f"Model loaded: {model_path} "
            f"({len(_model_data['feature_names'])} features, "
            f"accuracy={metrics.get('accuracy', 0):.4f}, "
            f"AUC={metrics.get('auc_roc', 0):.4f})"
        )
    else:
        logger.warning(f"Model not found at {model_path}. Run classifier.py to train.")
        _model_data = None


def get_model_status() -> dict:
    """Get model status for health check endpoint."""
    loaded = _model_data is not None
    metrics = _model_data.get("metrics", {}) if loaded else {}
    return {
        "version": "1.0.0",
        "model_loaded": loaded,
        "model_version": _model_version,
        "gpu_available": False,
        "accuracy": metrics.get("accuracy"),
        "auc_roc": metrics.get("auc_roc"),
    }


# Task-to-condition mapping
TASK_CONDITIONS = {
    "prolonged_vowel": ["benign_lesion"],
    "max_phonation_time": ["benign_lesion"],
    "glides": ["benign_lesion"],
    "harvard_sentences": ["benign_lesion"],
    "loudness": ["benign_lesion"],
}

# Reference thresholds for response context
REFERENCE_THRESHOLDS = {
    "jitter_local_percent": {"normal_max": 1.04, "source": "Teixeira et al., 2013"},
    "shimmer_local_db": {"normal_max": 0.35, "source": "Teixeira et al., 2013 (dB units)"},
    "hnr_db": {"normal_min": 20.0, "source": "Boersma, 1993"},
    "cpp_db": {"normal_min": 8.0, "source": "Heman-Ackah et al., 2003"},
}


def _strip_prefix(key: str) -> str:
    """Strip the extraction prefix from a feature key."""
    for prefix in _PREFIX_MAP:
        if key.startswith(prefix):
            return key[len(prefix):]
    return key


def _build_feature_vector(features: dict) -> np.ndarray:
    """
    Build a feature vector matching the training data column order.
    Maps real-time prefixed keys to unprefixed training column names.
    Missing features are set to NaN (the pipeline's imputer handles them).
    """
    feature_names = _model_data["feature_names"]

    # Build a lookup from unprefixed name -> value
    unprefixed = {}
    for key, value in features.items():
        stripped = _strip_prefix(key)
        unprefixed[stripped] = float(value)

    # Create vector in training column order
    vector = []
    matched = 0
    for col in feature_names:
        if col in unprefixed:
            vector.append(unprefixed[col])
            matched += 1
        else:
            vector.append(np.nan)  # Imputer will fill with training mean

    logger.info(f"Feature mapping: {matched}/{len(feature_names)} features matched")
    return np.array([vector])


def predict(features: dict, task_type: str) -> List[dict]:
    """
    Run prediction using the trained ensemble classifier.
    Returns a list of prediction dicts, one per condition.
    """
    conditions = TASK_CONDITIONS.get(task_type, [])
    predictions = []

    for condition_id in conditions:
        if condition_id != "benign_lesion":
            continue

        if _model_data is None:
            logger.warning("No model loaded, returning fallback prediction")
            probability = 0.05
        else:
            X = _build_feature_vector(features)
            pipe = _model_data["pipeline"]
            probability = float(pipe.predict_proba(X)[0][1])

        probability_percent = probability * 100

        if probability < 0.25:
            severity = "low"
        elif probability < 0.50:
            severity = "moderate"
        elif probability < 0.75:
            severity = "elevated"
        else:
            severity = "high"

        logger.info(f"Prediction: {probability*100:.1f}% benign lesion ({severity})")

        predictions.append({
            "condition": condition_id,
            "condition_name": "Benign Lesion",
            "probability": round(probability, 4),
            "probability_percent": round(probability_percent, 2),
            "severity_tier": severity,
            "features_used": _model_data["feature_names"][:5] if _model_data else [],
            "feature_values": {
                "jitter": features.get("praat_parselmouth.local_jitter", features.get("opensmile.jitterLocal_sma3nz_amean", 0)),
                "shimmer": features.get("praat_parselmouth.localDB_shimmer", features.get("opensmile.shimmerLocaldB_sma3nz_amean", 0)),
                "hnr": features.get("praat_parselmouth.mean_hnr_db", features.get("opensmile.HNRdBACF_sma3nz_amean", 0)),
                "cpp": features.get("praat_parselmouth.cepstral_peak_prominence_mean", 0),
            },
            "reference_thresholds": REFERENCE_THRESHOLDS,
        })

    return predictions
