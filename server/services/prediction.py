"""
ML Prediction Service
Placeholder for machine learning model integration.
"""
from typing import List


# Model state
_model = None
_model_version = "b2ai-voice-v0.1.0-dummy"  # Using realistic dummy predictions


def load_model():
    """Load the ML model into memory. Called once at server startup."""
    global _model
    # TODO: Replace with actual model loading
    # Example: _model = torch.load("models/b2ai_v1.pt")
    _model = None  # Placeholder


def get_model_status() -> dict:
    """Get model status for health check endpoint."""
    return {
        "version": "1.0.0",
        "model_loaded": _model is not None,
        "model_version": _model_version,
        "gpu_available": False
    }


# Condition configuration - Single condition: Benign Lesions
CONDITION_CONFIGS = {
    "benign_lesion": {
        "display_name": "Benign Lesion",
        "features": {
            # Voice quality indicators for benign lesions
            # Multiple paths to handle both SenseLab and Praat fallback extraction
            "jitter": [
                "praat_parselmouth.local_jitter",           # SenseLab wrapper (fraction 0-1)
                "praat.jitter.local_percent",               # Praat fallback (percent)
                "praat.jitter.local.mean"
            ],
            "shimmer": [
                "praat_parselmouth.localDB_shimmer",        # SenseLab wrapper (dB)
                "praat.shimmer.local_percent",              # Praat fallback (percent)
                "praat.shimmer.local.mean"
            ],
            "hnr": [
                "praat_parselmouth.mean_hnr_db",            # SenseLab wrapper
                "praat.hnr.mean_db",                        # Praat fallback
                "praat.harmonicity.mean"
            ],
            "cpp": [
                "praat_parselmouth.cepstral_peak_prominence_mean",  # SenseLab wrapper (actual key)
                "praat_parselmouth.mean_cpp",                       # Alternative
                "praat.cpp.mean_db",                                # Praat fallback
                "praat.cepstrum.cpp.mean"
            ],
        },
        "reference_thresholds": {
            "jitter_local_percent": {"normal_max": 1.04, "source": "Teixeira et al., 2013"},
            "shimmer_local_db": {"normal_max": 0.35, "source": "Teixeira et al., 2013 (dB units)"},
            "shimmer_local_percent": {"normal_max": 3.81, "source": "Teixeira et al., 2013 (percent units)"},
            "hnr_db": {"normal_min": 20.0, "source": "Boersma, 1993"},
            "cpp_db": {"normal_min": 8.0, "source": "Heman-Ackah et al., 2003"},
        }
    }
}


# Task-to-condition mapping - All tasks check for benign lesions
TASK_CONDITIONS = {
    "prolonged_vowel": ["benign_lesion"],
    "max_phonation_time": ["benign_lesion"],
    "glides": ["benign_lesion"],
    "harvard_sentences": ["benign_lesion"],
    "loudness": ["benign_lesion"],
}


