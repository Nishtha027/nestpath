"""Family help-request board: any caregiver can post a need (a meal, an
errand, a few hours of childcare), and any OTHER caregiver in the same
family can claim it. Claiming is race-safe -- see
app/services/help_board.py.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_caregiver
from ..models import Caregiver, HelpRequest, HelpRequestStatus
from ..services.help_board import (
    CannotClaimOwnRequestError,
    HelpRequestAlreadyClaimedError,
    HelpRequestNotClaimedError,
    HelpRequestNotFoundError,
    claim_request,
    complete_request,
)

router = APIRouter(tags=["help-board"])


def _get_help_request_for_caregiver(
    request_id: UUID, caregiver: Caregiver, db: Session
) -> HelpRequest:
    """Looks up a help request, scoped to the caregiver's family. 404 (not
    403) for another family's request, same reasoning as get_child_for_caregiver.
    """
    help_request = db.get(HelpRequest, request_id)
    if help_request is None or help_request.family_id != caregiver.family_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Help request not found")
    return help_request


@router.post(
    "/help-requests", response_model=schemas.HelpRequestResponse, status_code=status.HTTP_201_CREATED
)
def create_help_request(
    payload: schemas.HelpRequestCreate,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    help_request = HelpRequest(
        family_id=caregiver.family_id,
        created_by=caregiver.id,
        need_type=payload.need_type,
        description=payload.description,
        time_window_start=payload.time_window_start,
        time_window_end=payload.time_window_end,
    )
    db.add(help_request)
    db.commit()
    db.refresh(help_request)
    return help_request


@router.get("/help-requests", response_model=list[schemas.HelpRequestResponse])
def list_help_requests(
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    return (
        db.query(HelpRequest)
        .filter(
            HelpRequest.family_id == caregiver.family_id,
            HelpRequest.status == HelpRequestStatus.OPEN,
        )
        .order_by(HelpRequest.time_window_start)
        .all()
    )


@router.post("/help-requests/{request_id}/claim", response_model=schemas.HelpRequestResponse)
def claim_help_request(
    request_id: UUID,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    _get_help_request_for_caregiver(request_id, caregiver, db)

    try:
        help_request = claim_request(db, request_id, caregiver.id)
    except HelpRequestNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except CannotClaimOwnRequestError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except HelpRequestAlreadyClaimedError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    db.commit()
    db.refresh(help_request)
    return help_request


@router.post("/help-requests/{request_id}/complete", response_model=schemas.HelpRequestResponse)
def complete_help_request(
    request_id: UUID,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    _get_help_request_for_caregiver(request_id, caregiver, db)

    try:
        help_request = complete_request(db, request_id, caregiver.id)
    except HelpRequestNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except HelpRequestNotClaimedError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    db.commit()
    db.refresh(help_request)
    return help_request
