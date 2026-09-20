"""Pydantic request/response models for the API."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from .models import CaregiverRole, CareLogType


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
    birth_date: date
    region: Optional[str] = None


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    family_id: UUID
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
