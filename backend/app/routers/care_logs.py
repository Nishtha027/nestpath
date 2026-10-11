"""Shared caregiving log: caregivers post feed/diaper/sleep/medication
entries for a child, and every caregiver connected to that family's
WebSocket feed sees changes in real time.

WebSocket messages: a created or updated entry is sent as the entry itself
plus "event": "created" | "updated" (older clients ignore the extra key and
merge by id); a deletion is {"event": "deleted", "id", "deleted_from_child"}.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import schemas
from ..database import SessionLocal, get_db
from ..deps import get_child_for_caregiver, get_current_caregiver
from ..models import Caregiver, CareLog, CareLogType, Child
from ..security import decode_access_token
from ..services import care_logs
from ..ws_manager import manager

router = APIRouter(tags=["care-logs"])

SLEEP_RUNNING = "A sleep is already in progress. Stop it first."


def _fail(err: care_logs.CareLogError):
    raise HTTPException(status_code=err.status_code, detail=str(err))


def _get_log(db: Session, child: Child, log_id: UUID) -> CareLog:
    """An entry of this child (already family-scoped), or 404 -- the same
    answer whether it doesn't exist or belongs to another family."""
    log = db.get(CareLog, log_id)
    if log is None or log.child_id != child.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return log


def _apply(log: CareLog, values: dict) -> None:
    log.timestamp = values.pop("occurred_at")
    for field, value in values.items():
        setattr(log, field, value)


async def _save_and_broadcast(db: Session, child: Child, log: CareLog, event: str) -> schemas.CareLogResponse:
    try:
        db.commit()
    except IntegrityError:
        # The one-running-sleep-per-child index: two caregivers started a
        # timer at the same moment.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, SLEEP_RUNNING)
    db.refresh(log)
    response = schemas.CareLogResponse.model_validate(log)
    await manager.broadcast(child.family_id, {**response.model_dump(mode="json"), "event": event})
    return response


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
    now = datetime.now(timezone.utc)
    fields = payload.model_dump(exclude={"type", "timestamp"})
    fields["occurred_at"] = payload.occurred_at or payload.timestamp or now
    if payload.in_progress and (payload.ended_at is not None or payload.duration_min is not None):
        _fail(care_logs.CareLogError("A sleep in progress has no end time yet."))
    try:
        values = care_logs.validate(payload.type, fields, now)
    except care_logs.CareLogError as err:
        _fail(err)
    if values.get("in_progress") and care_logs.sleep_in_progress(db, child.id):
        raise HTTPException(status.HTTP_409_CONFLICT, SLEEP_RUNNING)

    log = CareLog(child_id=child.id, caregiver_id=caregiver.id, type=payload.type)
    _apply(log, values)
    db.add(log)
    return await _save_and_broadcast(db, child, log, "created")


@router.get("/children/{child_id}/care-logs", response_model=list[schemas.CareLogResponse])
def list_care_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    type: Optional[CareLogType] = Query(None),
    since: Optional[datetime] = Query(None, alias="from"),
    until: Optional[datetime] = Query(None, alias="to"),
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    """Most recent entries first (by when they happened), optionally one
    type only and/or a time range (from inclusive, to exclusive). The live
    feed only pushes changes to sockets that are connected at the time, so
    a client that just (re)connected uses this to catch up.
    """
    query = db.query(CareLog).options(joinedload(CareLog.caregiver)).filter(CareLog.child_id == child.id)
    if type is not None:
        query = query.filter(CareLog.type == type)
    if since is not None:
        query = query.filter(CareLog.timestamp >= care_logs.as_utc(since))
    if until is not None:
        query = query.filter(CareLog.timestamp < care_logs.as_utc(until))
    return query.order_by(CareLog.timestamp.desc(), CareLog.id).offset(offset).limit(limit).all()


@router.get("/children/{child_id}/care-logs/latest", response_model=schemas.CareLogLatest)
def latest_care_logs(
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    """The most recent feed, sleep, diaper and medication entry (for the
    Home tiles); a type with no entries yet is null."""
    return care_logs.latest_by_type(db, child.id)


@router.get("/children/{child_id}/care-logs/summary", response_model=schemas.CareLogSummary)
def care_log_summary(
    days: int = Query(7, description="7 or 30"),
    tz: Optional[str] = Query(None, description="IANA timezone for day boundaries, e.g. Europe/London (default UTC)"),
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    """Per-day totals for the last 7 or 30 days (today included), computed
    in SQL, plus averages over the days that have any entry. Days are
    calendar days in `tz` (the browser's timezone), never the server's."""
    try:
        return care_logs.summary(db, child.id, days, care_logs.resolve_timezone(tz), datetime.now(timezone.utc))
    except care_logs.CareLogError as err:
        _fail(err)


@router.patch("/children/{child_id}/care-logs/{log_id}", response_model=schemas.CareLogResponse)
async def update_care_log(
    log_id: UUID,
    payload: schemas.CareLogUpdate,
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    """Any caregiver in the family can correct an entry. Only the fields
    sent change (null clears one), and the whole entry is checked again."""
    log = _get_log(db, child, log_id)
    now = datetime.now(timezone.utc)
    changes = payload.model_dump(exclude_unset=True)
    if "occurred_at" in changes and changes["occurred_at"] is None:
        _fail(care_logs.CareLogError("The time can't be empty."))
    fields = {
        "occurred_at": log.timestamp,
        "notes": log.notes,
        "feed_type": log.feed_type,
        "amount_ml": log.amount_ml,
        "duration_min": log.duration_min,
        "side": log.side,
        "ended_at": log.ended_at,
        "in_progress": log.in_progress,
        "diaper_kind": log.diaper_kind,
    }
    if log.type is CareLogType.SLEEP:
        # A sleep's length lives in ended_at; duration_min is input only.
        # Sending a new length (or end) finishes it; restarting clears it.
        fields["duration_min"] = None
        if "duration_min" in changes or changes.get("in_progress"):
            fields["ended_at"] = None
        if "ended_at" in changes or "duration_min" in changes:
            fields["in_progress"] = False
    fields.update(changes)
    if changes.get("in_progress") and fields.get("ended_at") is not None:
        _fail(care_logs.CareLogError("A sleep in progress has no end time yet."))
    try:
        values = care_logs.validate(log.type, fields, now)
    except care_logs.CareLogError as err:
        _fail(err)
    if values.get("in_progress") and care_logs.sleep_in_progress(db, child.id, exclude=log.id):
        raise HTTPException(status.HTTP_409_CONFLICT, SLEEP_RUNNING)

    _apply(log, values)
    log.updated_at = now
    return await _save_and_broadcast(db, child, log, "updated")


@router.delete("/children/{child_id}/care-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_log(
    log_id: UUID,
    child: Child = Depends(get_child_for_caregiver),
    db: Session = Depends(get_db),
):
    log = _get_log(db, child, log_id)
    db.delete(log)
    db.commit()
    # No "child_id" key on purpose: clients from before deletes existed
    # show any message with a child_id as an entry.
    await manager.broadcast(
        child.family_id, {"event": "deleted", "id": str(log_id), "deleted_from_child": str(child.id)}
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
        # Accept, then close with 1008. Closing *before* accepting rejects
        # the handshake with an HTTP 403, and browsers report that as a
        # generic 1006 -- indistinguishable from a network drop, so a client
        # with an expired token would reconnect forever. After accept, the
        # browser actually sees the 1008 and can stop retrying.
        await websocket.accept()
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
