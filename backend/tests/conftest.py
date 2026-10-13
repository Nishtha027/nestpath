"""Test fixtures. Requires a running Postgres reachable via DATABASE_URL
(see backend/.env) -- SQLite can't be used here since the models use
Postgres-specific UUID/ENUM types. Point DATABASE_URL at a disposable
test database, never a real one: each test drops and recreates all
tables. The suite refuses to start unless the host is local.
"""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_REFERENCE_DATA_DIR = Path(__file__).resolve().parents[1] / "reference-data"
if str(_REFERENCE_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(_REFERENCE_DATA_DIR))

# bcrypt's minimum cost: the suite hashes a lot of passwords, and the cost
# itself isn't what these tests check. Set before app.security is imported.
os.environ["BCRYPT_ROUNDS"] = "4"

from app.database import Base, SessionLocal, engine, get_db
from app.main import app

# Every test drops and recreates all tables, so refuse to run against
# anything but a local database. Creating the engine doesn't connect, so
# this check runs before a single query reaches the server.
_LOCAL_TEST_HOSTS = {"127.0.0.1", "localhost", "::1"}
if engine.url.host not in _LOCAL_TEST_HOSTS:
    raise pytest.UsageError(
        "Refusing to run the test suite: DATABASE_URL points at host "
        f"{engine.url.host!r}, not 127.0.0.1 or localhost. The tests drop "
        "every table. Point DATABASE_URL at a local, disposable database."
    )


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Register + log in a caregiver, returning (headers, register_response_json)."""

    def _register_and_login(email="parent@example.com", password="correct horse battery staple", name="Test Parent"):
        register_resp = client.post(
            "/auth/register",
            json={"name": name, "email": email, "password": password},
        )
        assert register_resp.status_code == 201, register_resp.text

        login_resp = client.post(
            "/auth/login",
            data={"username": email, "password": password},
        )
        assert login_resp.status_code == 200, login_resp.text
        token = login_resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}, register_resp.json()

    return _register_and_login
