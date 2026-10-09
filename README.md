# BipolarBird

A private self-monitoring app that helps you notice changes in your mood, sleep and energy,
understand your own patterns, and take informed action. Built for MLH Hack Knight (Oct 9–11, 2026).

> BipolarBird is a wellness tool. It does not diagnose bipolar disorder or any other condition,
> it does not predict episodes, and it is not a replacement for professional care.
> If you are in crisis, call or text **988** (US) or your local emergency number.

Full product plan: [`docs/PLAN.md`](docs/PLAN.md) · Original design: [`design/today.html`](design/today.html)

## Layout

```
api/        FastAPI + Postgres/TimescaleDB (check-ins, sessions, readings, prompts, rules, Gemini summary)
sidecar/    Presage SmartSpectra camera process → streams readings to the API over WebSocket
web/        React + Vite frontend (Today, Camera session, Timeline, Privacy, Wellness plan)
design/     Static design export the UI is based on
docs/       Plan
```

```
Browser (React) <--HTTP / ws:/ws/live--> FastAPI <--> Postgres (Tiger Data / TimescaleDB)
                                            ^
                                            | ws:/ws/sidecar (readings)
                                    Presage sidecar (webcam)
```

## Keys and config

All keys go in **one file: `.env` at the repo root** (git-ignored). Start from the template:

```bash
cp .env.example .env
```

| Key | Where it comes from |
|---|---|
| `DATABASE_URL` | Tiger Data console → service → connection string (add `?sslmode=require`), or keep the local docker default |
| `GEMINI_API_KEY` | Google AI Studio (optional; without it summaries use a built-in template) |
| `PRESAGE_API_KEY` | physiology.presagetech.com; set `SOURCE=presage` for real camera readings |
| `SIDECAR_TOKEN` | Any random string (shared by API and sidecar) |

Both the API and the sidecar read this file. Restart them after editing it.

## Getting started

Prerequisites: Node 20+, Python 3.11+, Docker (only for local Postgres), a webcam.

```bash
# 1. Database — skip if DATABASE_URL points at Tiger Data
docker compose up -d db          # TimescaleDB on localhost:5433

# 2. API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/seed.py           # optional: 14 days of clearly labeled sample data
uvicorn app.main:app --reload    # http://localhost:8000/docs

# 3. Camera sidecar (separate terminal)
cd sidecar
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
(cd presage_node && npm install)  # SmartSpectra Node SDK
python run_sidecar.py            # SOURCE=mock = fake readings, SOURCE=presage = real webcam

# 4. Frontend (separate terminal)
cd web
npm install
npm run dev                      # http://localhost:5173 (proxies /api and /ws to :8000)
```

The schema is created automatically on API startup; `readings` becomes a TimescaleDB hypertable
when the extension is available (always on Tiger Data).

## How it works

- **Daily check-in** — mood, energy, sleep, flags, note. One per day; saving again replaces it.
- **Camera session** — `POST /api/sessions/start` tells the sidecar to open the camera; readings stream
  to `/ws/live`. Readings below quality 0.6 are stored as null and shown as "No reading". Video is never saved.
- **Timeline** — two separate lanes (reported vs measured), never merged into a score.
- **Follow-up rules** — `api/app/rules.py`: short sleep 3 nights running vs your own usual,
  racing thoughts 3 of 5 days, raised energy 3 days running, low mood 5 of 7 days.
  Each prompt can be reviewed, snoozed until tomorrow, or dismissed.
- **Summary** — numbers computed in code; Gemini only rewords them under a constrained prompt.
- **Privacy** — export everything as JSON, remove sample data, or delete all data.

## Roadmap

- Personal baselines so "usual" comes from your own history.
- Optional share view for a clinician or trusted person, controlled by you.
- Wording review with a mental-health professional before any public release.

## License

MIT
