import os
import json
import time
from datetime import datetime

LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "pipeline_runs")

def save_pipeline_log(request_id: str, device_id: str, task_type: str, gate_result: dict, preproc_info: dict, features: dict, predictions: list, explanation: dict):
    """
    Saves a detailed human-readable log of the pipeline execution to a text file.
    """
    os.makedirs(LOGS_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"run_{timestamp}_{request_id}.txt"
    filepath = os.path.join(LOGS_DIR, filename)
    
    # Format the log text
    lines = []
    lines.append("="*60)
    lines.append(f"PIPELINE RUN: {filename}")
    lines.append(f"Timestamp: {datetime.now().isoformat()}")
    lines.append(f"Request ID: {request_id}")
    lines.append(f"Device ID: {device_id}")
    lines.append(f"Task Type: {task_type}")
    lines.append("="*60)
    lines.append("")
    
    # 1. Quality Gate
    lines.append("--- 1. QUALITY GATE ---")
    lines.append(f"Passed: {gate_result.get('passed', False)}")
    
    lines.append("\nPassed Checks:")
    for chk in gate_result.get("passed_checks", []):
        lines.append(f"  [PASS] {chk['check']}: {chk['value']} {chk['unit']} (threshold: {chk['threshold']})")
        
    lines.append("\nFailed Checks:")
    for chk in gate_result.get("failed_checks", []):
        lines.append(f"  [FAIL] {chk['check']}: {chk['value']} {chk['unit']} (need {chk['threshold']})")
        
    lines.append("\nWarnings:")
    for warn in gate_result.get("warnings", []):
        lines.append(f"  [WARN] {warn['message']}")
    lines.append("")
    
    # 2. Preprocessing
    lines.append("--- 2. PREPROCESSING ---")
    if preproc_info:
        lines.append(f"Original length: {preproc_info.get('original_duration_sec', 0):.2f}s")
        lines.append(f"Trimmed length: {preproc_info.get('trimmed_duration_sec', 0):.2f}s")
        lines.append(f"SNR: {preproc_info.get('snr_db', 0):.2f} dB")
        lines.append(f"Noise Reduced: {preproc_info.get('noise_reduced', False)}")
        lines.append(f"RMS Energy: {preproc_info.get('rms_energy', 0):.4f}")
    else:
        lines.append("No preprocessing info available.")
    lines.append("")
    
    # 3. Feature Extraction
    lines.append("--- 3. FEATURE EXTRACTION ---")
    if features:
        lines.append(f"Total features extracted: {len(features)}")
        lines.append("\nFeature values:")
        for k, v in features.items():
            lines.append(f"  {k}: {v}")
    else:
        lines.append("No features extracted.")
    lines.append("")
    
    # 4. ML Prediction
    lines.append("--- 4. ML PREDICTION ---")
    if predictions:
        for p in predictions:
            lines.append(f"  Condition: {p['condition_name']}")
            lines.append(f"    Probability: {p['probability_percent']}%")
            lines.append(f"    Severity: {p['severity_tier']}")
    else:
        lines.append("No predictions generated.")
    lines.append("")
    
    # 5. LLM Explanation
    lines.append("--- 5. LLM EXPLANATION ---")
    if explanation:
        lines.append(f"Summary: {explanation.get('summary', '')}")
        lines.append(f"Details: {explanation.get('details', '')}")
        lines.append(f"Model Version: {explanation.get('model_version', '')}")
    else:
        lines.append("No explanation generated.")
    lines.append("="*60)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
        
    return filepath
