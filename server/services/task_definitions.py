"""
Task Definitions
Defines available vocal tasks and their requirements.
"""


_TASKS = [
    {
        "id": "prolonged_vowel",
        "display_name": "Prolonged Vowel",
        "instruction": "Sustain the vowel sound /a/ or /e/ at a comfortable pitch and loudness for about 8 seconds.",
        "prompt_text": "Aah...",
        "min_duration_sec": 8,
        "silence_before_sec": 3,
        "conditions_screened": ["benign_lesion"],
        "quality_gates": ["silence_region", "snr", "clipping", "voiced_duration", "agc"]
    },
    {
        "id": "max_phonation_time",
        "display_name": "Maximum Phonation Time",
        "instruction": "Take a deep breath and hold a vowel sound for as long as you possibly can.",
        "prompt_text": "Deep breath... Aaaaaahh",
        "min_duration_sec": 5,
        "silence_before_sec": 3,
        "conditions_screened": ["benign_lesion"],
        "quality_gates": ["silence_region", "snr", "clipping", "voiced_duration", "agc"]
    },
    {
        "id": "glides",
        "display_name": "Glides",
        "instruction": "Smoothly sweep your pitch from low to high and then high to low without breaks. Use two full breaths.",
        "prompt_text": "Low → High → Low",
        "min_duration_sec": 5,
        "silence_before_sec": 3,
        "conditions_screened": ["benign_lesion"],
        "quality_gates": ["silence_region", "snr", "clipping", "voiced_duration", "agc"]
    },
    {
        "id": "loudness",
        "display_name": "Loudness",
        "instruction": "Produce voice at three different loudness levels: soft, comfortable, then loud — holding each for a couple of seconds.",
        "prompt_text": "soft → COMFORTABLE → LOUD",
        "min_duration_sec": 5,
        "silence_before_sec": 3,
        "conditions_screened": ["benign_lesion"],
        "quality_gates": ["silence_region", "snr", "clipping", "voiced_duration", "agc"]
    }
    
    # --- OMITTED LONG TASKS ---
    # {
    #     "id": "harvard_sentences",
    #     "display_name": "Harvard Sentences",
    #     "instruction": "Read the following phonetically balanced sentences aloud at your normal speaking pace.",
    #     "reason_omitted": "Too Long"
    # },

    # {
    #     "id": "diadochokinesis",
    #     "display_name": "Diadochokinesis",
    #     "instruction": "Rapidly repeat alternating syllables such as 'pa-ta-ka'.",
    #     "reason_omitted": "Too Long"
    # },
    # {
    #     "id": "free_speech",
    #     "display_name": "Free Speech",
    #     "instruction": "Speak spontaneously on a topic for about 30 seconds.",
    #     "reason_omitted": "Too Long (30s)"
    # },
    # {
    #     "id": "respiration_and_cough",
    #     "display_name": "Respiration and Cough",
    #     "instruction": "Perform breathing maneuvers and voluntary coughs.",
    #     "reason_omitted": "Too Long"
    # },
    # {
    #     "id": "picture_description",
    #     "display_name": "Picture Description",
    #     "instruction": "Describe a visual scene shown to you for about 1 minute.",
    #     "reason_omitted": "Too Long (1m)"
    # },
    # {
    #     "id": "story_recall",
    #     "display_name": "Story Recall",
    #     "instruction": "Listen to a short narrative and retell it from memory.",
    #     "reason_omitted": "Too Long"
    # },
    # {
    #     "id": "caterpillar_passage",
    #     "display_name": "Caterpillar Passage",
    #     "instruction": "Read the standardized 'Caterpillar Passage' aloud.",
    #     "reason_omitted": "Too Long (1m)"
    # },
    # {
    #     "id": "cape_v_sentences",
    #     "display_name": "Cape V Sentences",
    #     "instruction": "Read the six standardized sentences from the Consensus Auditory-Perceptual Evaluation of Voice.",
    #     "reason_omitted": "Bad"
    # }
]


def get_all_tasks() -> list:
    """Return all supported vocal tasks."""
    return _TASKS


def get_task_by_id(task_id: str) -> dict:
    """Get a specific task by its ID."""
    for task in _TASKS:
        if task["id"] == task_id:
            return task
    return None
