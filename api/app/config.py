from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# All keys live in one git-ignored file at the repo root: mbeacon/.env
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, extra="ignore")

    database_url: str = "postgresql://moodbeacon:moodbeacon@localhost:5433/moodbeacon"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    sidecar_token: str = "change-me"
    cors_origins: str = "http://localhost:5173"

    # Fallback when a source doesn't say whether a reading is reliable (e.g. mock):
    # readings below this quality are stored as "no reading" (null values).
    min_quality: float = 0.6

    # Optional: send shared check-ins straight from the app. Without these the browser
    # opens the person's own email app instead.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and (self.smtp_from or self.smtp_user))

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
