"""SQLAlchemy models: Family, Child, Caregiver, ScheduleItem."""

import enum
import uuid

from sqlalchemy import Column, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


class CaregiverRole(str, enum.Enum):
    PARENT = "parent"
    CO_PARENT = "co-parent"
    GRANDPARENT = "grandparent"
    SITTER = "sitter"


class Family(Base):
    __tablename__ = "families"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    children = relationship("Child", back_populates="family", cascade="all, delete-orphan")
    caregivers = relationship("Caregiver", back_populates="family", cascade="all, delete-orphan")


class Child(Base):
    __tablename__ = "children"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False)
    birth_date = Column(Date, nullable=False)
    region = Column(String, nullable=True)

    family = relationship("Family", back_populates="children")
    schedule_items = relationship("ScheduleItem", back_populates="child", cascade="all, delete-orphan")


class Caregiver(Base):
    __tablename__ = "caregivers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(CaregiverRole, name="caregiver_role"), nullable=False)
    # Free-form for now (e.g. "full", "view_only") -- permission rules are Phase 3+.
    permission_level = Column(String, nullable=False)

    family = relationship("Family", back_populates="caregivers")


class ScheduleItem(Base):
    __tablename__ = "schedule_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id"), nullable=False)
    # e.g. "vaccine_dose" -- only value so far; "growth_check" is Phase 3+.
    type = Column(String, nullable=False)
    # vaccine_schedule.py's dict key for this series, e.g. "dtap", "hpv".
    vaccine_id = Column(String, nullable=False)
    dose_number = Column(Integer, nullable=True)
    due_date = Column(Date, nullable=False)
    # DoseResult.status from vaccine_schedule.py ("due_now" / "upcoming"),
    # or "given" once mark-given has been called on this item.
    status = Column(String, nullable=False)
    administered_date = Column(Date, nullable=True)
    # DoseResult.notes, e.g. CDC max-age-window warnings.
    notes = Column(String, nullable=True)
    # Provenance tag, e.g. vaccine_schedule.source_version ("CDC
    # 2025-07-02, pre-2025-ACIP-changes, per AAP v. Kennedy injunction").
    source_version = Column(String, nullable=True)

    child = relationship("Child", back_populates="schedule_items")
