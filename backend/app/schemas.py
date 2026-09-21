"""Pydantic request/response models for the API."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import AppointmentStatus, CaregiverRole, CareLogType, HelpRequestStatus


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: CaregiverRole = CaregiverRole.PARENT


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


class MarkGivenRequest(BaseModel):
    administered_date: Optional[date] = None


class GrowthMeasurementCreate(BaseModel):
    measured_at: date
    sex: str
    weight_kg: float


class GrowthMeasurementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    measured_at: date
    age_months: int
    sex: str
    weight_kg: float
    percentile: float
    z_score: float
    source_version: Optional[str] = None


class CareLogCreate(BaseModel):
    type: CareLogType
    timestamp: Optional[datetime] = None
    notes: Optional[str] = None


class CareLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    caregiver_id: UUID
    type: CareLogType
    timestamp: datetime
    notes: Optional[str] = None


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
    risk_level: str
    item_10_flag: bool
    message: str
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
