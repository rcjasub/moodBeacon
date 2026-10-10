-- Idempotent schema. Applied on API startup.

CREATE TABLE IF NOT EXISTS checkins (
    id               SERIAL PRIMARY KEY,
    day              DATE NOT NULL UNIQUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    mood             TEXT NOT NULL,
    energy           TEXT NOT NULL,
    sleep_hours      REAL,
    less_sleep_need  BOOLEAN NOT NULL DEFAULT FALSE,
    irritable        BOOLEAN NOT NULL DEFAULT FALSE,
    racing_thoughts  BOOLEAN NOT NULL DEFAULT FALSE,
    unusual_activity BOOLEAN NOT NULL DEFAULT FALSE,
    off_baseline     BOOLEAN NOT NULL DEFAULT FALSE,
    note             TEXT NOT NULL DEFAULT '',
    is_sample        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    is_sample   BOOLEAN NOT NULL DEFAULT FALSE
);

-- Camera readings. Null heart_rate / breathing_rate means "No reading" (quality too low).
CREATE TABLE IF NOT EXISTS readings (
    ts              TIMESTAMPTZ NOT NULL,
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    heart_rate      REAL,
    breathing_rate  REAL,
    quality         REAL NOT NULL,
    is_sample       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS readings_session_ts ON readings (session_id, ts DESC);

CREATE TABLE IF NOT EXISTS prompts (
    id            SERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    rule_id       TEXT NOT NULL,
    message       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open',   -- open | snoozed | dismissed | reviewed
    snooze_until  DATE,
    is_sample     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS wellness_plan (
    id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    early_signs        TEXT NOT NULL DEFAULT '',
    what_helps         TEXT NOT NULL DEFAULT '',
    clinician_name     TEXT NOT NULL DEFAULT '',
    clinician_contact  TEXT NOT NULL DEFAULT '',
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Let it go" notes: written down, then crumpled away. Separate from check-in notes,
-- never read by rules or summaries, and deleted for good when crumpled.
CREATE TABLE IF NOT EXISTS release_notes (
    id          SERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    text        TEXT NOT NULL
);
