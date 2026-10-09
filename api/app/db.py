import logging
from pathlib import Path

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import get_settings

log = logging.getLogger(__name__)

pool = AsyncConnectionPool(
    conninfo=get_settings().database_url,
    open=False,
    kwargs={"row_factory": dict_row, "autocommit": True},
)

SCHEMA = (Path(__file__).parent / "schema.sql").read_text()


async def init_db() -> None:
    await pool.open()
    async with pool.connection() as conn:
        await conn.execute(SCHEMA)
        # Turn readings into a TimescaleDB hypertable when the extension is available
        # (always on Tiger Data; on the local docker image too). Plain Postgres still works.
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
            await conn.execute(
                "SELECT create_hypertable('readings', 'ts', if_not_exists => TRUE, migrate_data => TRUE)"
            )
        except Exception as e:  # noqa: BLE001
            log.warning("TimescaleDB unavailable, readings stay a plain table: %s", e)


async def close_db() -> None:
    await pool.close()
