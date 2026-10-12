"""The structured baby tracker on top of the care log: per-type validation,
edit/delete with live broadcasts, family isolation, the latest-of-each-type
lookup, the per-day summary (timezone day boundaries, a sleep across
midnight, a sleep still in progress) and entries from before the
structured fields existed.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import text

from app.models import Caregiver, CaregiverRole, CareLog, CareLogType, DiaperKind, FeedType
from app.security import hash_password
from app.services import care_logs

PASSWORD = "correct horse battery staple"


def _now():
    return datetime.now(timezone.utc)


def _iso(moment: datetime) -> str:
    return moment.isoformat()


@pytest.fixture
def family(client, auth_headers, db_session):
    """A family with two caregivers (A registered, B added to it) and a child."""
    headers_a, register_a = auth_headers(email="parent-a@example.com", name="Alex")
    db_session.add(
        Caregiver(
            family_id=register_a["family_id"],
            name="Sam",
            email="parent-b@example.com",
            password_hash=hash_password(PASSWORD),
            role=CaregiverRole.CO_PARENT,
            permission_level="full",
        )
    )
    db_session.commit()
    token_b = client.post("/auth/login", data={"username": "parent-b@example.com", "password": PASSWORD}).json()[
        "access_token"
    ]
    child_id = client.post(
        "/children", json={"name": "Baby", "birth_date": "2026-08-01"}, headers=headers_a
    ).json()["id"]
    return {
        "headers_a": headers_a,
        "headers_b": {"Authorization": f"Bearer {token_b}"},
        "token_b": token_b,
        "family_id": register_a["family_id"],
        "child_id": child_id,
        "base": f"/children/{child_id}/care-logs",
    }


def _post(client, family, body, headers="headers_a"):
    return client.post(family["base"], json=body, headers=family[headers])


# --- validation ---------------------------------------------------------


@pytest.mark.parametrize(
    "body, message",
    [
        ({"type": "feed", "feed_type": "breast", "amount_ml": 60}, "An amount only applies to a bottle or solid feed."),
        ({"type": "feed", "feed_type": "bottle", "side": "left"}, "A side only applies to a breast feed."),
        ({"type": "feed", "feed_type": "bottle", "amount_ml": 0}, "Amount must be between 1 and 500 ml."),
        ({"type": "feed", "feed_type": "bottle", "amount_ml": 501}, "Amount must be between 1 and 500 ml."),
        ({"type": "feed", "feed_type": "breast", "duration_min": 181}, "Duration must be between 1 and 180 minutes."),
        ({"type": "feed", "amount_ml": 90}, "Choose breast, bottle or solid to add details to a feed."),
        ({"type": "feed", "diaper_kind": "wet"}, "A feed entry can't have a diaper kind."),
        ({"type": "diaper", "amount_ml": 20}, "A diaper entry can't have an amount."),
        ({"type": "diaper", "feed_type": "bottle"}, "A diaper entry can't have a feed type."),
        ({"type": "medication", "duration_min": 5}, "A medication entry can't have a duration."),
        ({"type": "sleep", "side": "left"}, "A sleep entry can't have a side."),
        ({"type": "sleep", "duration_min": 1441}, "Sleep duration must be between 1 and 1440 minutes."),
        ({"type": "sleep", "in_progress": True, "duration_min": 30}, "A sleep in progress has no end time yet."),
        ({"type": "feed", "notes": "x" * 501}, "Notes can be at most 500 characters."),
    ],
)
def test_rejects_fields_and_values_that_dont_fit_the_type(client, family, body, message):
    resp = _post(client, family, body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"] == message


def test_rejects_impossible_times(client, family):
    start = _now() - timedelta(hours=3)
    cases = [
        ({"type": "feed", "occurred_at": _iso(_now() + timedelta(minutes=30))}, "The time can't be in the future."),
        (
            {"type": "sleep", "occurred_at": _iso(start), "ended_at": _iso(start - timedelta(minutes=1))},
            "A sleep must end after it starts.",
        ),
        (
            {"type": "sleep", "occurred_at": _iso(start - timedelta(hours=30)), "ended_at": _iso(start)},
            "A single sleep can't be longer than 24 hours.",
        ),
        (
            {"type": "sleep", "occurred_at": _iso(start), "ended_at": _iso(_now() + timedelta(hours=1))},
            "A sleep can't end in the future.",
        ),
        (
            {"type": "sleep", "occurred_at": _iso(start), "ended_at": _iso(_now()), "duration_min": 30},
            "Give either an end time or a duration for a sleep, not both.",
        ),
    ]
    for body, message in cases:
        resp = _post(client, family, body)
        assert resp.status_code == 422, body
        assert resp.json()["detail"] == message


def test_rejects_unknown_fields_and_values(client, family):
    assert _post(client, family, {"type": "feed", "colour": "blue"}).status_code == 422
    assert _post(client, family, {"type": "feed", "feed_type": "juice"}).status_code == 422
    assert _post(client, family, {"type": "diaper", "diaper_kind": "green"}).status_code == 422


def test_a_small_clock_difference_is_allowed(client, family):
    resp = _post(client, family, {"type": "diaper", "occurred_at": _iso(_now() + timedelta(minutes=2))})
    assert resp.status_code == 201


def test_creates_structured_entries_of_each_type(client, family):
    when = _now() - timedelta(hours=2)
    bottle = _post(client, family, {"type": "feed", "feed_type": "bottle", "amount_ml": 120, "duration_min": 15,
                                    "occurred_at": _iso(when), "notes": "  warm  "})
    assert bottle.status_code == 201, bottle.text
    body = bottle.json()
    assert (body["feed_type"], body["amount_ml"], body["duration_min"], body["notes"]) == ("bottle", 120, 15, "warm")
    assert body["occurred_at"] == body["timestamp"]
    assert datetime.fromisoformat(body["occurred_at"]) == when
    assert body["caregiver_name"] == "Alex"

    breast = _post(client, family, {"type": "feed", "feed_type": "breast", "side": "both", "duration_min": 20}).json()
    assert (breast["side"], breast["amount_ml"]) == ("both", None)

    sleep = _post(client, family, {"type": "sleep", "occurred_at": _iso(when), "duration_min": 45}).json()
    assert datetime.fromisoformat(sleep["ended_at"]) == when + timedelta(minutes=45)
    assert sleep["duration_min"] is None and sleep["in_progress"] is False

    diaper = _post(client, family, {"type": "diaper", "diaper_kind": "both"}, headers="headers_b").json()
    assert (diaper["diaper_kind"], diaper["caregiver_name"]) == ("both", "Sam")


# --- sleep in progress ----------------------------------------------------


def test_one_sleep_in_progress_at_a_time_then_stop_it(client, family):
    started = _now() - timedelta(minutes=40)
    first = _post(client, family, {"type": "sleep", "in_progress": True, "occurred_at": _iso(started)})
    assert first.status_code == 201
    assert first.json()["in_progress"] is True and first.json()["ended_at"] is None

    second = _post(client, family, {"type": "sleep", "in_progress": True}, headers="headers_b")
    assert second.status_code == 409
    assert second.json()["detail"] == "A sleep is already in progress. Stop it first."

    latest = client.get(f"{family['base']}/latest", headers=family["headers_b"]).json()
    assert latest["sleep"]["id"] == first.json()["id"] and latest["sleep"]["in_progress"] is True

    stopped = client.patch(f"{family['base']}/{first.json()['id']}", json={"ended_at": _iso(_now())},
                           headers=family["headers_b"])
    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["in_progress"] is False and stopped.json()["updated_at"] is not None

    # Now a new one can start.
    assert _post(client, family, {"type": "sleep", "in_progress": True}).status_code == 201


def test_database_allows_only_one_running_sleep_per_child(db_session, family):
    for _ in range(2):
        db_session.add(CareLog(child_id=family["child_id"], caregiver_id=_caregiver_id(db_session),
                               type=CareLogType.SLEEP, in_progress=True))
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()


def _caregiver_id(db_session):
    return db_session.query(Caregiver).filter(Caregiver.email == "parent-a@example.com").one().id


# --- update / delete ------------------------------------------------------


def test_update_rechecks_the_whole_entry(client, family):
    entry = _post(client, family, {"type": "feed", "feed_type": "bottle", "amount_ml": 90}).json()
    url = f"{family['base']}/{entry['id']}"

    ok = client.patch(url, json={"amount_ml": 150, "notes": "topped up"}, headers=family["headers_b"])
    assert ok.status_code == 200
    assert (ok.json()["amount_ml"], ok.json()["notes"], ok.json()["feed_type"]) == (150, "topped up", "bottle")

    # Switching to breast while an amount is still set is caught...
    bad = client.patch(url, json={"feed_type": "breast"}, headers=family["headers_a"])
    assert bad.status_code == 422
    assert bad.json()["detail"] == "An amount only applies to a bottle or solid feed."
    # ...and works when the amount is cleared at the same time.
    fixed = client.patch(url, json={"feed_type": "breast", "amount_ml": None, "side": "left"}, headers=family["headers_a"])
    assert fixed.status_code == 200
    assert (fixed.json()["feed_type"], fixed.json()["amount_ml"], fixed.json()["side"]) == ("breast", None, "left")

    assert client.patch(url, json={"type": "sleep"}, headers=family["headers_a"]).status_code == 422
    assert client.patch(url, json={"occurred_at": None}, headers=family["headers_a"]).status_code == 422


def test_delete_removes_the_entry(client, family):
    entry = _post(client, family, {"type": "diaper", "diaper_kind": "wet"}).json()
    url = f"{family['base']}/{entry['id']}"
    assert client.delete(url, headers=family["headers_b"]).status_code == 204
    assert client.get(family["base"], headers=family["headers_a"]).json() == []
    assert client.delete(url, headers=family["headers_a"]).status_code == 404


# --- family isolation -----------------------------------------------------


def test_another_family_gets_404_everywhere(client, auth_headers, family):
    outsider, _ = auth_headers(email="outsider@example.com")
    entry = _post(client, family, {"type": "feed"}).json()
    base, url = family["base"], f"{family['base']}/{entry['id']}"

    assert client.get(base, headers=outsider).status_code == 404
    assert client.post(base, json={"type": "feed"}, headers=outsider).status_code == 404
    assert client.patch(url, json={"notes": "x"}, headers=outsider).status_code == 404
    assert client.delete(url, headers=outsider).status_code == 404
    assert client.get(f"{base}/latest", headers=outsider).status_code == 404
    assert client.get(f"{base}/summary", headers=outsider).status_code == 404
    # The entry is untouched.
    assert client.get(base, headers=family["headers_a"]).json()[0]["notes"] is None


def test_entry_of_another_child_is_404_through_this_child(client, family):
    other_child = client.post("/children", json={"birth_date": "2025-01-01"}, headers=family["headers_a"]).json()["id"]
    entry = _post(client, family, {"type": "feed"}).json()
    url = f"/children/{other_child}/care-logs/{entry['id']}"
    assert client.patch(url, json={"notes": "x"}, headers=family["headers_a"]).status_code == 404
    assert client.delete(url, headers=family["headers_a"]).status_code == 404


def test_requires_a_valid_token(client, family):
    entry = _post(client, family, {"type": "feed"}).json()
    url = f"{family['base']}/{entry['id']}"
    assert client.patch(url, json={"notes": "x"}).status_code == 401
    assert client.delete(url, headers={"Authorization": "Bearer nope"}).status_code == 401


# --- live broadcasts ------------------------------------------------------


def test_create_update_and_delete_are_broadcast(client, family):
    ws_url = f"/ws/families/{family['family_id']}?token={family['token_b']}"
    with client.websocket_connect(ws_url) as websocket:
        created = _post(client, family, {"type": "feed", "feed_type": "bottle", "amount_ml": 100}).json()
        message = websocket.receive_json()
        assert message["event"] == "created"
        assert (message["id"], message["amount_ml"], message["caregiver_name"]) == (created["id"], 100, "Alex")

        client.patch(f"{family['base']}/{created['id']}", json={"amount_ml": 110}, headers=family["headers_a"])
        message = websocket.receive_json()
        assert (message["event"], message["id"], message["amount_ml"]) == ("updated", created["id"], 110)

        client.delete(f"{family['base']}/{created['id']}", headers=family["headers_a"])
        message = websocket.receive_json()
        assert message == {"event": "deleted", "id": created["id"], "deleted_from_child": family["child_id"]}
        # Older clients show any message carrying child_id as an entry.
        assert "child_id" not in message


# --- list filters ---------------------------------------------------------


def test_list_filters_by_type_and_time_and_pages(client, family):
    base_time = _now() - timedelta(days=2)
    for i, kind in enumerate(["feed", "diaper", "feed", "sleep", "feed"]):
        _post(client, family, {"type": kind, "occurred_at": _iso(base_time + timedelta(hours=i)), "notes": str(i)})
    h = family["headers_a"]

    feeds = client.get(family["base"], params={"type": "feed"}, headers=h).json()
    assert [e["notes"] for e in feeds] == ["4", "2", "0"]

    window = client.get(
        family["base"],
        params={"from": _iso(base_time + timedelta(hours=1)), "to": _iso(base_time + timedelta(hours=3))},
        headers=h,
    ).json()
    assert [e["notes"] for e in window] == ["2", "1"]

    page = client.get(family["base"], params={"limit": 2, "offset": 2}, headers=h).json()
    assert [e["notes"] for e in page] == ["2", "1"]


def test_latest_has_each_type_or_null(client, family):
    old = _now() - timedelta(hours=5)
    _post(client, family, {"type": "feed", "occurred_at": _iso(old), "notes": "older"})
    _post(client, family, {"type": "feed", "feed_type": "bottle", "amount_ml": 80, "occurred_at": _iso(old + timedelta(hours=1))})
    # Logged later, but happened earlier: "latest" is by when it happened.
    _post(client, family, {"type": "feed", "occurred_at": _iso(old - timedelta(hours=1)), "notes": "backfilled"})
    _post(client, family, {"type": "diaper", "diaper_kind": "dirty"})

    latest = client.get(f"{family['base']}/latest", headers=family["headers_b"]).json()
    assert latest["feed"]["amount_ml"] == 80
    assert latest["diaper"]["diaper_kind"] == "dirty"
    assert latest["sleep"] is None and latest["medication"] is None


# --- summary ----------------------------------------------------------------

NY = ZoneInfo("America/New_York")


def _local(*args) -> datetime:
    return datetime(*args, tzinfo=NY)


def _add(db_session, child_id, caregiver_id, log_type, when, **fields):
    db_session.add(CareLog(child_id=child_id, caregiver_id=caregiver_id, type=log_type, timestamp=when, **fields))


def test_summary_uses_local_days_splits_sleep_and_counts_running_sleep(db_session, family):
    """Known data around midnight in New York (and across the March 2026
    daylight-saving change); "now" is 15:00 local on 12 March."""
    child, cg = family["child_id"], _caregiver_id(db_session)
    now = _local(2026, 3, 12, 15, 0)
    # 23:30 on the 11th locally -- already the 12th in UTC.
    _add(db_session, child, cg, CareLogType.FEED, _local(2026, 3, 11, 23, 30), feed_type=FeedType.BOTTLE, amount_ml=120)
    _add(db_session, child, cg, CareLogType.FEED, _local(2026, 3, 12, 0, 30), feed_type=FeedType.BOTTLE, amount_ml=90,
         duration_min=15)
    _add(db_session, child, cg, CareLogType.FEED, _local(2026, 3, 12, 8, 0), feed_type=FeedType.BREAST, duration_min=20)
    _add(db_session, child, cg, CareLogType.FEED, _local(2026, 3, 12, 9, 0), notes="old-style feed")
    _add(db_session, child, cg, CareLogType.DIAPER, _local(2026, 3, 12, 10, 0), diaper_kind=DiaperKind.WET)
    _add(db_session, child, cg, CareLogType.DIAPER, _local(2026, 3, 12, 11, 0), diaper_kind=DiaperKind.BOTH)
    _add(db_session, child, cg, CareLogType.DIAPER, _local(2026, 3, 11, 12, 0), notes="old-style diaper")
    # 22:00 -> 02:00: two hours on each side of midnight.
    _add(db_session, child, cg, CareLogType.SLEEP, _local(2026, 3, 11, 22, 0), ended_at=_local(2026, 3, 12, 2, 0))
    # Still asleep since 14:00: an hour so far.
    _add(db_session, child, cg, CareLogType.SLEEP, _local(2026, 3, 12, 14, 0), in_progress=True)
    # An old sleep with no length: the day counts, the minutes don't.
    _add(db_session, child, cg, CareLogType.SLEEP, _local(2026, 3, 10, 13, 0), notes="old-style sleep")
    # Outside the 7 days.
    _add(db_session, child, cg, CareLogType.FEED, _local(2026, 3, 5, 12, 0), feed_type=FeedType.BOTTLE, amount_ml=500)
    db_session.commit()

    result = care_logs.summary(db_session, child, 7, "America/New_York", now.astimezone(timezone.utc))
    days = {d["day"].isoformat(): d for d in result["daily"]}
    assert list(days) == [f"2026-03-{n:02d}" for n in range(6, 13)]

    assert days["2026-03-11"] | {} == {
        "day": days["2026-03-11"]["day"], "feeds": 1, "feed_ml": 120, "avg_feed_ml": 120.0, "avg_feed_min": None,
        "diapers_wet": 0, "diapers_dirty": 0, "diapers_both": 0, "diapers_other": 1,
        "sleep_min": 120, "longest_sleep_min": 240,
    }
    today = days["2026-03-12"]
    assert (today["feeds"], today["feed_ml"], today["avg_feed_ml"], today["avg_feed_min"]) == (3, 90, 90.0, 17.5)
    assert (today["diapers_wet"], today["diapers_both"], today["diapers_other"]) == (1, 1, 0)
    assert (today["sleep_min"], today["longest_sleep_min"]) == (180, None)
    assert days["2026-03-10"]["sleep_min"] == 0
    assert days["2026-03-08"]["feeds"] == 0  # the 23-hour day is still a day

    assert result["averages"] == {
        "days_with_entries": 3,
        "feeds_per_day": 1.3,
        "feed_ml_per_day": 70.0,
        "avg_feed_ml": 105.0,
        "avg_feed_min": 17.5,
        "diapers_per_day": 1.0,
        "sleep_min_per_day": 100.0,
    }
    # Without the 12th (today, still in progress): the 10th and the 11th.
    assert result["averages_excluding_today"] == {
        "days_with_entries": 2,
        "feeds_per_day": 0.5,
        "feed_ml_per_day": 60.0,
        "avg_feed_ml": 120.0,
        "avg_feed_min": None,
        "diapers_per_day": 0.5,
        "sleep_min_per_day": 60.0,
    }

    # The same data by UTC days: the 23:30 feed moves to the 12th.
    utc = {d["day"].isoformat(): d for d in care_logs.summary(db_session, child, 7, "UTC", now)["daily"]}
    assert utc["2026-03-12"]["feeds"] == 4 and utc["2026-03-11"]["feeds"] == 0


def test_summary_endpoint_checks_its_parameters(client, family):
    base, h = family["base"], family["headers_a"]
    ok = client.get(f"{base}/summary", params={"days": 30, "tz": "Asia/Kolkata"}, headers=h)
    assert ok.status_code == 200
    body = ok.json()
    assert (body["days"], body["timezone"], len(body["daily"])) == (30, "Asia/Kolkata", 30)
    assert body["averages"]["days_with_entries"] == 0 and body["averages"]["feeds_per_day"] is None
    assert body["averages_excluding_today"]["days_with_entries"] == 0

    assert client.get(f"{base}/summary", headers=h).json()["timezone"] == "UTC"
    bad_days = client.get(f"{base}/summary", params={"days": 14}, headers=h)
    assert bad_days.status_code == 422 and bad_days.json()["detail"] == "days must be 7 or 30."
    bad_tz = client.get(f"{base}/summary", params={"tz": "Mars/Olympus"}, headers=h)
    assert bad_tz.status_code == 422 and bad_tz.json()["detail"] == "Unknown timezone: Mars/Olympus"


# --- entries from before the structured fields ------------------------------


def test_old_style_entries_still_work(client, family, db_session):
    # Written the way the old code did: type, notes, timestamp only.
    with db_session.bind.begin() as conn:
        conn.execute(
            text("INSERT INTO care_logs (id, child_id, caregiver_id, type, timestamp, notes) "
                 "VALUES (gen_random_uuid(), :child, :cg, 'SLEEP', now() - interval '3 hours', 'napped well')"),
            {"child": family["child_id"], "cg": _caregiver_id(db_session)},
        )
    # The old frontend's request still works too.
    old_post = _post(client, family, {"type": "feed", "notes": "8oz bottle"})
    assert old_post.status_code == 201
    legacy_ts = _post(client, family, {"type": "diaper", "timestamp": _iso(_now() - timedelta(hours=1))})
    assert legacy_ts.status_code == 201

    entries = client.get(family["base"], headers=family["headers_b"]).json()
    sleep = next(e for e in entries if e["type"] == "sleep")
    assert sleep["notes"] == "napped well" and sleep["in_progress"] is False and sleep["ended_at"] is None
    assert sleep["occurred_at"] == sleep["timestamp"]

    latest = client.get(f"{family['base']}/latest", headers=family["headers_b"]).json()
    # An old sleep is not "sleeping now".
    assert latest["sleep"]["in_progress"] is False
    # And it can be given a length later.
    fixed = client.patch(f"{family['base']}/{sleep['id']}", json={"duration_min": 50}, headers=family["headers_a"])
    assert fixed.status_code == 200 and fixed.json()["ended_at"] is not None
