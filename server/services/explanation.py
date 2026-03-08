"""
LLM Explanation Service
Generates human-readable explanations using OpenAI GPT, Google Gemini, or Anthropic Claude.
"""
import json
import os

# Try to import both LLM providers
try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


# Determine which LLM provider to use
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").lower()  # "gemini", "anthropic", or "openai"

# Initialize clients based on available API keys and provider preference
gemini_client = None
anthropic_client = None
openai_client = None

if GEMINI_AVAILABLE and os.environ.get("GOOGLE_API_KEY"):
    gemini_client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

if ANTHROPIC_AVAILABLE and os.environ.get("ANTHROPIC_API_KEY"):
    anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

if OPENAI_AVAILABLE and os.environ.get("OPENAI_API_KEY"):
    openai_client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def _call_gemini(prompt: str) -> str:
    """Call Google Gemini API using new google.genai package."""
    if gemini_client is None:
        raise ValueError("Gemini client not initialized")

    try:
        # Use the latest available Gemini flash model with JSON mode
        response = gemini_client.models.generate_content(
            model='models/gemini-3-flash-preview',
            contents=prompt,
            config={
                "temperature": 0.7,
                "response_mime_type": "application/json",  # Force JSON output
            }
        )

        # Check if response was truncated
        if response.candidates:
            finish_reason = str(response.candidates[0].finish_reason)
            if 'MAX_TOKENS' in finish_reason or 'LENGTH' in finish_reason:
                print(f"Warning: Gemini response was truncated ({finish_reason})")

        return response.text
    except Exception as e:
        print(f"Gemini API error: {e}")
        raise


def _call_anthropic(prompt: str) -> str:
    """Call Anthropic Claude API."""
    if anthropic_client is None:
        raise ValueError("Anthropic client not initialized")

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text


def _call_openai(prompt: str) -> str:
    """Call OpenAI GPT API."""
    if openai_client is None:
        raise ValueError("OpenAI client not initialized")

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI API error: {e}")
        raise


def _call_llm(prompt: str) -> str:
    """
    Call the configured LLM provider.

    Tries providers in this order:
    1. User's preferred provider (LLM_PROVIDER env var)
    2. OpenAI (if available)
    3. Gemini (if available)
    4. Anthropic (if available)
    5. Returns None if no provider available
    """
    # Try preferred provider first
    if LLM_PROVIDER == "openai" and openai_client:
        try:
            return _call_openai(prompt)
        except Exception:
            # Fall through to try other provider
            pass

    if LLM_PROVIDER == "gemini" and gemini_client:
        try:
            return _call_gemini(prompt)
        except Exception:
            # Fall through to try other provider
            pass

    if LLM_PROVIDER == "anthropic" and anthropic_client:
        try:
            return _call_anthropic(prompt)
        except Exception:
            pass

    # Try fallback providers in order of preference
    if openai_client and LLM_PROVIDER != "openai":
        try:
            return _call_openai(prompt)
        except Exception:
            pass

    if gemini_client and LLM_PROVIDER != "gemini":
        try:
            return _call_gemini(prompt)
        except Exception:
            pass

    if anthropic_client and LLM_PROVIDER != "anthropic":
        try:
            return _call_anthropic(prompt)
        except Exception:
            pass

    return None


def _build_hardcoded_explanation(features: dict, predictions: list, task_type: str) -> dict:
    """Build a data-driven explanation without calling an LLM."""
    # Extract key voice metrics (try multiple possible key names)
    def get(keys, default=None):
        for k in keys:
            if k in features and features[k] is not None:
                return features[k]
        return default

    jitter = get(['praat.jitter.local_percent', 'praat.jitter.local.mean', 'jitter_local'])
    shimmer = get(['praat.shimmer.local_percent', 'praat.shimmer.local.mean', 'shimmer_local'])
    hnr = get(['praat.hnr.mean_db', 'praat.harmonicity.mean', 'hnr_mean'])
    pitch = get(['praat.f0.mean_hz', 'pitch_mean', 'f0_mean'])

    # Build summary from predictions
    if predictions:
        elevated = [p for p in predictions if p.get('severity_tier') not in ('low',)]
        if not elevated:
            summary = "Your voice analysis looks healthy. All measured parameters fall within normal clinical ranges."
        else:
            conditions = [p.get('condition_name', p.get('condition', 'unknown')) for p in elevated]
            summary = (
                f"Your voice shows some characteristics worth noting. "
                f"Slightly elevated indicators were found for: {', '.join(conditions)}. "
                f"This does not mean you have a condition — many factors can influence these readings."
            )
    else:
        summary = "Your voice analysis is complete. Your voice features have been extracted and compared against clinical reference ranges."

    # Build details from actual feature values
    details_parts = []
    if pitch is not None:
        details_parts.append(f"Your fundamental frequency (pitch) was measured at {pitch:.0f} Hz")
    if jitter is not None:
        status = "within normal range (< 1.04%)" if jitter < 1.04 else "slightly elevated (normal < 1.04%)"
        details_parts.append(f"Jitter (voice stability) is {jitter:.2f}%, {status}")
    if shimmer is not None:
        status = "within normal range (< 3.81%)" if shimmer < 3.81 else "slightly elevated (normal < 3.81%)"
        details_parts.append(f"Shimmer (amplitude variation) is {shimmer:.2f}%, {status}")
    if hnr is not None:
        status = "indicating good voice clarity (normal > 20 dB)" if hnr > 20 else "slightly below typical range (normal > 20 dB)"
        details_parts.append(f"Harmonics-to-noise ratio is {hnr:.1f} dB, {status}")

    if details_parts:
        details = ". ".join(details_parts) + "."
    else:
        details = "Voice features have been extracted and analyzed against clinical reference ranges from published literature."

    return {
        "summary": summary,
        "details": details,
        "disclaimer": (
            "This analysis is for informational and screening purposes only. "
            "It is not a medical diagnosis. If you have concerns about your "
            "voice or health, please consult a healthcare professional."
        ),
        "model_version": "b2ai-voice-v0.1.0"
    }


