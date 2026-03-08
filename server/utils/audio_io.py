"""
Audio File I/O Utilities
Handles file uploads, temp storage, and cleanup.
"""
import tempfile
import os
import subprocess
from werkzeug.datastructures import FileStorage


ALLOWED_EXTENSIONS = {".m4a", ".caf", ".wav", ".mp3", ".webm", ".ogg", ".flac"}
MAX_FILE_SIZE = 30 * 1024 * 1024  # 30 MB


def save_upload_to_temp(file: FileStorage) -> str:
    """
    Save an uploaded file to a temp path and convert to WAV if needed.

    Args:
        file: Flask FileStorage object from request.files

    Returns:
        Path to temporary file (converted to WAV if necessary)

    Raises:
        ValueError: If file format is unsupported or file is too large
    """
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".m4a"
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported audio format: {ext}")

    # Save original file
    temp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    file.save(temp.name)
    temp.close()

    # Check file size
    size = os.path.getsize(temp.name)
    if size > MAX_FILE_SIZE:
        os.unlink(temp.name)
        raise ValueError(f"File too large: {size} bytes (max {MAX_FILE_SIZE})")

    # Convert WebM to WAV using ffmpeg (librosa has trouble with WebM)
    if ext == ".webm":
        wav_temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        wav_path = wav_temp.name
        wav_temp.close()

        try:
            # Use ffmpeg to convert WebM to WAV
            subprocess.run(
                [
                    "ffmpeg", "-i", temp.name,
                    "-ar", "16000",  # Resample to 16kHz
                    "-ac", "1",      # Convert to mono
                    "-y",            # Overwrite output
                    wav_path
                ],
                check=True,
                capture_output=True,
                timeout=30
            )

            # Remove original WebM file
            os.unlink(temp.name)
            return wav_path

        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
            # Clean up on error
            os.unlink(temp.name)
            if os.path.exists(wav_path):
                os.unlink(wav_path)
            raise ValueError(f"Failed to convert WebM audio: {str(e)}")

    return temp.name


def cleanup_temp(*paths):
    """
    Delete temporary files.

    Args:
        *paths: Variable number of file paths to delete

    Silently ignores missing files and errors.
    """
    for p in paths:
        try:
            if p and os.path.exists(p):
                os.unlink(p)
        except OSError:
            pass
