from datetime import date, timedelta

import pytest

from app.models import AvailabilitySlot, Caregiver, Family, Provider
from scripts.seed_demo_data import (
    DEFAULT_EMAIL,
    DEMO_PROVIDERS,
    LOCAL_DEFAULT_PASSWORD,
    SeedError,
    resolve_password,
    seed,
)

PASSWORD = "a-test-only-password"
# A Monday, so "the next 7 days" is a known mix of weekdays and a weekend.
MONDAY = date(2026, 10, 5)


def test_seed_creates_providers_slots_and_a_working_provider_account(client, db_session):
    result = seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)

    assert result.providers_created == len(DEMO_PROVIDERS)
    assert result.slots_created > 0
    assert result.caregiver_created

    caregiver = db_session.query(Caregiver).filter_by(email=DEFAULT_EMAIL).one()
    assert caregiver.is_provider

    # The account can actually log in and reach the provider-only feed.
    login = client.post("/auth/login", data={"username": DEFAULT_EMAIL, "password": PASSWORD})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/alerts", headers=headers).status_code == 200

    # And any caregiver can see the seeded providers and their open slots.
    providers = client.get("/providers", headers=headers).json()
    assert {p["name"] for p in providers} == {name for name, _, _ in DEMO_PROVIDERS}
    slots = client.get(f"/providers/{providers[0]['id']}/availability", headers=headers).json()
    assert slots and not any(s["is_booked"] for s in slots)


def test_seed_slots_are_future_weekdays_only(db_session):
    seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)

    for slot in db_session.query(AvailabilitySlot).all():
        slot_day = slot.start_time.date()
        assert slot_day > MONDAY
        assert slot_day <= MONDAY + timedelta(days=7)
        assert slot_day.weekday() < 5
        assert slot.end_time > slot.start_time


def test_seed_is_idempotent(db_session):
    seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)
    counts = (
        db_session.query(Provider).count(),
        db_session.query(AvailabilitySlot).count(),
        db_session.query(Caregiver).count(),
        db_session.query(Family).count(),
    )

    second = seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)

    assert second.providers_created == 0
    assert second.slots_created == 0
    assert not second.caregiver_created
    assert counts == (
        db_session.query(Provider).count(),
        db_session.query(AvailabilitySlot).count(),
        db_session.query(Caregiver).count(),
        db_session.query(Family).count(),
    )


def test_seed_tops_up_slots_on_a_later_run(db_session):
    seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)
    before = db_session.query(AvailabilitySlot).count()

    later = seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY + timedelta(days=7))

    assert later.providers_created == 0
    assert later.slots_created > 0
    assert db_session.query(AvailabilitySlot).count() == before + later.slots_created


def test_seed_reuses_an_existing_provider_by_name(db_session):
    name, _, _ = DEMO_PROVIDERS[0]
    db_session.add(Provider(name=name, specialty="Something else"))
    db_session.commit()

    result = seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)

    assert result.providers_created == len(DEMO_PROVIDERS) - 1
    assert result.providers_existing == 1
    assert db_session.query(Provider).filter_by(name=name).count() == 1


def test_seed_does_not_touch_existing_provider_account(db_session):
    seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)
    original_hash = db_session.query(Caregiver).filter_by(email=DEFAULT_EMAIL).one().password_hash

    seed(db_session, DEFAULT_EMAIL, "a-different-password", today=MONDAY)

    db_session.expire_all()
    assert db_session.query(Caregiver).filter_by(email=DEFAULT_EMAIL).one().password_hash == original_hash


def test_seed_refuses_to_promote_an_existing_non_provider_account(client, db_session):
    # Someone registered the demo email first (possible on a public deploy).
    reg = client.post(
        "/auth/register",
        json={"name": "Squatter", "email": DEFAULT_EMAIL, "password": "their-own-password"},
    )
    assert reg.status_code == 201

    with pytest.raises(SeedError, match="not a provider"):
        seed(db_session, DEFAULT_EMAIL, PASSWORD, today=MONDAY)

    db_session.expire_all()
    assert not db_session.query(Caregiver).filter_by(email=DEFAULT_EMAIL).one().is_provider
    assert db_session.query(Provider).count() == 0  # refusal leaves the DB untouched


def test_resolve_password_prefers_explicit_value():
    assert resolve_password("explicit", "postgresql+psycopg://u:p@db.example.com/x") == "explicit"


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost"])
def test_resolve_password_local_database_falls_back_to_default(host):
    assert resolve_password(None, f"postgresql+psycopg://u:p@{host}:5432/x") == LOCAL_DEFAULT_PASSWORD


def test_resolve_password_requires_explicit_value_for_remote_database():
    with pytest.raises(SeedError, match="DEMO_PROVIDER_PASSWORD"):
        resolve_password(None, "postgresql+psycopg://u:p@db.example.com:5432/x")
    with pytest.raises(SeedError):
        resolve_password("", "postgresql+psycopg://u:p@db.example.com:5432/x")