def generate_explanation(features: dict, predictions: list, task_type: str) -> dict:
    """
    Generate a human-readable explanation of prediction results.

    The LLM receives extracted features, model predictions, and clinical thresholds.
    It produces plain-language explanations without making diagnoses.

    Supports OpenAI GPT, Google Gemini, and Anthropic Claude.
    Falls back to hardcoded data-driven explanation when LLM is unavailable.
    """
    # Data-driven fallback when no LLM is available
    fallback = _build_hardcoded_explanation(features, predictions, task_type)

    prompt = f"""Explain voice analysis results in 1 sentence each. Be reassuring.

Features: {json.dumps(features)}
Predictions: {json.dumps(predictions)}

Return JSON:
{{
  "summary": "1 sentence summary of results.",
  "details": "1 sentence with key metrics."
}}

Rules: Never diagnose. Be reassuring."""

    try:
        text = _call_llm(prompt)

        if text is None:
            # No LLM available
            return fallback

        # Parse LLM response - handle markdown code blocks and extract JSON
        cleaned = text.strip()

        # Remove markdown code blocks if present
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # Remove first line (```json, ```, or just the language name)
            if lines and lines[0].strip().startswith("```"):
                lines = lines[1:]
            # Remove last line if it's ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # Try to extract JSON object if there's still extra text
        if not cleaned.startswith("{"):
            start_idx = cleaned.find("{")
            end_idx = cleaned.rfind("}") + 1
            if start_idx >= 0 and end_idx > start_idx:
                cleaned = cleaned[start_idx:end_idx]

        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Fallback on JSON parsing error
        print(f"LLM explanation JSON parse error: {e}")
        print(f"Cleaned text (first 500 chars): {cleaned[:500]}")
        print(f"Full cleaned text:\n{cleaned}")
        parsed = {
            "summary": "Analysis complete. Please review the detailed results below.",
            "details": "Your voice features have been extracted and analyzed against clinical reference ranges."
        }
    except Exception as e:
        # Fallback on other errors
        print(f"LLM explanation error: {e}")
        parsed = {
            "summary": "Analysis complete. Please review the detailed results below.",
            "details": "Your voice features have been extracted and analyzed against clinical reference ranges."
        }

    parsed["disclaimer"] = (
        "This analysis is for informational and screening purposes only. "
        "It is not a medical diagnosis. If you have concerns about your "
        "voice or health, please consult a healthcare professional."
    )
    parsed["model_version"] = "b2ai-voice-v0.1.0"

    return parsed


def generate_quality_failure_suggestion(gate_result: dict) -> str:
    """
    Generate helpful suggestion when quality gate fails.

    For single failures, uses templates. For multiple failures, uses LLM.
    """
    failed = gate_result["failed_checks"]

    # Single failure templates (fast, no LLM needed)
    if len(failed) == 1:
        check = failed[0]
        templates = {
            "snr": "Try recording in a quieter room. Close windows and doors, turn off fans or air conditioning, and hold the phone about 15-20 cm from your mouth.",
            "clipping": "The volume was too high. Try holding the phone slightly further from your mouth, or speak at a slightly lower volume.",
            "voiced_duration": "We need a longer recording. Make sure to sustain the sound for the full duration shown on screen.",
            "silence_region": "Make sure to stay completely quiet during the countdown before you start speaking."
        }
        return templates.get(check["check"], "Please try recording again.")

    # Multiple failures - use LLM for combined advice
    # Convert failed checks to JSON-serializable format
    from api.response import _convert_numpy_types
    failed_clean = _convert_numpy_types(failed)

    prompt = f"""A user tried to record their voice for health analysis but the recording failed quality checks. Generate ONE short paragraph (2-3 sentences) of friendly, practical advice addressing all issues.

Failed checks:
{json.dumps(failed_clean, indent=2)}

Be specific and actionable. Don't list the technical details — translate them into simple instructions the user can follow."""

    try:
        text = _call_llm(prompt)
        if text:
            return text.strip()
    except Exception as e:
        print(f"LLM suggestion error: {e}")

    # Fallback
    return "Please try recording again in a quieter environment with proper technique."
