"""SQLAlchemy models: Family, Child, Caregiver, ScheduleItem."""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    func,
)
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
    # Nullable: children created before this field existed (Phase 2/3 tests)
    # have none, and the API accepts a child without one too.
    name = Column(String, nullable=True)
    birth_date = Column(Date, nullable=False)
    region = Column(String, nullable=True)

    family = relationship("Family", back_populates="children")
    schedule_items = relationship("ScheduleItem", back_populates="child", cascade="all, delete-orphan")
    growth_measurements = relationship(
        "GrowthMeasurement", back_populates="child", cascade="all, delete-orphan"
    )
    care_logs = relationship("CareLog", back_populates="child", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="child", cascade="all, delete-orphan")


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
    # Grants access to GET /alerts (flagged screenings across all
    # families, not just this caregiver's own) -- see deps.get_current_provider.
    is_provider = Column(Boolean, nullable=False, default=False, server_default="false")

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


class Provider(Base):
    __tablename__ = "providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    specialty = Column(String, nullable=True)

    availability_slots = relationship(
        "AvailabilitySlot", back_populates="provider", cascade="all, delete-orphan"
    )


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_booked = Column(Boolean, nullable=False, default=False, server_default="false")

    provider = relationship("Provider", back_populates="availability_slots")
    appointment = relationship("Appointment", back_populates="slot", uselist=False)


class AppointmentStatus(str, enum.Enum):
    BOOKED = "booked"
    CANCELLED = "cancelled"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id"), nullable=False)
    # unique: a slot can back at most one (non-cancelled-aware) appointment --
    # belt-and-suspenders alongside book_slot()'s row lock in booking.py.
    slot_id = Column(
        UUID(as_uuid=True), ForeignKey("availability_slots.id"), nullable=False, unique=True
    )
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("caregivers.id"), nullable=False)
    status = Column(
        SAEnum(AppointmentStatus, name="appointment_status"),
        nullable=False,
        default=AppointmentStatus.BOOKED,
    )
    # Auto-generated visit-prep questions (see app/services/booking.py).
    checklist = Column(JSON, nullable=False, default=list)

    child = relationship("Child", back_populates="appointments")
    slot = relationship("AvailabilitySlot", back_populates="appointment")
    caregiver = relationship("Caregiver")


class ScreeningResponse(Base):
    __tablename__ = "screening_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("caregivers.id"), nullable=False)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False)
    # List of 10 raw option indices (0-3, top-to-bottom as printed on the
    # EPDS form), in item order -- see reference-data/epds_screening.py.
    answers = Column(JSON, nullable=False)
    total_score = Column(Integer, nullable=False)
    # "low" | "moderate" | "high" -- see epds_screening.score_epds().
    risk_level = Column(String, nullable=False)
    # True iff item 10 (self-harm ideation) was answered as anything
    # other than "Never" -- forces risk_level to "high" regardless of
    # total_score. See app/services/screening.py for the safety rule.
    item_10_flag = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source_version = Column(String, nullable=True)

    caregiver = relationship("Caregiver")
    family = relationship("Family")
