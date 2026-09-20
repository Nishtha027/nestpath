"""Pydantic request/response models for the API."""

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from .models import CaregiverRole


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
