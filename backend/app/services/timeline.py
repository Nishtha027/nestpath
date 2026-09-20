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

from vaccine_schedule import catch_up_plan, source_version  # noqa: E402

from ..models import Child, ScheduleItem  # noqa: E402

_GIVEN = "given"
_PENDING_STATUSES = ("due_now", "upcoming")


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
