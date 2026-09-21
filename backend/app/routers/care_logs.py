"""Shared caregiving log: caregivers post feed/diaper/sleep/medication
entries for a child, and every caregiver connected to that family's
WebSocket feed sees new entries in real time.
"""

from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import SessionLocal, get_db
from ..deps import get_child_for_caregiver, get_current_caregiver
from ..models import Caregiver, CareLog, Child
from ..security import decode_access_token
from ..ws_manager import manager

router = APIRouter(tags=["care-logs"])


@router.post(
    "/children/{child_id}/care-logs",
    response_model=schemas.CareLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_care_log(
    payload: schemas.CareLogCreate,
    child: Child = Depends(get_child_for_caregiver),
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    log = CareLog(
        child_id=child.id,
        caregiver_id=caregiver.id,
        type=payload.type,
        notes=payload.notes,
    )
    if payload.timestamp is not None:
        log.timestamp = payload.timestamp
    db.add(log)
    db.commit()
    db.refresh(log)

    response = schemas.CareLogResponse.model_validate(log)
    await manager.broadcast(child.family_id, response.model_dump(mode="json"))
    return response


@router.websocket("/ws/families/{family_id}")
async def family_care_log_feed(websocket: WebSocket, family_id: UUID):
    # Browsers can't set custom headers on a WebSocket handshake, so the
    # JWT travels as a query param here instead of an Authorization header.
    # The DB session is scoped to just this auth check and closed right
    # after -- unlike Depends(get_db), which would keep it open, idle in
    # a transaction, for as long as the socket stays connected (this can
    # block unrelated DDL and, with enough concurrent connections,
    # exhaust the connection pool).
    token = websocket.query_params.get("token")
    caregiver = None
    if token is not None:
        db = SessionLocal()
        try:
            payload = decode_access_token(token)
            caregiver = db.get(Caregiver, UUID(payload["sub"]))
        except (jwt.InvalidTokenError, KeyError, ValueError):
            caregiver = None
        finally:
            db.close()

    if caregiver is None or caregiver.family_id != family_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(family_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(family_id, websocket)
