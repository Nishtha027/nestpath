"""Books an AvailabilitySlot for a child, and generates an age-appropriate
visit-prep checklist.

Booking is made race-safe with SELECT ... FOR UPDATE: the slot row is
locked for the rest of the DB transaction, so a second, concurrent
booking attempt for the same slot blocks at the database level until
the first request commits (or rolls back) -- it then sees the slot as
already booked and fails cleanly, rather than racing to double-book it.
Appointment.slot_id also carries a unique constraint as a second,
independent guard against the same failure mode.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Appointment, AppointmentStatus, AvailabilitySlot, Child


class SlotNotFoundError(Exception):
    pass


class SlotAlreadyBookedError(Exception):
    pass


# (age_in_days_at_most, label, questions) -- simple brackets following the
# standard well-child visit cadence, not sourced from a specific
# guideline the way vaccine_schedule.py/growth_percentile.py are.
_CHECKLIST_BRACKETS: list[tuple[int, str, list[str]]] = [
    (21, "2-week visit", [
        "How is feeding going (breast/bottle, frequency, amount)?",
        "Has the umbilical cord stump fully fallen off and healed?",
        "Any concerns about jaundice or skin color?",
    ]),
    (45, "1-month visit", [
        "How many wet/dirty diapers per day?",
        "Is the baby sleeping in safe positions (back to sleep)?",
        "Any questions about the upcoming 2-month vaccines?",
    ]),
    (75, "2-month visit", [
        "How is the baby tolerating vaccines so far?",
        "Any concerns about tummy time or head shape?",
        "Is the baby tracking faces or objects with their eyes?",
    ]),
    (150, "4-month visit", [
        "Is the baby rolling over, or showing signs of doing so?",
        "How is sleep going -- naps and night stretches?",
        "Any interest in starting solids soon?",
    ]),
    (240, "6-month visit", [
        "Has solid food been introduced? Any reactions?",
        "Is the baby sitting up with or without support?",
        "Any concerns about teething?",
    ]),
    (330, "9-month visit", [
        "Is the baby crawling or pulling to stand?",
        "How is the transition to more solid textures going?",
        "Any words or babbling sounds yet?",
    ]),
    (450, "12-month visit", [
        "Is the baby walking or cruising along furniture?",
        "How many words, if any, is the baby using?",
        "Any plans to transition off formula/breastmilk?",
    ]),
]
_DEFAULT_CHECKLIST_QUESTIONS = [
    "Any new developmental milestones since the last visit?",
    "Any concerns about eating, sleeping, or behavior?",
    "Any questions about upcoming immunizations?",
]


def generate_checklist(birth_date: date, appointment_date: date) -> list[str]:
    """Age-bracketed visit-prep questions, keyed by the child's age in days
    at the appointment date. Falls back to generic well-child questions
    outside the modeled brackets (e.g. toddler+ visits).
    """
    age_days = (appointment_date - birth_date).days
    for max_age_days, _label, questions in _CHECKLIST_BRACKETS:
        if age_days <= max_age_days:
            return list(questions)
    return list(_DEFAULT_CHECKLIST_QUESTIONS)


def book_slot(db: Session, slot_id: UUID, child: Child, caregiver_id: UUID) -> Appointment:
    """Atomically books a slot for a child. Locks the slot row for the rest
    of this transaction, so a concurrent booking attempt for the same
    slot blocks here until this transaction commits or rolls back, then
    correctly sees it as already booked. Caller is responsible for
    committing (on success) or rolling back (on either error).
    """
    slot = db.execute(
        select(AvailabilitySlot).where(AvailabilitySlot.id == slot_id).with_for_update()
    ).scalar_one_or_none()
    if slot is None:
        raise SlotNotFoundError(f"Availability slot {slot_id} not found")
    if slot.is_booked:
        raise SlotAlreadyBookedError(f"Availability slot {slot_id} is already booked")

    slot.is_booked = True
    appointment = Appointment(
        child_id=child.id,
        slot_id=slot.id,
        caregiver_id=caregiver_id,
        status=AppointmentStatus.BOOKED,
        checklist=generate_checklist(child.birth_date, slot.start_time.date()),
    )
    db.add(appointment)
    db.flush()
    return appointment
