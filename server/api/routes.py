"""
API Routes
Route definitions for the Flask server.
"""
import uuid
import logging
import time
import numpy as np
from flask import Blueprint, request
from api.response import success_response, error_response, start_timer
from services.quality_gate import run_quality_gate
from services.preprocessing import run_preprocessing
from services.feature_extraction import extract_features
from services.prediction import predict, get_model_status
from services.explanation import generate_explanation, generate_quality_failure_suggestion
from services.task_definitions import get_all_tasks
from utils.audio_io import save_upload_to_temp, cleanup_temp

# ── Pretty logging setup ──────────────────────────────────────
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s', datefmt='%H:%M:%S')

# Silence noisy library loggers
for noisy in ['httpcore', 'httpx', 'openai', 'google_genai', 'numba', 'urllib3', 'werkzeug']:
    logging.getLogger(noisy).setLevel(logging.WARNING)

# ANSI colors
class C:
    RESET  = '\033[0m'
    BOLD   = '\033[1m'
    DIM    = '\033[2m'
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    CYAN   = '\033[96m'
    BLUE   = '\033[94m'
    MAGENTA= '\033[95m'
    WHITE  = '\033[97m'
    BG_GREEN = '\033[42m'
    BG_RED   = '\033[41m'


api_bp = Blueprint("api", __name__, url_prefix="/api/v1")


