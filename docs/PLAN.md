BipolarBird

A private self-monitoring app that helps you notice changes in your mood, sleep and energy, understand your own patterns, and take informed action. Built for MLH Hack Knight (Oct 9-11, 2026).

BipolarBird is a wellness tool. It does not diagnose bipolar disorder or any other condition, it does not predict episodes, and it is not a replacement for professional care. If you are in crisis, call or text 988 (US) or your local emergency number.

The problem

People managing bipolar disorder are often told to track mood, sleep and energy, but daily logs are easy to abandon and hard to read. Early shifts such as shorter sleep or racing thoughts are easy to miss until they have already built up.

What it does
Daily check-in (about 1 minute): mood, energy, irritability, sleep hours, racing thoughts, notes. All self-reported.
Camera session (optional, you start and stop it): contactless heart-rate and breathing readings using the Presage SmartSpectra SDK. A quality meter shows when a reading is not reliable, and the app shows "No reading" instead of guessing. Video is never saved, only readings.
Personal timeline: what you reported and what the camera measured, shown in two separate lanes, never merged into a score.
Gentle follow-up: simple, transparent rules (for example, shorter sleep than usual on several recent nights) trigger a calm prompt. You can review your timeline, be reminded tomorrow, dismiss it, or open your own wellness plan.
What it deliberately does not do
No diagnosis, risk score or episode prediction.
No video recording.
No sharing with anyone unless you choose to.
Tech stack
Part	Choice
Frontend	React + Vite
API	FastAPI (Python) with WebSocket for live readings
Database	Postgres (Tiger Data / TimescaleDB hypertable for readings)
Camera readings	Presage SmartSpectra SDK in a local sidecar process
Follow-up logic	Deterministic rules in code
Summary wording (optional)	Gemini, with a constrained prompt
Architecture
Browser (React)  <--HTTP/WebSocket-->  FastAPI  <-->  Postgres
                                         ^
                                         |  readings
                                  Presage sidecar (webcam)

Tables: checkins, readings, sessions, prompts.

Getting started

Prerequisites: Node 20+, Python 3.11+, Docker (for Postgres), a webcam, and a Presage API key.

bash
# 1. Database
docker compose up -d db

# 2. API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add DATABASE_URL, PRESAGE_API_KEY, GEMINI_API_KEY (optional)
python scripts/seed.py      # loads 14 days of clearly labeled sample data
uvicorn app.main:app --reload

# 3. Presage sidecar (separate terminal)
cd sidecar
# follow the SmartSpectra SDK setup for your OS, then:
python run_sidecar.py

# 4. Frontend
cd web
npm install
npm run dev

Open http://localhost:5173. Sample data is labeled "Sample data" in the UI.

Privacy
Video is processed live and never stored; only numeric readings are saved.
All data stays in your local database.
"Delete all my data" removes check-ins, readings and prompts.
Roadmap
Personal baselines so "usual" comes from your own history.
Optional share view for a clinician or trusted person, controlled by you.
Wording review with a mental-health professional before any public release.
License

MIT