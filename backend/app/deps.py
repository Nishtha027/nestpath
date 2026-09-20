"""FastAPI dependencies: extract & validate the current caregiver from a
JWT, and scope child lookups to that caregiver's family.
"""

from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Caregiver, Child
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_caregiver(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Caregiver:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        caregiver_id = UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise credentials_error

    caregiver = db.get(Caregiver, caregiver_id)
    if caregiver is None:
        raise credentials_error
    return caregiver


def get_child_for_caregiver(
    child_id: UUID,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
) -> Child:
    """Look up a child, scoped to the current caregiver's family. Returns
    404 (not 403) for another family's child, so callers can't use this
    endpoint to probe which child IDs exist outside their own family.
    """
    child = db.get(Child, child_id)
    if child is None or child.family_id != caregiver.family_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    return child
