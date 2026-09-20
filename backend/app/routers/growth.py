from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_child_for_caregiver
from ..models import Child, GrowthMeasurement
from ..services.growth import record_growth_measurement

router = APIRouter(prefix="/children", tags=["growth"])


@router.post(
    "/{child_id}/growth",
    response_model=schemas.GrowthMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_growth_measurement(
    payload: schemas.GrowthMeasurementCreate,
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    try:
        measurement = record_growth_measurement(
            db, child, payload.measured_at, payload.sex, payload.weight_kg
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(measurement)
    return measurement


@router.get("/{child_id}/growth", response_model=list[schemas.GrowthMeasurementResponse])
def list_growth_measurements(
    child: Child = Depends(get_child_for_caregiver), db: Session = Depends(get_db)
):
    return (
        db.query(GrowthMeasurement)
        .filter(GrowthMeasurement.child_id == child.id)
        .order_by(GrowthMeasurement.measured_at)
        .all()
    )
