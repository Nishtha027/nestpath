from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..dates import is_in_future
from ..deps import get_child_for_caregiver, get_current_caregiver
from ..models import Caregiver, Child, ScheduleItem
from ..services.timeline import (
    DoseUndoError,
    generate_schedule_for_child,
    record_dose_given,
    refresh_stale_pending_items,
    undo_dose_given,
)
from vaccine_schedule import AGE_WINDOW_CLOSED, age_window  # noqa: E402  (path set up by services.timeline)

router = APIRouter(prefix="/children", tags=["children"])


@router.post("", response_model=schemas.ChildResponse, status_code=status.HTTP_201_CREATED)
def create_child(
    payload: schemas.ChildCreate,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    child = Child(
        family_id=caregiver.family_id,
        name=payload.name,
        birth_date=payload.birth_date,
        region=payload.region,
    )
    db.add(child)
    db.flush()
    generate_schedule_for_child(db, child)
    db.commit()
    db.refresh(child)
    return child


@router.get("", response_model=list[schemas.ChildResponse])
def list_children(
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    return (
        db.query(Child)
        .filter(Child.family_id == caregiver.family_id)
        .order_by(Child.birth_date)
        .all()
    )


def _item_response(item: ScheduleItem, child: Child) -> schemas.ScheduleItemResponse:
    """A schedule row plus its hard age limit. A not-yet-given dose whose
    window has closed since the row was written is reported as
    "age_window_closed" -- never as due or overdue."""
    closes_on, window_note = age_window(item.vaccine_id, item.dose_number, child.birth_date)
    response = schemas.ScheduleItemResponse.model_validate(item)
    response.window_closes_on = closes_on
    response.age_window_note = window_note or None
    if item.status != "given" and closes_on is not None and date.today() >= closes_on:
        response.status = AGE_WINDOW_CLOSED
    return response


@router.get("/{child_id}/schedule", response_model=list[schemas.ScheduleItemResponse])
def get_schedule(child: Child = Depends(get_child_for_caregiver), db: Session = Depends(get_db)):
    if refresh_stale_pending_items(db, child):
        db.commit()
    items = (
        db.query(ScheduleItem)
        .filter(ScheduleItem.child_id == child.id)
        # vaccine_id/dose_number break due_date ties, so rows keep a stable
        # order across refetches (e.g. after mark-given) instead of shuffling.
        .order_by(ScheduleItem.due_date, ScheduleItem.vaccine_id, ScheduleItem.dose_number)
        .all()
    )
    return [_item_response(item, child) for item in items]


@router.post(
    "/{child_id}/schedule/{item_id}/mark-given",
    response_model=list[schemas.ScheduleItemResponse],
)
def mark_given(
    item_id: UUID,
    payload: schemas.MarkGivenRequest,
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    item = db.get(ScheduleItem, item_id)
    if item is None or item.child_id != child.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule item not found")
    if item.status == "given":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dose already marked as given")

    administered_date = payload.administered_date or date.today()
    if is_in_future(administered_date):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Administered date cannot be in the future")

    updated = record_dose_given(db, child, item, administered_date)
    db.commit()
    for updated_item in updated:
        db.refresh(updated_item)
    return [_item_response(updated_item, child) for updated_item in updated]


@router.post(
    "/{child_id}/schedule/{item_id}/mark-not-given",
    response_model=list[schemas.ScheduleItemResponse],
)
def mark_not_given(
    item_id: UUID,
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    """Undo a mark-given. Takes no date, so there is nothing to
    future-date-check; correcting a wrong date is undo then mark-given
    again, which does check it."""
    item = db.get(ScheduleItem, item_id)
    if item is None or item.child_id != child.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule item not found")
    if item.status != "given":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dose is not marked as given")

    try:
        updated = undo_dose_given(db, child, item)
    except DoseUndoError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    db.commit()
    for updated_item in updated:
        db.refresh(updated_item)
    return [_item_response(updated_item, child) for updated_item in updated]