def _generate_dummy_prediction(condition_id: str, feature_values: dict, config: dict) -> float:
    """
    Generate realistic dummy probability for benign lesion detection.

    This creates a believable probability (0.0-1.0) by comparing voice quality
    features to clinical thresholds. When features show voice quality issues
    (elevated jitter/shimmer, reduced HNR/CPP), probability of benign lesion increases.

    Returns:
        probability: Float between 0.0 and 1.0 (probability of benign lesion)
    """
    import random
    import numpy as np

    # Seed based on feature values for consistency (same audio = same prediction)
    feature_sum = sum(abs(v) for v in feature_values.values() if v != 0)
    random.seed(int(feature_sum * 1000) % 10000)
    np.random.seed(int(feature_sum * 1000) % 10000)

    # Extract features
    jitter = feature_values.get("jitter", 0)
    shimmer = feature_values.get("shimmer", 0)
    hnr = feature_values.get("hnr", 0)
    cpp = feature_values.get("cpp", 0)

    # Calculate abnormality score (0-100)
    score = 0.0
    count = 0

    # Jitter: normal < 1.04%, benign lesions often show elevated jitter
    if jitter > 0:
        jitter_abnormal = max(0, (jitter - 1.04) / 3.0)  # Scale above threshold
        score += min(jitter_abnormal * 35, 45)
        count += 1

    # Shimmer: normal < 0.35 dB or < 3.81%, benign lesions cause amplitude perturbation
    if shimmer > 0:
        # Detect if shimmer is in dB (< 5) or percent (> 5)
        if shimmer < 5:  # dB units
            shimmer_abnormal = max(0, (shimmer - 0.35) / 1.0)
        else:  # Percent units
            shimmer_abnormal = max(0, (shimmer - 3.81) / 6.0)
        score += min(shimmer_abnormal * 30, 40)
        count += 1

    # HNR: normal > 20 dB, reduced HNR indicates mass on vocal folds
    if hnr > 0:
        hnr_abnormal = max(0, (20 - hnr) / 10.0)
        score += min(hnr_abnormal * 25, 35)
        count += 1

    # CPP: normal > 8 dB, reduced CPP indicates irregular vibration
    if cpp > 0:
        cpp_abnormal = max(0, (8 - cpp) / 4.0)
        score += min(cpp_abnormal * 30, 40)
        count += 1

    # Average the scores
    if count > 0:
        score = score / count

    # Log the scoring breakdown
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Abnormality scoring: jitter={jitter:.2f}, shimmer={shimmer:.2f}, hnr={hnr:.2f}, cpp={cpp:.2f}")
    logger.info(f"Raw score: {score:.2f}/100 (from {count} features)")

    # Add small random variation for realism
    random_variation = np.random.uniform(-3, 3)
    score += random_variation
    logger.info(f"Score after random variation (+{random_variation:.2f}): {score:.2f}/100")

    # Convert score (0-100) to probability (0.0-1.0)
    # Clamp to realistic range (5%-85% probability)
    probability = max(0.05, min(0.85, score / 100.0))
    logger.info(f"Final probability (clamped 5-85%): {probability:.4f} = {probability*100:.1f}%")

    # Reset random seed
    random.seed()
    np.random.seed()

    return probability


def _get_feature_value(features: dict, feature_paths: list) -> float:
    """
    Extract feature value from B2AI feature dict using multiple possible paths.
    Handles unit conversion where needed (e.g., fraction to percent).

    Args:
        features: Flattened feature dictionary
        feature_paths: List of possible paths to try (in order of preference)

    Returns:
        Feature value, or 0.0 if not found
    """
    for path in feature_paths:
        if path in features:
            value = float(features[path])

            # Unit conversion: SenseLab jitter/shimmer are fractions (0-1), we need percent
            if "local_jitter" in path and value < 10:  # If value is < 10, it's likely a fraction
                value = value * 100  # Convert to percent

            return value
    return 0.0


def predict(features: dict, task_type: str) -> List[dict]:
    """
    Run prediction for all conditions relevant to the given task.

    Returns a list of prediction dicts, one per condition.

    TODO: Replace placeholder logic with actual model inference.
    """
    import logging
    logger = logging.getLogger(__name__)

    conditions = TASK_CONDITIONS.get(task_type, [])
    predictions = []

    for condition_id in conditions:
        config = CONDITION_CONFIGS.get(condition_id)
        if config is None:
            continue

        # Extract feature values (works with both B2AI and Praat fallback)
        feature_values = {}
        for feature_name, feature_paths in config["features"].items():
            feature_values[feature_name] = _get_feature_value(features, feature_paths)

        # Debug: Log what features we actually found
        logger.info(f"Prediction features extracted: {feature_values}")
        logger.info(f"Available feature keys (first 10): {list(features.keys())[:10]}")

        # DUMMY DATA GENERATOR: Generates realistic probability based on features
        # When your model is ready, replace this with:
        #   feature_vector = list(feature_values.values())
        #   probability = _model.predict_proba([feature_vector])[0][1]  # Probability of benign lesion
        probability = _generate_dummy_prediction(condition_id, feature_values, config)

        # Convert probability to percentage for display
        probability_percent = probability * 100

        # Severity tier based on probability
        if probability < 0.25:
            severity = "low"
        elif probability < 0.50:
            severity = "moderate"
        elif probability < 0.75:
            severity = "elevated"
        else:
            severity = "high"

        predictions.append({
            "condition": condition_id,
            "condition_name": config["display_name"],
            "probability": round(probability, 4),  # Raw probability (0.0-1.0)
            "probability_percent": round(probability_percent, 2),  # Percentage (0-100)
            "severity_tier": severity,
            "features_used": list(feature_values.keys()),
            "feature_values": feature_values,
            "reference_thresholds": config["reference_thresholds"]
        })

    return predictions
