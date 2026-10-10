from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..invite_codes import normalize_invite_code
from ..models import Caregiver, Family
from ..security import create_access_token, hash_password, verify_password_and_update

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(Caregiver).filter(Caregiver.email == payload.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    if payload.invite_code is not None:
        family = (
            db.query(Family)
            .filter(Family.invite_code == normalize_invite_code(payload.invite_code))
            .first()
        )
        if family is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid invite code")
    else:
        family = Family()
        db.add(family)
        db.flush()

    caregiver = Caregiver(
        family_id=family.id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        permission_level="full",
    )
    db.add(caregiver)
    db.commit()
    db.refresh(caregiver)
    return caregiver


# register and login are plain `def`, not `async def`, on purpose: FastAPI
# runs them in its thread pool, so a slow bcrypt hash can't hold up the
# event loop (WebSockets and every other request keep going meanwhile).
# tests/test_auth.py::test_slow_password_check_does_not_block_other_requests
# checks this.
@router.post("/login", response_model=schemas.TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    caregiver = db.query(Caregiver).filter(Caregiver.email == form_data.username).first()
    verified, new_hash = (
        verify_password_and_update(form_data.password, caregiver.password_hash)
        if caregiver is not None
        else (False, None)
    )
    if not verified:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if new_hash is not None:
        # Stored with an older BCRYPT_ROUNDS; swap in a hash at the current cost.
        caregiver.password_hash = new_hash
        db.commit()
    token = create_access_token(caregiver.id, caregiver.family_id, caregiver.is_provider)
    return schemas.TokenResponse(access_token=token)