@api_bp.route("/analyze", methods=["POST"])
def analyze():
    """Main analysis endpoint - runs full pipeline."""
    request_id = str(uuid.uuid4())
    start_timer(request_id)
    pipeline_start = time.time()
    rid = request_id[:8]  # Short ID for readability

    logger.info(f"\n{C.CYAN}{'━'*60}{C.RESET}")
    logger.info(f"{C.CYAN}📨 POST /analyze{C.RESET}  {C.DIM}id={rid}{C.RESET}")
    logger.info(f"{C.DIM}   Content-Type: {request.content_type}  Length: {request.content_length}{C.RESET}")

    # Validate request
    if "audio" not in request.files:
        logger.warning(f"{C.RED}❌ No 'audio' file in request. Keys: {list(request.files.keys())}{C.RESET}")
        return error_response(
            error_type="validation_error",
            message="No audio file provided.",
            code=400,
            suggestion="Include an audio file in the 'audio' field of the multipart form.",
            request_id=request_id
        )

    audio_file = request.files["audio"]
    device_id = request.form.get("device_id", "unknown")
    task_type = request.form.get("task_type", "sustained_vowel")
    silence_sec = float(request.form.get("silence_duration_sec", 3.0))

    logger.info(f"{C.DIM}   📎 {audio_file.filename} ({audio_file.content_type})  task={task_type}{C.RESET}")

    valid_tasks = ["prolonged_vowel", "max_phonation_time", "glides", "harvard_sentences", "loudness"]
    if task_type not in valid_tasks:
        logger.warning(f"{C.RED}❌ Invalid task_type: {task_type}{C.RESET}")
        return error_response(
            error_type="validation_error",
            message=f"Invalid task_type '{task_type}'.",
            code=400,
            suggestion=f"Must be one of: {', '.join(valid_tasks)}",
            request_id=request_id
        )

    # Save to temp file
    try:
        temp_path = save_upload_to_temp(audio_file)
        logger.info(f"{C.BLUE}   ① Save{C.RESET}         ✅ saved to temp")
    except ValueError as e:
        logger.error(f"{C.RED}   ① Save         ❌ {e}{C.RESET}")
        return error_response(
            error_type="validation_error",
            message=str(e),
            code=400,
            request_id=request_id
        )

    processed_path = None

    try:
        # Quality Gate
        t0 = time.time()
        gate_result = run_quality_gate(temp_path, device_id, task_type, silence_sec)
        passed = gate_result['passed']
        status = f"{C.GREEN}✅ PASSED{C.RESET}" if passed else f"{C.RED}❌ FAILED{C.RESET}"
        logger.info(f"{C.BLUE}   ② Quality Gate{C.RESET}  {status}  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
        
        # Print all subchecks
        for chk in gate_result.get('passed_checks', []):
            logger.info(f"{C.GREEN}      ↳ [PASS] {chk['check']}: {chk['value']} {chk['unit']} {C.DIM}(threshold: {chk['threshold']}){C.RESET}")
        for chk in gate_result.get('failed_checks', []):
            logger.info(f"{C.RED}      ↳ [FAIL] {chk['check']}: {chk['value']} {chk['unit']} {C.DIM}(need {chk['threshold']}){C.RESET}")
        for warn in gate_result.get('warnings', []):
            logger.info(f"{C.YELLOW}      ↳ [WARN] {warn}{C.RESET}")

        if not passed:
            suggestion = generate_quality_failure_suggestion(gate_result)
            return error_response(
                error_type="quality_gate_failure",
                message="Recording quality is too low for accurate analysis.",
                code=422,
                failed_checks=gate_result["failed_checks"],
                passed_checks=gate_result["passed_checks"],
                warnings=gate_result["warnings"],
                suggestion=suggestion,
                request_id=request_id
            )

        # Preprocessing
        t0 = time.time()
        processed_path, preproc_info = run_preprocessing(
            temp_path, device_id, silence_sec, gate_result
        )
        logger.info(f"{C.BLUE}   ③ Preprocess{C.RESET}   ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
        if preproc_info:
            logger.info(f"{C.DIM}      ↳ Original length: {preproc_info.get('original_duration_sec', 0):.2f}s{C.RESET}")
            logger.info(f"{C.DIM}      ↳ Trimmed length: {preproc_info.get('trimmed_duration_sec', 0):.2f}s{C.RESET}")
            logger.info(f"{C.DIM}      ↳ SNR: {preproc_info.get('snr_db', 0):.2f} dB, Noise Reduced: {preproc_info.get('noise_reduced', False)}{C.RESET}")
            logger.info(f"{C.DIM}      ↳ RMS Energy: {preproc_info.get('rms_energy', 0):.4f}{C.RESET}")

        # Feature Extraction
        t0 = time.time()
        features = extract_features(processed_path, task_type)
        logger.info(f"{C.BLUE}   ④ Features{C.RESET}     ✅ {len(features)} extracted  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
        
        # Print sample of extracted features
        feature_keys = list(features.keys())
        for k in feature_keys[:10]:
            logger.info(f"{C.DIM}      ↳ {k}: {features[k]}{C.RESET}")
        if len(feature_keys) > 10:
            logger.info(f"{C.DIM}      ... and {len(feature_keys) - 10} more features{C.RESET}")

        # ML Prediction
        t0 = time.time()
        predictions = predict(features, task_type)
        logger.info(f"{C.BLUE}   ⑤ Prediction{C.RESET}   ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
        for p in predictions:
            logger.info(f"{C.DIM}      ↳ {p['condition_name']}: {p['probability_percent']}%{C.RESET}")

        # LLM Explanation
        t0 = time.time()
        explanation = generate_explanation(features, predictions, task_type)
        logger.info(f"{C.MAGENTA}   ⑥ LLM{C.RESET}          ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")

        # Save detailed log to file
        try:
            from services.file_logger import save_pipeline_log
            log_path = save_pipeline_log(request_id, device_id, task_type, gate_result, preproc_info, features, predictions, explanation)
            logger.info(f"{C.CYAN}   📄 Log Saved{C.RESET}   ✅  {C.DIM}({log_path}){C.RESET}")
        except Exception as e:
            logger.error(f"{C.RED}Failed to save pipeline log: {e}{C.RESET}")

        # Assemble response
        data = {
            "quality": gate_result["summary"],
            "preprocessing": preproc_info,
            "features": features,
            "predictions": predictions,
            "explanation": explanation
        }

        total_time = time.time() - pipeline_start
        logger.info(f"{C.GREEN}{C.BOLD}   🏁 DONE{C.RESET}         {C.GREEN}200 OK  {C.DIM}({total_time:.2f}s total){C.RESET}")
        logger.info(f"{C.CYAN}{'━'*60}{C.RESET}")

        return success_response(
            data=data,
            message="Analysis complete.",
            code=200,
            request_id=request_id
        )

    except Exception as e:
        logger.exception(f"{C.RED}{C.BOLD}   💥 ERROR{C.RESET}  {C.RED}{e}{C.RESET}")
        return error_response(
            error_type="processing_error",
            message=f"An error occurred during processing: {str(e)}",
            code=500,
            request_id=request_id
        )

    finally:
        cleanup_temp(temp_path, processed_path)


@api_bp.route("/validate", methods=["POST"])
def validate():
    """Quick quality check without full analysis."""
    request_id = str(uuid.uuid4())
    start_timer(request_id)

    if "audio" not in request.files:
        return error_response(
            error_type="validation_error",
            message="No audio file provided.",
            code=400,
            request_id=request_id
        )

    audio_file = request.files["audio"]
    device_id = request.form.get("device_id", "unknown")
    task_type = request.form.get("task_type", "sustained_vowel")
    silence_sec = float(request.form.get("silence_duration_sec", 3.0))

    try:
        temp_path = save_upload_to_temp(audio_file)
    except ValueError as e:
        return error_response(
            error_type="validation_error",
            message=str(e),
            code=400,
            request_id=request_id
        )

    try:
        gate_result = run_quality_gate(temp_path, device_id, task_type, silence_sec)

        if not gate_result["passed"]:
            suggestion = generate_quality_failure_suggestion(gate_result)
            return error_response(
                error_type="quality_gate_failure",
                message="Recording quality is too low for accurate analysis.",
                code=422,
                failed_checks=gate_result["failed_checks"],
                passed_checks=gate_result["passed_checks"],
                warnings=gate_result["warnings"],
                suggestion=suggestion,
                request_id=request_id
            )

        return success_response(
            data={"quality": gate_result["summary"]},
            message="Recording quality is acceptable.",
            code=200,
            request_id=request_id
        )

    except Exception as e:
        return error_response(
            error_type="processing_error",
            message=f"An error occurred: {str(e)}",
            code=500,
            request_id=request_id
        )

    finally:
        cleanup_temp(temp_path)


@api_bp.route("/health", methods=["GET"])
def health():
    """Server health check."""
    request_id = str(uuid.uuid4())
    start_timer(request_id)

    model_status = get_model_status()
    return success_response(
        data=model_status,
        message="Server is healthy.",
        request_id=request_id
    )


@api_bp.route("/tasks", methods=["GET"])
def tasks():
    """Get available vocal tasks."""
    request_id = str(uuid.uuid4())
    start_timer(request_id)

    return success_response(
        data={"tasks": get_all_tasks()},
        message="Available tasks retrieved.",
        request_id=request_id
    )


@api_bp.route("/tasks/<task_id>", methods=["GET"])
def task_detail(task_id):
    """Get details for a specific task."""
    request_id = str(uuid.uuid4())
    start_timer(request_id)

    from services.task_definitions import get_task_by_id
    task = get_task_by_id(task_id)

    if not task:
        return error_response(
            error_type="not_found",
            message=f"Task '{task_id}' not found.",
            code=404,
            suggestion="Use GET /api/v1/tasks to see available task IDs.",
            request_id=request_id
        )

    return success_response(
        data={"task": task},
        message=f"Task '{task_id}' retrieved.",
        request_id=request_id
    )


@api_bp.route("/demo/analyze", methods=["POST"])
def demo_analyze():
    """
    Demo endpoint with full visualizations.

    Returns everything from /analyze plus:
    - Base64-encoded PNG visualizations
    - Quality gate plots
    - Preprocessing comparisons
    - Feature visualizations
    - Raw B2AI feature structure (not flattened)
    """
    request_id = str(uuid.uuid4())
    start_timer(request_id)
    pipeline_start = time.time()
    rid = request_id[:8]

    logger.info(f"\n{C.CYAN}{'━'*60}{C.RESET}")
    logger.info(f"{C.CYAN}📨 POST /demo/analyze{C.RESET}  {C.DIM}id={rid}{C.RESET}")
    logger.info(f"{C.DIM}   Content-Type: {request.content_type}  Length: {request.content_length}{C.RESET}")

    # Validate request
    if "audio" not in request.files:
        logger.warning(f"{C.RED}❌ No 'audio' file in request. Keys: {list(request.files.keys())}{C.RESET}")
        return error_response(
            error_type="validation_error",
            message="No audio file provided.",
            code=400,
            suggestion="Include an audio file in the 'audio' field of the multipart form.",
            request_id=request_id
        )

    audio_file = request.files["audio"]
    device_id = request.form.get("device_id", "unknown")
    task_type = request.form.get("task_type", "sustained_vowel")
    silence_sec = float(request.form.get("silence_duration_sec", 3.0))

    logger.info(f"{C.DIM}   📎 {audio_file.filename} ({audio_file.content_type})  task={task_type}{C.RESET}")

    valid_tasks = ["prolonged_vowel", "max_phonation_time", "glides", "harvard_sentences", "loudness"]
    if task_type not in valid_tasks:
        logger.warning(f"{C.RED}❌ Invalid task_type: {task_type}{C.RESET}")
        return error_response(
            error_type="validation_error",
            message=f"Invalid task_type '{task_type}'.",
            code=400,
            suggestion=f"Must be one of: {', '.join(valid_tasks)}",
            request_id=request_id
        )

    # Save to temp file
    try:
        temp_path = save_upload_to_temp(audio_file)
        logger.info(f"{C.BLUE}   ① Save{C.RESET}         ✅ saved to temp")
    except ValueError as e:
        logger.error(f"{C.RED}   ① Save         ❌ {e}{C.RESET}")
        return error_response(
            error_type="validation_error",
            message=str(e),
            code=400,
            request_id=request_id
        )

    processed_path = None

    try:
        # Quality Gate
        t0 = time.time()
        gate_result = run_quality_gate(temp_path, device_id, task_type, silence_sec)
        passed = gate_result['passed']
        status = f"{C.GREEN}✅ PASSED{C.RESET}" if passed else f"{C.RED}❌ FAILED{C.RESET}"
        logger.info(f"{C.BLUE}   ② Quality Gate{C.RESET}  {status}  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
        
        # Print all subchecks
        for chk in gate_result.get('passed_checks', []):
            logger.info(f"{C.GREEN}      ↳ [PASS] {chk['check']}: {chk['value']} {chk['unit']} {C.DIM}(threshold: {chk['threshold']}){C.RESET}")
        for chk in gate_result.get('failed_checks', []):
            logger.info(f"{C.RED}      ↳ [FAIL] {chk['check']}: {chk['value']} {chk['unit']} {C.DIM}(need {chk['threshold']}){C.RESET}")
        for warn in gate_result.get('warnings', []):
            logger.info(f"{C.YELLOW}      ↳ [WARN] {warn}{C.RESET}")

        if not passed:
            # Generate visualizations even for failed quality gate
            from services.visualization import generate_all_visualizations
            visualizations = generate_all_visualizations(temp_path, gate_result, {})
            suggestion = generate_quality_failure_suggestion(gate_result)
            return error_response(
                error_type="quality_gate_failure",
                message="Recording quality is too low for accurate analysis.",
                code=422,
                failed_checks=gate_result["failed_checks"],
                passed_checks=gate_result["passed_checks"],
                warnings=gate_result["warnings"],
                suggestion=suggestion,
                request_id=request_id
            )

        # Preprocessing
        t0 = time.time()
        processed_path, preproc_info = run_preprocessing(
            temp_path, device_id, silence_sec, gate_result
        )
        logger.info(f"{C.BLUE}   ③ Preprocess{C.RESET}   ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")

        # Feature Extraction (get RAW features for visualization)
        t0 = time.time()
        try:
            from senselab.audio.data_structures import Audio
            from senselab.audio.tasks.features_extraction import extract_features_from_audios

            audio_obj = Audio(filepath=processed_path)
            raw_features_list = extract_features_from_audios([audio_obj])
            raw_features = raw_features_list[0] if raw_features_list else {}

            # Remove unwanted torchaudio features completely, but keep torchaudio_squim and opensmile
            if 'torchaudio' in raw_features:
                del raw_features['torchaudio']

            # Also get flattened features for ML
            from services.feature_extraction import extract_features, _flatten_b2ai_features
            features_flattened = _flatten_b2ai_features(raw_features)
            logger.info(f"{C.BLUE}   ④ Features{C.RESET}     ✅ {len(features_flattened)} (senselab)  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
            
            feature_keys = list(features_flattened.keys())
            for k in feature_keys[:10]:
                logger.info(f"{C.DIM}      ↳ {k}: {features_flattened[k]}{C.RESET}")
            if len(feature_keys) > 10:
                logger.info(f"{C.DIM}      ... and {len(feature_keys) - 10} more features{C.RESET}")

        except ImportError as ie:
            logger.info(f"{C.YELLOW}   ④ Features{C.RESET}     ⚠️  senselab unavailable, using basic  {C.DIM}({ie}){C.RESET}")
            from services.feature_extraction import extract_features
            features_flattened = extract_features(processed_path, task_type)
            raw_features = {}
            logger.info(f"{C.BLUE}   ④ Features{C.RESET}     ✅ {len(features_flattened)} (basic)  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
            
            feature_keys = list(features_flattened.keys())
            for k in feature_keys[:10]:
                logger.info(f"{C.DIM}      ↳ {k}: {features_flattened[k]}{C.RESET}")
            if len(feature_keys) > 10:
                logger.info(f"{C.DIM}      ... and {len(feature_keys) - 10} more features{C.RESET}")

        # ML Prediction
        t0 = time.time()
        predictions = predict(features_flattened, task_type)
        logger.info(f"{C.BLUE}   ⑤ Prediction{C.RESET}   ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")
        for p in predictions:
            logger.info(f"{C.DIM}      ↳ {p['condition_name']}: {p['probability_percent']}%{C.RESET}")

        # LLM Explanation
        t0 = time.time()
        explanation = generate_explanation(features_flattened, predictions, task_type)
        logger.info(f"{C.MAGENTA}   ⑥ LLM{C.RESET}          ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")

        # Save detailed log to file
        try:
            from services.file_logger import save_pipeline_log
            log_path = save_pipeline_log(request_id, device_id, task_type, gate_result, preproc_info, features_flattened, predictions, explanation)
            logger.info(f"{C.CYAN}   📄 Log Saved{C.RESET}   ✅  {C.DIM}({log_path}){C.RESET}")
        except Exception as e:
            logger.error(f"{C.RED}Failed to save pipeline log: {e}{C.RESET}")

        # Generate Visualizations
        t0 = time.time()
        from services.visualization import (
            generate_all_visualizations,
            generate_b2ai_feature_visualizations
        )

        visualizations = generate_all_visualizations(
            temp_path, gate_result, preproc_info
        )

        # Add B2AI feature visualizations
        if raw_features:
            feature_viz = generate_b2ai_feature_visualizations(raw_features)
            visualizations.update(feature_viz)
        logger.info(f"{C.BLUE}   ⑦ Viz{C.RESET}           ✅  {C.DIM}({time.time()-t0:.2f}s){C.RESET}")

        # Assemble response
        data = {
            "quality": gate_result["summary"],
            "preprocessing": preproc_info,
            "features": features_flattened,
            "features_raw": _serialize_raw_features(raw_features),  # For inspection
            "predictions": predictions,
            "explanation": explanation,
            "visualizations": visualizations  # Base64-encoded PNGs
        }

        total_time = time.time() - pipeline_start
        logger.info(f"{C.GREEN}{C.BOLD}   🏁 DONE{C.RESET}         {C.GREEN}200 OK  {C.DIM}({total_time:.2f}s total){C.RESET}")
        logger.info(f"{C.CYAN}{'━'*60}{C.RESET}")

        return success_response(
            data=data,
            message="Demo analysis complete with visualizations.",
            code=200,
            request_id=request_id
        )

    except Exception as e:
        logger.exception(f"{C.RED}{C.BOLD}   💥 ERROR{C.RESET}  {C.RED}{e}{C.RESET}")
        return error_response(
            error_type="processing_error",
            message=f"An error occurred during processing: {str(e)}",
            code=500,
            request_id=request_id
        )

    finally:
        cleanup_temp(temp_path, processed_path)


def _serialize_raw_features(features_dict: dict, max_depth: int = 3, current_depth: int = 0) -> dict:
    """
    Serialize raw B2AI features for JSON (convert tensors/arrays to summary).
    Limits depth to avoid huge responses.
    """
    import torch
    import pandas as pd

    if current_depth >= max_depth:
        return {"_truncated": "Max depth reached"}

    serialized = {}

    for key, value in features_dict.items():
        # Nested dicts
        if isinstance(value, dict):
            serialized[key] = _serialize_raw_features(value, max_depth, current_depth + 1)

        # Tensors
        elif isinstance(value, torch.Tensor):
            val_np = value.squeeze().detach().cpu().numpy()
            serialized[key] = {
                "type": "tensor",
                "shape": list(val_np.shape),
                "dtype": str(val_np.dtype),
                "mean": float(np.mean(val_np)),
                "std": float(np.std(val_np))
            }

        # Arrays
        elif isinstance(value, np.ndarray):
            serialized[key] = {
                "type": "array",
                "shape": list(value.shape),
                "dtype": str(value.dtype),
                "mean": float(np.mean(value)),
                "std": float(np.std(value))
            }

        # DataFrames
        elif isinstance(value, pd.DataFrame):
            serialized[key] = {
                "type": "dataframe",
                "shape": list(value.shape),
                "columns": list(value.columns[:10])  # First 10 columns
            }

        # Strings
        elif isinstance(value, str):
            serialized[key] = value

        # Scalars
        elif isinstance(value, (int, float, bool)):
            serialized[key] = value

        else:
            serialized[key] = {"type": str(type(value).__name__)}

    return serialized
