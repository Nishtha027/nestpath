import time

import pytest

from app import main


@pytest.fixture(autouse=True)
def no_check_in_flight(monkeypatch):
    # Each TestClient runs its own event loop; don't carry a check across.
    monkeypatch.setattr(main, "_database_check", None)


def test_health_does_not_touch_the_database(client, monkeypatch):
    def fail():
        raise AssertionError("/health must not query the database")

    monkeypatch.setattr(main, "ping_database", fail)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_ready_when_database_answers(client):
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_ready_hides_database_errors(client, monkeypatch):
    def broken():
        raise RuntimeError("connection to host db.secret-host:5432 failed: password=hunter2")

    monkeypatch.setattr(main, "ping_database", broken)
    resp = client.get("/health/ready")
    assert resp.status_code == 503
    assert resp.json() == {"status": "waking"}
    assert "secret" not in resp.text and "hunter2" not in resp.text


def test_ready_answers_waking_when_database_is_slow_and_shares_the_check(client, monkeypatch):
    calls = []

    def slow():
        calls.append(1)
        time.sleep(1)

    monkeypatch.setattr(main, "ping_database", slow)
    monkeypatch.setattr(main, "READY_TIMEOUT_SECONDS", 0.1)
    with client:  # one event loop, so the in-flight check carries over
        started = time.monotonic()
        first = client.get("/health/ready")
        second = client.get("/health/ready")
        assert time.monotonic() - started < 0.9
        assert (first.status_code, second.status_code) == (503, 503)
        assert first.json() == {"status": "waking"}
        assert len(calls) == 1  # the second request waited on the same check
        time.sleep(1.1)  # the background check finishes the wake
        monkeypatch.setattr(main, "READY_TIMEOUT_SECONDS", 5.0)
        assert client.get("/health/ready").status_code == 200
