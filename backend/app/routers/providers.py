from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_caregiver
from ..models import AvailabilitySlot, Caregiver, Provider

router = APIRouter(tags=["providers"])


@router.get(
    "/providers/{provider_id}/availability",
    response_model=list[schemas.AvailabilitySlotResponse],
)
def get_provider_availability(
    provider_id: UUID,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    provider = db.get(Provider, provider_id)
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")

    return (
        db.query(AvailabilitySlot)
        .filter(AvailabilitySlot.provider_id == provider_id, AvailabilitySlot.is_booked.is_(False))
        .order_by(AvailabilitySlot.start_time)
        .all()
    )
