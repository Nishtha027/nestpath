from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Caregiver, Family
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(Caregiver).filter(Caregiver.email == payload.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

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


@router.post("/login", response_model=schemas.TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    caregiver = db.query(Caregiver).filter(Caregiver.email == form_data.username).first()
    if caregiver is None or not verify_password(form_data.password, caregiver.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(caregiver.id, caregiver.family_id)
    return schemas.TokenResponse(access_token=token)
