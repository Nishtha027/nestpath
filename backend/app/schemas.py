"""Pydantic request/response models for the API."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .models import (
    AppointmentStatus,
    CaregiverRole,
    CareLogType,
    DiaperKind,
    FeedSide,
    FeedType,
    HelpRequestStatus,
)


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: CaregiverRole = CaregiverRole.PARENT
    # Omit to start a new family; set to join an existing one.
    invite_code: Optional[str] = None


class FamilyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invite_code: str


class RegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    family_id: UUID
    name: str
    email: str
    role: CaregiverRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChildCreate(BaseModel):
    name: Optional[str] = None
    birth_date: date
    region: Optional[str] = None


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    family_id: UUID
    name: Optional[str] = None
    birth_date: date
    region: Optional[str] = None


class ScheduleItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    type: str
    vaccine_id: str
    dose_number: Optional[int] = None
    due_date: date
    status: str
    administered_date: Optional[date] = None
    notes: Optional[str] = None
    source_version: Optional[str] = None
    # First date this dose is no longer recommended (hard age limit), if any.
    window_closes_on: Optional[date] = None
    # Parent-facing explanation of that limit.
    age_window_note: Optional[str] = None


class MarkGivenRequest(BaseModel):
    administered_date: Optional[date] = None


class GrowthMeasurementCreate(BaseModel):
    measured_at: date
    sex: str
    weight_kg: Optional[float] = None
    length_cm: Optional[float] = None

    @model_validator(mode="after")
    def weight_or_length(self):
        if self.weight_kg is None and self.length_cm is None:
            raise ValueError("Enter a weight, a length, or both")
        return self


class GrowthMeasurementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    measured_at: date
    age_months: int
    sex: str
    weight_kg: Optional[float] = None
    percentile: Optional[float] = None  # weight-for-age
    z_score: Optional[float] = None  # weight-for-age
    length_cm: Optional[float] = None
    length_percentile: Optional[float] = None
    length_z_score: Optional[float] = None
    source_version: Optional[str] = None


class GrowthReferenceRow(BaseModel):
    month: int
    p3: float
    p15: float
    p50: float
    p85: float
    p97: float


class GrowthReferenceResponse(BaseModel):
    sex: str
    source: str
    weight_kg: list[GrowthReferenceRow]
    length_cm: list[GrowthReferenceRow]


class CareLogFields(BaseModel):
    """The optional structured fields. Which ones are allowed depends on the
    entry's type; services/care_logs.py checks that (and the limits), so
    every rule gives the same kind of plain-English error."""

    model_config = ConfigDict(extra="forbid")

    notes: Optional[str] = None
    feed_type: Optional[FeedType] = None
    amount_ml: Optional[int] = None
    duration_min: Optional[int] = None
    side: Optional[FeedSide] = None
    ended_at: Optional[datetime] = None
    # A sleep that is still going (a timer was started). Stopping it is a
    # PATCH with ended_at.
    in_progress: Optional[bool] = None
    diaper_kind: Optional[DiaperKind] = None


class CareLogCreate(CareLogFields):
    type: CareLogType
    # When it happened (a sleep: when it started). Defaults to now. The
    # older name `timestamp` is still accepted.
    occurred_at: Optional[datetime] = None
    timestamp: Optional[datetime] = None


class CareLogUpdate(CareLogFields):
    """PATCH: only the fields sent change; send null to clear one. The type
    can't change (delete the entry and add a new one instead)."""

    occurred_at: Optional[datetime] = None


class CareLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    caregiver_id: UUID
    caregiver_name: Optional[str] = None
    type: CareLogType
    occurred_at: datetime
    # Same value as occurred_at, kept for clients built before it existed.
    timestamp: datetime
    notes: Optional[str] = None
    feed_type: Optional[FeedType] = None
    amount_ml: Optional[int] = None
    duration_min: Optional[int] = None
    side: Optional[FeedSide] = None
    ended_at: Optional[datetime] = None
    in_progress: bool = False
    diaper_kind: Optional[DiaperKind] = None
    updated_at: Optional[datetime] = None


class CareLogLatest(BaseModel):
    """The most recent entry of each type, or null if there is none yet."""

    feed: Optional[CareLogResponse] = None
    sleep: Optional[CareLogResponse] = None
    diaper: Optional[CareLogResponse] = None
    medication: Optional[CareLogResponse] = None


class CareLogDay(BaseModel):
    day: date
    feeds: int
    feed_ml: int
    avg_feed_ml: Optional[float] = None
    avg_feed_min: Optional[float] = None
    diapers_wet: int
    diapers_dirty: int
    diapers_both: int
    # Diaper entries with no kind recorded (older entries).
    diapers_other: int
    sleep_min: int
    longest_sleep_min: Optional[int] = None


class CareLogAverages(BaseModel):
    # Per day, over the days in the range that have any entry.
    days_with_entries: int
    feeds_per_day: Optional[float] = None
    feed_ml_per_day: Optional[float] = None
    avg_feed_ml: Optional[float] = None
    avg_feed_min: Optional[float] = None
    diapers_per_day: Optional[float] = None
    sleep_min_per_day: Optional[float] = None


class CareLogSummary(BaseModel):
    days: int
    timezone: str
    start: date
    end: date
    daily: list[CareLogDay]
    averages: CareLogAverages


class ProviderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    specialty: Optional[str] = None


class AvailabilitySlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider_id: UUID
    start_time: datetime
    end_time: datetime
    is_booked: bool


class AppointmentCreate(BaseModel):
    child_id: UUID
    slot_id: UUID


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    slot_id: UUID
    caregiver_id: UUID
    status: AppointmentStatus
    checklist: list[str]


class ScreeningSubmitRequest(BaseModel):
    # 10 option indices (0-3, top-to-bottom as printed on the EPDS
    # form), one per item, in item order -- see
    # reference-data/epds_screening.py.
    answers: list[int] = Field(min_length=10, max_length=10)

    @field_validator("answers")
    @classmethod
    def _validate_answer_range(cls, value: list[int]) -> list[int]:
        if any(v not in (0, 1, 2, 3) for v in value):
            raise ValueError("each answer must be 0, 1, 2, or 3")
        return value


class ScreeningSubmitResponse(BaseModel):
    id: UUID
    total_score: int
    # Total-score band only (low/moderate/high), without the item-10
    # override -- risk_level and item_10_flag carry that.
    score_band: str
    risk_level: str
    item_10_flag: bool
    message: str
    created_at: datetime


class ScreeningHistoryItem(BaseModel):
    id: UUID
    total_score: int
    score_band: str
    item_10_flag: bool
    created_at: datetime


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    caregiver_id: UUID
    family_id: UUID
    total_score: int
    risk_level: str
    item_10_flag: bool
    created_at: datetime


class HelpRequestCreate(BaseModel):
    need_type: str
    description: Optional[str] = None
    time_window_start: datetime
    time_window_end: datetime


class HelpRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    family_id: UUID
    created_by: UUID
    need_type: str
    description: Optional[str] = None
    time_window_start: datetime
    time_window_end: datetime
    status: HelpRequestStatus
    claimed_by: Optional[UUID] = None
