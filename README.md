# AriaPitch — Voice Health Screening

A web-based voice health screening tool developed for the Cornell Health Hack / Bridge2AI study. Records voice samples, extracts acoustic biomarkers, and uses a trained ML ensemble classifier to screen for benign vocal fold lesions.

## How It Works

1. **Record** — User completes a voice task (prolonged vowel, pitch glides, loudness variation, or max phonation)
2. **Quality Gate** — Audio is checked for SNR, clipping, voice activity, and silence calibration
3. **Feature Extraction** — 129 acoustic features extracted via OpenSMILE + Praat (SenseLab B2AI pipeline)
4. **ML Prediction** — Voting Ensemble (SVM + Random Forest + XGBoost) trained on B2AI voice data outputs a probability score for benign vocal fold lesions
5. **Flag System** — Probability maps to a color-coded flag (green/yellow/orange/red) with actionable recommendations

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Flask + Python 3.12
- **ML**: scikit-learn + XGBoost + imbalanced-learn (SMOTE)
- **Audio**: SenseLab, OpenSMILE, Praat-Parselmouth, librosa

## Project Structure

```
cornellhealthhack/
├── website/                  # React frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # UI components and pages
│   │   │   ├── services/     # API client
│   │   │   ├── App.tsx       # Router setup
│   │   │   └── AppContext.tsx # State management
│   │   ├── styles/           # CSS and fonts
│   │   └── main.tsx          # Entry point
│   ├── vite.config.ts        # Dev server + proxy config
│   └── package.json
├── server/                   # Flask backend
│   ├── app.py                # Flask app factory
│   ├── api/
│   │   ├── routes.py         # API endpoints
│   │   └── response.py       # Response helpers
│   ├── services/
│   │   ├── quality_gate.py   # Audio quality checks
│   │   ├── preprocessing.py  # Audio preprocessing
│   │   ├── feature_extraction.py  # 129-feature extraction
│   │   ├── prediction.py     # ML model inference
│   │   ├── explanation.py    # Flag-based recommendations
│   │   ├── classifier.py     # Model training script
│   │   └── task_definitions.py
│   ├── models/
│   │   └── voice_classifier.joblib  # Trained model (26MB)
│   ├── utils/
│   │   └── audio_io.py       # File handling
│   └── requirements.txt
└── README.md
```

## Setup

### Prerequisites

- **Python 3.12+** (required for senselab)
- **Node.js 18+**

### Backend

```bash
cd server

# Create virtual environment with Python 3.12
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python app.py
```

The server runs on `http://localhost:5001`.

> **Note**: The trained model (`models/voice_classifier.joblib`) is included in the repo. If you want to retrain from scratch, place `Filtered_Static_Features.tsv` in the project root and run `python services/classifier.py`.

### Frontend

```bash
cd website

# Install dependencies
npm install

# Start dev server
npx vite
```

The frontend runs on `http://localhost:5173` and proxies API calls to the backend.

### Running Both

Open two terminals:

```bash
# Terminal 1 — Backend
cd server && source venv/bin/activate && python app.py

# Terminal 2 — Frontend
cd website && npx vite
```

Then open `http://localhost:5173` in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analyze` | Full voice analysis pipeline |
| POST | `/api/v1/validate` | Quick quality check only |
| GET | `/api/v1/health` | Server health + model status |
| GET | `/api/v1/tasks` | Available voice tasks |

## ML Model

- **Architecture**: Voting Ensemble (SVM + Random Forest + XGBoost) with SMOTE oversampling
- **Training Data**: 6,575 voice samples from the Bridge2AI dataset (129 features each)
- **Performance**: 90% accuracy, 83% F1, 95.5% AUC-ROC
- **Output**: Probability (0-100%) of benign vocal fold lesions

## Flag System

| Flag | Probability | Meaning |
|------|------------|---------|
| Green | 0–25% | Healthy — no action needed |
| Yellow | 25–50% | Minor variations — monitor over time |
| Orange | 50–75% | Worth monitoring — consider a checkup |
| Red | 75–100% | High probability — see an ENT specialist |

## Disclaimer

This tool is for screening and research purposes only. It is not a medical diagnosis. Users with concerns should consult a healthcare professional.
