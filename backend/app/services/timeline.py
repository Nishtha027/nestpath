"""Generates and updates a Child's personalized vaccine schedule using
backend/reference-data/vaccine_schedule.py's catch_up_plan().

reference-data/ is a hyphenated directory name, not a valid Python
package -- it's added to sys.path here so vaccine_schedule can be
imported as a top-level module, rather than being restructured (it's a
Phase 0 deliverable, referenced by path elsewhere).
"""

import sys
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

_REFERENCE_DATA_DIR = Path(__file__).resolve().parents[2] / "reference-data"
if str(_REFERENCE_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(_REFERENCE_DATA_DIR))

from sqlalchemy import select  # noqa: E402

from vaccine_schedule import AGE_WINDOW_CLOSED, catch_up_plan, source_version  # noqa: E402

from ..models import Child, ScheduleItem  # noqa: E402

_GIVEN = "given"
# Statuses that get a not-yet-given row. A closed-window dose still gets
# one, shown as "no longer recommended at this age", so a parent can still
# record it if it was in fact given earlier, within its window.
_PENDING_STATUSES = ("due_now", "upcoming", AGE_WINDOW_CLOSED)


def _administered_history(db: Session, child_id) -> dict[str, list[date]]:
    """Build the {vaccine_id: [administered dates]} history catch_up_plan()
    expects, from this child's already-given ScheduleItem rows.
    """
    given_items = (
        db.query(ScheduleItem)
        .filter(ScheduleItem.child_id == child_id, ScheduleItem.status == _GIVEN)
        .order_by(ScheduleItem.dose_number)
        .all()
    )
    history: dict[str, list[date]] = {}
    for item in given_items:
        history.setdefault(item.vaccine_id, []).append(item.administered_date)
    return history


def _create_pending_items(db: Session, child: Child, today: date) -> list[ScheduleItem]:
    """Call catch_up_plan() with this child's real administered history
    and create a ScheduleItem for every vaccine that doesn't already have
    a pending (not-yet-given) item.
    """
    history = _administered_history(db, child.id)
    plan = catch_up_plan(child.birth_date, history, today)

    already_pending = {
        item.vaccine_id
        for item in db.query(ScheduleItem)
        .filter(ScheduleItem.child_id == child.id, ScheduleItem.status != _GIVEN)
        .all()
    }

    created: list[ScheduleItem] = []
    for vaccine_id, result in plan.items():
        if vaccine_id in already_pending:
            continue
        if result.status not in _PENDING_STATUSES or result.dose_number is None:
            continue
        item = ScheduleItem(
            child_id=child.id,
            type="vaccine_dose",
            vaccine_id=vaccine_id,
            dose_number=result.dose_number,
            due_date=result.earliest_valid_date,
            status=result.status,
            notes=result.notes or None,
            source_version=source_version,
        )
        db.add(item)
        created.append(item)
    return created


def generate_schedule_for_child(
    db: Session, child: Child, today: date | None = None
) -> list[ScheduleItem]:
    """Generate the initial personalized vaccine schedule for a newly
    created child: one pending ScheduleItem per vaccine, each holding the
    real next-due dose computed by catch_up_plan() (never a placeholder).
    """
    return _create_pending_items(db, child, today or date.today())


def refresh_stale_pending_items(db: Session, child: Child, today: date | None = None) -> bool:
    """Regenerate this child's not-yet-given rows if any were written by an
    older encoding of the schedule (different source_version) -- e.g.
    rows from before the 2026-10-07 revision, which scheduled doses at
    their minimum age (MenACWY at 2 months). Given doses are history and
    are never touched. Returns True if anything was regenerated (caller
    commits).

    The child row is locked first and staleness re-checked under the lock,
    so two concurrent requests can't both regenerate and duplicate rows.
    """

    def has_stale() -> bool:
        return (
            db.query(ScheduleItem)
            .filter(
                ScheduleItem.child_id == child.id,
                ScheduleItem.status != _GIVEN,
                ScheduleItem.source_version.is_distinct_from(source_version),
            )
            .first()
            is not None
        )

    if not has_stale():
        return False
    db.execute(select(Child).where(Child.id == child.id).with_for_update())
    if not has_stale():
        return False

    for item in (
        db.query(ScheduleItem)
        .filter(ScheduleItem.child_id == child.id, ScheduleItem.status != _GIVEN)
        .all()
    ):
        db.delete(item)
    db.flush()
    _create_pending_items(db, child, today or date.today())
    db.flush()
    return True


def record_dose_given(
    db: Session,
    child: Child,
    item: ScheduleItem,
    administered_date: date,
    today: date | None = None,
) -> list[ScheduleItem]:
    """Mark a ScheduleItem as administered, then re-run catch_up_plan()
    with the updated real history and create the next pending item for
    that vaccine, if one is due. A missed/delayed dose correctly shifts
    the downstream due date, since catch_up_plan() computes it from the
    real administered_date rather than the original estimate.
    """
    item.status = _GIVEN
    item.administered_date = administered_date
    db.flush()
    created = _create_pending_items(db, child, today or date.today())
    return [item, *created]


class DoseUndoError(ValueError):
    """The dose can't be marked not given (see undo_dose_given)."""


def undo_dose_given(
    db: Session,
    child: Child,
    item: ScheduleItem,
    today: date | None = None,
) -> list[ScheduleItem]:
    """Reverse record_dose_given(): drop the follow-up pending dose it
    created for this vaccine, and turn `item` back into the pending dose,
    with its due date recomputed by catch_up_plan() from the remaining
    real history.

    Only the most recent given dose of a vaccine can be undone -- undoing
    an earlier one would leave later given doses with no valid
    predecessor. Returns [item] if it is pending again, or [] if the plan
    no longer calls for that dose (e.g. the child has aged out of it), in
    which case the row is removed.
    """
    if item.status != _GIVEN:
        raise DoseUndoError("Dose is not marked as given")

    later_given = (
        db.query(ScheduleItem)
        .filter(
            ScheduleItem.child_id == child.id,
            ScheduleItem.vaccine_id == item.vaccine_id,
            ScheduleItem.status == _GIVEN,
            ScheduleItem.dose_number > item.dose_number,
        )
        .count()
    )
    if later_given:
        raise DoseUndoError("Only the most recent dose of a vaccine can be marked not given")

    for pending in (
        db.query(ScheduleItem)
        .filter(
            ScheduleItem.child_id == child.id,
            ScheduleItem.vaccine_id == item.vaccine_id,
            ScheduleItem.status != _GIVEN,
        )
        .all()
    ):
        db.delete(pending)

    item.administered_date = None
    item.status = "upcoming"  # placeholder, so it drops out of the history below
    db.flush()

    plan = catch_up_plan(child.birth_date, _administered_history(db, child.id), today or date.today())
    result = plan.get(item.vaccine_id)
    if result is None or result.status not in _PENDING_STATUSES or result.dose_number != item.dose_number:
        db.delete(item)
        db.flush()
        return []

    item.due_date = result.earliest_valid_date
    item.status = result.status
    item.notes = result.notes or None
    item.source_version = source_version
    db.flush()
    return [item]
