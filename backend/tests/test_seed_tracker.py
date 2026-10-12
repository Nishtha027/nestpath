"""The baby-tracker demo family in scripts/seed_demo_data.py: a parent who
can log in, a week of plausible entries that the API accepts and summarizes,
and nothing duplicated on a re-run."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models import Caregiver, CareLog, CareLogType, Child
from scripts.seed_demo_data import (
    DEMO_CHILD_NAME,
    DEMO_PARENT_EMAIL,
    DEMO_PARTNER_EMAIL,
    TRACKER_DAYS,
    SeedError,
    demo_day_entries,
    is_local,
    resolve_demo_timezone,
    seed,
    seed_tracker,
)

PASSWORD = "a-test-only-password"
TZ = ZoneInfo("Asia/Kolkata")
# Mid-afternoon local time, so today has some entries and not others.
NOW = datetime(2026, 10, 12, 15, 30, tzinfo=TZ).astimezone(timezone.utc)


def _login(client) -> dict:
    login = client.post("/auth/login", data={"username": DEMO_PARENT_EMAIL, "password": PASSWORD})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_seed_tracker_creates_a_family_with_a_week_of_entries(client, db_session):
    result = seed_tracker(db_session, PASSWORD, now=NOW, tz=TZ)
    assert result.parent_created and result.child_created
    assert result.entries_created > 0

    headers = _login(client)
    children = client.get("/children", headers=headers).json()
    assert [c["name"] for c in children] == [DEMO_CHILD_NAME]
    child_id = children[0]["id"]

    # Every type, both caregivers' names, nothing in the future, no running sleep.
    entries = client.get(f"/children/{child_id}/care-logs?limit=200", headers=headers).json()
    assert {e["type"] for e in entries} == {"feed", "sleep", "diaper"}
    assert {e["caregiver_name"] for e in entries} == {"Alex", "Sam"}
    assert {e["feed_type"] for e in entries if e["type"] == "feed"} == {"breast", "bottle", "solid"}
    assert not any(e["in_progress"] for e in entries)
    for e in entries:
        assert datetime.fromisoformat(e["occurred_at"]) <= NOW
        if e["ended_at"]:
            assert datetime.fromisoformat(e["ended_at"]) <= NOW

    # One longer overnight stretch stands out from the other nights.
    sleeps = sorted(
        (datetime.fromisoformat(e["ended_at"]) - datetime.fromisoformat(e["occurred_at"])).total_seconds() / 3600
        for e in entries
        if e["type"] == "sleep"
    )
    assert sleeps[-1] >= 7
    assert sleeps[-2] < 5.5

    # The summary sees the whole week, with the same day boundaries.
    summary = client.get(
        f"/children/{child_id}/care-logs/summary?days=7&tz=Asia/Kolkata", headers=headers
    ).json()
    assert summary["averages"]["days_with_entries"] == TRACKER_DAYS
    assert all(day["feeds"] >= 1 for day in summary["daily"])
    assert all(day["sleep_min"] > 0 for day in summary["daily"])


def test_seed_tracker_is_safe_to_re_run(db_session):
    first = seed_tracker(db_session, PASSWORD, now=NOW, tz=TZ)
    counts = (db_session.query(CareLog).count(), db_session.query(Caregiver).count(), db_session.query(Child).count())

    again = seed_tracker(db_session, PASSWORD, now=NOW, tz=TZ)
    assert not again.parent_created and not again.child_created
    assert again.entries_created == 0
    assert again.entries_existing == first.entries_created
    assert counts == (db_session.query(CareLog).count(), db_session.query(Caregiver).count(), db_session.query(Child).count())

    # A day later it only adds the new day's entries.
    later = seed_tracker(db_session, PASSWORD, now=NOW + timedelta(days=1), tz=TZ)
    assert 0 < later.entries_created < first.entries_created
    db_session.expire_all()
    assert db_session.query(CareLog).count() == counts[0] + later.entries_created


def test_the_partner_account_cannot_log_in_with_the_parent_password(client, db_session):
    seed_tracker(db_session, PASSWORD, now=NOW, tz=TZ)
    login = client.post("/auth/login", data={"username": DEMO_PARTNER_EMAIL, "password": PASSWORD})
    assert login.status_code == 401


def test_seed_tracker_refuses_a_provider_account(db_session):
    seed(db_session, DEMO_PARENT_EMAIL, PASSWORD)
    with pytest.raises(SeedError, match="provider"):
        seed_tracker(db_session, PASSWORD, now=NOW, tz=TZ)


def test_demo_days_are_deterministic_and_plausible():
    day = NOW.astimezone(TZ).date()
    assert demo_day_entries(day, TZ) == demo_day_entries(day, TZ)
    for entry in demo_day_entries(day, TZ):
        if entry.get("amount_ml") is not None:
            assert 1 <= entry["amount_ml"] <= 500
        if entry.get("duration_min") is not None:
            assert 1 <= entry["duration_min"] <= 180
        if entry["type"] is CareLogType.SLEEP:
            assert timedelta(0) < entry["ended_at"] - entry["occurred_at"] <= timedelta(hours=24)


def test_tracker_data_is_for_local_databases_only():
    assert is_local("postgresql+psycopg://u:p@127.0.0.1:55432/x")
    assert is_local("postgresql+psycopg://u:p@localhost/x")
    assert not is_local("postgresql+psycopg://u:p@db.example.com/x")


def test_demo_timezone():
    assert resolve_demo_timezone("Europe/London") == ZoneInfo("Europe/London")
    assert resolve_demo_timezone(None) is not None
    with pytest.raises(SeedError, match="DEMO_TZ"):
        resolve_demo_timezone("Not/AZone")
