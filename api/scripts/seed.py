"""Load 14 days of clearly labeled sample data (is_sample = TRUE).

Usage (from api/):  python scripts/seed.py
Remove it later from the Privacy page or with DELETE /api/data/sample.
"""

import asyncio
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import init_db, pool  # noqa: E402

random.seed(7)

# Last 3 nights trend shorter with less sleep need, so the follow-up rule has something to show.
SLEEP = [7.5, 7.0, 8.0, 7.5, 6.5, 7.0, 7.5, 8.0, 7.0, 7.5, 6.5, 5.0, 5.5, 5.0]
MOODS = ["steady"] * 8 + ["slightly_low", "steady", "steady", "lifted", "lifted", "steady"]
ENERGY = ["usual"] * 9 + ["lower", "usual", "higher", "usual", "lower"]


async def main() -> None:
    await init_db()
    today = date.today()
    async with pool.connection() as conn:
        await conn.execute("DELETE FROM readings WHERE is_sample")
        await conn.execute("DELETE FROM sessions WHERE is_sample")
        await conn.execute("DELETE FROM checkins WHERE is_sample")
        await conn.execute("DELETE FROM prompts WHERE is_sample")

        # Leave today empty so the check-in form is fresh.
        for i, (sleep, mood, energy) in enumerate(zip(SLEEP, MOODS, ENERGY)):
            day = today - timedelta(days=len(SLEEP) - i)
            recent = i >= len(SLEEP) - 3
            await conn.execute(
                """INSERT INTO checkins (day, created_at, mood, energy, sleep_hours, less_sleep_need,
                       irritable, racing_thoughts, unusual_activity, off_baseline, note, is_sample)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                   ON CONFLICT (day) DO NOTHING""",
                (
                    day, datetime.combine(day, time(21, 12), tzinfo=timezone.utc),
                    mood, energy, sleep, recent, random.random() < 0.15,
                    recent and i % 2 == 0, False, recent,
                    "Sample data" if i == 0 else "",
                ),
            )

            # Camera session every other day.
            if i % 2 == 0:
                start = datetime.combine(day, time(20, 0), tzinfo=timezone.utc)
                cur = await conn.execute(
                    "INSERT INTO sessions (started_at, ended_at, is_sample) VALUES (%s, %s, TRUE) RETURNING id",
                    (start, start + timedelta(minutes=1)),
                )
                sid = (await cur.fetchone())["id"]
                hr_base = 66 + (len(SLEEP) - i < 4) * 6
                for s in range(0, 60, 2):
                    q = random.uniform(0.4, 1.0)
                    ok = q >= 0.6
                    await conn.execute(
                        """INSERT INTO readings (ts, session_id, heart_rate, breathing_rate, quality, is_sample)
                           VALUES (%s, %s, %s, %s, %s, TRUE)""",
                        (
                            start + timedelta(seconds=s), sid,
                            round(hr_base + random.gauss(0, 2), 1) if ok else None,
                            round(14 + random.gauss(0, 1), 1) if ok else None,
                            round(q, 2),
                        ),
                    )

        await conn.execute(
            """INSERT INTO prompts (created_at, rule_id, message, is_sample)
               VALUES (now() - interval '1 hour', 'short_sleep_streak', %s, TRUE)""",
            ("About 5 hours of sleep and less need for sleep, three days in a row. "
             "Worth reviewing. It does not mean anything is wrong.",),
        )
    await pool.close()
    print("Loaded 14 days of sample data (labeled is_sample).")


if __name__ == "__main__":
    asyncio.run(main())
