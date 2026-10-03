from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..dates import is_in_future
from ..deps import get_child_for_caregiver, get_current_caregiver
from ..models import Caregiver, Child, ScheduleItem
from ..services.timeline import generate_schedule_for_child, record_dose_given

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


@router.get("/{child_id}/schedule", response_model=list[schemas.ScheduleItemResponse])
def get_schedule(child: Child = Depends(get_child_for_caregiver), db: Session = Depends(get_db)):
    return (
        db.query(ScheduleItem)
        .filter(ScheduleItem.child_id == child.id)
        # vaccine_id/dose_number break due_date ties, so rows keep a stable
        # order across refetches (e.g. after mark-given) instead of shuffling.
        .order_by(ScheduleItem.due_date, ScheduleItem.vaccine_id, ScheduleItem.dose_number)
        .all()
    )


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
    return updated
