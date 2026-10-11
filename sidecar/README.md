# Presage sidecar

Reads its settings from the repo-root `.env`. Runs next to the API, owns the webcam, and
streams readings over a WebSocket. The camera is only open between a `start` and `stop`
from the API. Video frames are never saved; only numbers (heart rate, breathing rate,
quality) are sent.

```bash
cd sidecar
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
(cd presage_node && npm install)   # SmartSpectra Node SDK (Linux x64, glibc 2.35+, Node 20+)
python run_sidecar.py
```

## Sources (`SOURCE` in `.env`)

- `mock` — random readings, no camera or key needed. Use this to build the UI.
- `presage` — real readings from the webcam via the SmartSpectra Node SDK.

## How the Presage source works

`run_sidecar.py` starts `node presage_node/stream.mjs` when a session starts and stops it
when the session ends. The script uses `@smartspectra/node-sdk`, reads
`PRESAGE_API_KEY` from the environment, and prints one line per second:

```json
{"heart_rate": 71.2, "breathing_rate": 14.1, "quality": 0.83}
```

`quality` is the lower of the pulse and breathing confidence. Unstable or stale (>3 s)
measurements count as quality 0–0.5, which the API stores as "No reading".

## Facial-expression radar (optional)

The Camera page can show a radar chart of facial-expression scores (angry, disgust, fear,
happy, sad, surprise, neutral). Scores come from the pretrained FER+ CNN (`emotion/ferplus.py`,
ONNX model run with OpenCV, ~34 MB, downloaded on first run), applied to the face in the same
in-memory preview frames, twice a second. FER+'s extra "contempt" class is counted as disgust.
If FER+ can't load, the sidecar falls back to the landmark model described below. Like the
preview itself, the scores are only shown live and are never stored.

**Needs Python 3.11–3.13.** TensorFlow has no stable release for Python 3.14 yet, so
`pip install -r requirements-emotion.txt` fails there. If your default Python is 3.14, build the
sidecar venv with an older one:

```bash
brew install python@3.12        # or any 3.11–3.13
cd sidecar
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-emotion.txt
```

If the radar shows "Waiting for a face in view…" forever, check the sidecar log for
`expression radar off (...)`. That means these packages or the model didn't load.

To retrain the model:

```bash
cd sidecar
pip install -r requirements-emotion.txt
python -m emotion.train path/to/fer2013_landmarks_nopathsfixed.csv
```

No landmark CSV? Build one from the FER2013 images (Kaggle `fer2013.csv`, or the parquet files
from huggingface.co/datasets/AutumnQiu/fer2013) with the same extractor the live camera uses:

```bash
python -m emotion.build_landmarks train.parquet valid.parquet test.parquet -o fer2013_landmarks.csv
python -m emotion.train fer2013_landmarks.csv   # ~44% test accuracy over 7 classes
```

Training writes `emotion/models/{emotion_mlp.keras,scaler.joblib,meta.json}`. With
`SOURCE=presage` the sidecar loads them at startup (first run downloads OpenCV's 68-point
landmark model, ~54 MB). Without them the radar stays off and everything else works as before.
`SOURCE=mock` sends fake scores, so the chart can be developed without a camera or model.

How it works:
- `emotion/features.py`: landmarks are centered and scaled, so a 48×48 FER crop and a face
  anywhere in the webcam frame give comparable inputs. Training and live use the same code.
- `emotion/train.py`: scikit-learn `StandardScaler` + a Keras MLP (256-128-64, dropout,
  class weights because FER2013 has very few "disgust" images), early stopping, and a
  per-class report on a held-out 15% split.
- `emotion/tracker.py`: OpenCV Haar face detection → LBF facemark (same 68-point layout as
  dlib) → model → exponential smoothing so the chart doesn't jitter.

The CSV needs an `emotion` column (FER2013 ids 0–6) and 68 x,y landmark pairs, either as
columns (`x0,y0,…` or `x0…x67,y0…y67`, detected by name) or as one text column. For unnamed
columns stored as all x then all y, pass `--layout split`.
