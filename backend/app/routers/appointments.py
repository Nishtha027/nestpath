from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_child_for_caregiver, get_current_caregiver
from ..models import Appointment, AvailabilitySlot, Caregiver, Child
from ..services.booking import SlotAlreadyBookedError, SlotNotFoundError, book_slot

router = APIRouter(tags=["appointments"])


@router.post("/appointments", response_model=schemas.AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: schemas.AppointmentCreate,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    child = db.get(Child, payload.child_id)
    if child is None or child.family_id != caregiver.family_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")

    try:
        appointment = book_slot(db, payload.slot_id, child, caregiver.id)
    except SlotNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except SlotAlreadyBookedError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/children/{child_id}/appointments", response_model=list[schemas.AppointmentResponse])
def list_appointments(child: Child = Depends(get_child_for_caregiver), db: Session = Depends(get_db)):
    return (
        db.query(Appointment)
        .join(AvailabilitySlot, Appointment.slot_id == AvailabilitySlot.id)
        .filter(Appointment.child_id == child.id)
        .order_by(AvailabilitySlot.start_time)
        .all()
    )
