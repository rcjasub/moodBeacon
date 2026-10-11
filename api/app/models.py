from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from .screening import ALSO_IDS, ITEM_IDS, REASON_IDS

Mood = Literal["low", "slightly_low", "steady", "lifted", "very_high"]
Energy = Literal["very_low", "lower", "usual", "higher", "very_high"]
Reason = Literal[tuple(REASON_IDS)]
Item = Literal[tuple(ITEM_IDS)]
Also = Literal[tuple(ALSO_IDS)]


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


class ReleaseNoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=600, pattern=r"\S")


class ScreeningIn(BaseModel):
    session_id: UUID | None = None
    explained_by: list[Reason] = []
    # Questionnaire answers (0-4 per item). Omitted when an everyday reason explained the reading.
    answers: dict[Item, int] | None = None
    also_noticed: list[Also] = []

    @field_validator("answers")
    @classmethod
    def all_items_answered(cls, v):
        if v is not None and (set(v) != set(ITEM_IDS) or any(not 0 <= x <= 4 for x in v.values())):
            raise ValueError("answer every question with a value from 0 to 4")
        return v


class ShareEmailIn(BaseModel):
    to: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    note: str = Field(default="", max_length=1000)
