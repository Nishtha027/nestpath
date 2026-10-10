"""Password hashing and JWT creation/verification.

JWT_SECRET comes from the environment (see .env.example) -- nothing else
in this module should hold a hardcoded secret.
"""

import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
# Short-lived on purpose: the frontend keeps the token in sessionStorage,
# where injected script could read it, so a stolen token should go stale
# quickly. There are no refresh tokens yet -- after this the user logs in again.
JWT_EXPIRE_MINUTES = 60



def bcrypt_rounds_from_env(value: str | None) -> int:
    """BCRYPT_ROUNDS: bcrypt's cost factor (each step doubles the work).
    10 by default -- every login pays it, and the free-tier server has very
    little CPU. The test suite sets it to bcrypt's minimum, 4, for speed."""
    if value is None or not value.strip():
        return 10
    rounds = int(value)
    if not 4 <= rounds <= 31:
        raise ValueError("BCRYPT_ROUNDS must be between 4 and 31")
    return rounds


BCRYPT_ROUNDS = bcrypt_rounds_from_env(os.environ.get("BCRYPT_ROUNDS"))

# min and max are pinned to the same value so a stored hash made with any
# other cost counts as out of date: verify_password_and_update then hands
# back a fresh hash for the login to save (e.g. upgrading older 12-round
# hashes to 10 rounds). Setting only the default would leave them as they are.
_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=BCRYPT_ROUNDS,
    bcrypt__min_rounds=BCRYPT_ROUNDS,
    bcrypt__max_rounds=BCRYPT_ROUNDS,
)


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return _pwd_context.verify(plain_password, password_hash)


def verify_password_and_update(plain_password: str, password_hash: str) -> tuple[bool, str | None]:
    """Like verify_password, but also returns a replacement hash when the
    stored one used a different BCRYPT_ROUNDS (None when it's current)."""
    return _pwd_context.verify_and_update(plain_password, password_hash)


def create_access_token(caregiver_id: UUID, family_id: UUID, is_provider: bool = False) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(caregiver_id),
        "family_id": str(family_id),
        # Non-authoritative on the backend -- every provider-only endpoint
        # still re-checks Caregiver.is_provider via get_current_provider.
        # This claim only lets the frontend decide whether to show the
        # Alerts page without an extra round trip.
        "is_provider": is_provider,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
