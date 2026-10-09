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
