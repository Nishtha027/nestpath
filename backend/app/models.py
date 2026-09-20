"""SQLAlchemy models: Family, Child, Caregiver, ScheduleItem."""

import enum
import uuid

from sqlalchemy import Column, Date, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, func
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
    growth_measurements = relationship(
        "GrowthMeasurement", back_populates="child", cascade="all, delete-orphan"
    )
    care_logs = relationship("CareLog", back_populates="child", cascade="all, delete-orphan")


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
    # e.g. "vaccine_dose" -- only value so far.
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


class GrowthMeasurement(Base):
    __tablename__ = "growth_measurements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id"), nullable=False)
    measured_at = Column(Date, nullable=False)
    # Age in completed months at measured_at (0-24), as growth_percentile.py's
    # WHO LMS tables require -- computed from child.birth_date, not user input.
    age_months = Column(Integer, nullable=False)
    sex = Column(String, nullable=False)
    weight_kg = Column(Float, nullable=False)
    percentile = Column(Float, nullable=False)
    z_score = Column(Float, nullable=False)
    # Provenance tag for the LMS table used, e.g. growth_percentile's WHO/CDC
    # source and retrieval date (see app/services/growth.py SOURCE_VERSION).
    source_version = Column(String, nullable=True)

    child = relationship("Child", back_populates="growth_measurements")


class CareLogType(str, enum.Enum):
    FEED = "feed"
    DIAPER = "diaper"
    SLEEP = "sleep"
    MEDICATION = "medication"


class CareLog(Base):
    __tablename__ = "care_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id"), nullable=False)
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("caregivers.id"), nullable=False)
    type = Column(SAEnum(CareLogType, name="care_log_type"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    notes = Column(String, nullable=True)

    child = relationship("Child", back_populates="care_logs")
    caregiver = relationship("Caregiver")
