"""EPDS postpartum depression screening submission, and the
provider-only alerts feed for flagged results."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_caregiver, get_current_provider
from ..models import Caregiver, ScreeningResponse
from ..services.screening import message_for_risk, submit_screening

router = APIRouter(tags=["screening"])


@router.post(
    "/screenings", response_model=schemas.ScreeningSubmitResponse, status_code=status.HTTP_201_CREATED
)
def submit_screening_endpoint(
    payload: schemas.ScreeningSubmitRequest,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    try:
        response = submit_screening(db, caregiver.id, caregiver.family_id, payload.answers)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))

    db.commit()
    db.refresh(response)
    return schemas.ScreeningSubmitResponse(
        id=response.id,
        total_score=response.total_score,
        risk_level=response.risk_level,
        item_10_flag=response.item_10_flag,
        message=message_for_risk(response.risk_level, response.item_10_flag),
        created_at=response.created_at,
    )


@router.get("/alerts", response_model=list[schemas.AlertResponse])
def list_alerts(provider: Caregiver = Depends(get_current_provider), db: Session = Depends(get_db)):
    return (
        db.query(ScreeningResponse)
        .filter(ScreeningResponse.risk_level == "high")
        .order_by(ScreeningResponse.created_at)
        .all()
    )
