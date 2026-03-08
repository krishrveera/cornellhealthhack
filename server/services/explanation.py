"""
Explanation Service
Deterministic flag-based explanations from ML probability scores.
"""


# Flag definitions by severity tier
FLAGS = {
    "green": {
        "flag": "green",
        "label": "Healthy",
        "summary": (
            "Your voice has been analyzed by our trained ensemble classifier. "
            "The model predicts a low probability of benign vocal fold lesions. "
            "Everything looks good — keep taking care of your voice!"
        ),
        "recommendation": "No action needed. Stay hydrated and maintain healthy vocal habits!",
    },
    "yellow": {
        "flag": "yellow",
        "label": "Minor Variations",
        "summary": (
            "Your voice analysis is complete. Some minor variations were detected, but nothing "
            "outside what's commonly seen day-to-day. Stay hydrated and consider monitoring over time."
        ),
        "recommendation": (
            "Stay hydrated, avoid excessive throat clearing, and try to rest your voice "
            "if it feels strained. Monitor over the next few recordings."
        ),
    },
    "orange": {
        "flag": "orange",
        "label": "Worth Monitoring",
        "summary": (
            "Your voice shows some patterns that may be worth keeping an eye on. This doesn't mean "
            "anything is wrong — many factors like fatigue, allergies, or dehydration can affect these readings."
        ),
        "recommendation": (
            "Consider scheduling a voice checkup if you notice hoarseness, vocal fatigue, or "
            "discomfort that persists for more than two weeks. In the meantime, stay hydrated "
            "and give your voice regular breaks."
        ),
    },
    "red": {
        "flag": "red",
        "label": "See a Specialist",
        "summary": (
            "Our screening model indicates a high probability of benign vocal fold lesions "
            "(such as nodules or polyps). This does not confirm a diagnosis, but we strongly "
            "recommend consulting a specialist for a proper evaluation."
        ),
        "recommendation": (
            "Please see an ENT (ear, nose, and throat) specialist or a voice therapist "
            "as soon as possible for a professional assessment. Benign lesions are very "
            "treatable, especially when caught early."
        ),
    },
}


def _get_flag(probability_percent: float) -> str:
    """Map probability percentage to a flag color."""
    if probability_percent >= 75:
        return "red"
    elif probability_percent >= 50:
        return "orange"
    elif probability_percent >= 25:
        return "yellow"
    else:
        return "green"


def generate_explanation(features: dict, predictions: list, task_type: str) -> dict:
    """
    Generate a deterministic flag-based explanation from ML prediction results.
    """
    probability = 0
    feature_vals = {}
    if predictions:
        probability = predictions[0].get("probability_percent", 0)
        feature_vals = predictions[0].get("feature_values", {})

    flag_color = _get_flag(probability)
    flag = FLAGS[flag_color]

    # Build details from feature values
    jitter = feature_vals.get("jitter", 0)
    shimmer = feature_vals.get("shimmer", 0)
    hnr = feature_vals.get("hnr", 0)

    details_parts = []
    if jitter > 0:
        details_parts.append(f"Voice stability (jitter): {jitter:.3f}")
    if shimmer > 0:
        details_parts.append(f"Amplitude variation (shimmer): {shimmer:.2f} dB")
    if hnr > 0:
        status = "good clarity" if hnr > 20 else "slightly reduced clarity"
        details_parts.append(f"Voice clarity (HNR): {hnr:.1f} dB ({status})")

    details = ", ".join(details_parts) if details_parts else "Voice features analyzed."

    return {
        "flag": flag["flag"],
        "flag_label": flag["label"],
        "summary": flag["summary"],
        "details": details,
        "recommendation": flag["recommendation"],
        "probability_percent": round(probability, 1),
        "disclaimer": (
            "This analysis is for informational and screening purposes only. "
            "It is not a medical diagnosis. If you have concerns about your "
            "voice or health, please consult a healthcare professional."
        ),
        "model_version": "b2ai-voice-v1.0.0",
    }


def generate_quality_failure_suggestion(gate_result: dict) -> str:
    """Generate helpful suggestion when quality gate fails."""
    failed = gate_result["failed_checks"]

    templates = {
        "snr": "Try recording in a quieter room. Close windows and doors, turn off fans or air conditioning, and hold the phone about 15-20 cm from your mouth.",
        "clipping": "The volume was too high. Try holding the phone slightly further from your mouth, or speak at a slightly lower volume.",
        "voiced_duration": "We need a longer recording. Make sure to sustain the sound for the full duration shown on screen.",
        "silence_region": "Make sure to stay completely quiet during the countdown before you start speaking.",
    }

    if len(failed) == 1:
        return templates.get(failed[0]["check"], "Please try recording again.")

    # Multiple failures — combine relevant tips
    tips = [templates.get(c["check"], "") for c in failed]
    tips = [t for t in tips if t]
    return " ".join(tips) if tips else "Please try recording again in a quieter environment with proper technique."
