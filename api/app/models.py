from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Mood = Literal["low", "slightly_low", "steady", "lifted", "very_high"]
Energy = Literal["very_low", "lower", "usual", "higher", "very_high"]


class CheckinIn(BaseModel):
    day: date | None = None  # defaults to today
    mood: Mood
    energy: Energy
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    less_sleep_need: bool = False
    irritable: bool = False
    racing_thoughts: bool = False
    unusual_activity: bool = False
    off_baseline: bool = False
    note: str = Field(default="", max_length=2000)


class ReadingIn(BaseModel):
    heart_rate: float | None = None
    breathing_rate: float | None = None
    quality: float = Field(ge=0, le=1)
    # Set by the Presage bridge from the SDK's "stable" flag; when absent, min_quality decides.
    reliable: bool | None = None


class PromptAction(BaseModel):
    action: Literal["review", "snooze", "dismiss"]


class WellnessPlanIn(BaseModel):
    early_signs: str = Field(default="", max_length=4000)
    what_helps: str = Field(default="", max_length=4000)
    clinician_name: str = Field(default="", max_length=200)
    clinician_contact: str = Field(default="", max_length=200)
