from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.cors import cors_settings
from app.database import POOL_RECYCLE_SECONDS, engine, normalize_database_url
from app.models import AvailabilitySlot
from scripts.seed_demo_data import DAYS_AHEAD, DEFAULT_EMAIL, SeedError, resolve_days_ahead, seed

MONDAY = date(2026, 10, 5)


@pytest.mark.parametrize(
    "given, expected",
    [
        # What Neon / Render / Supabase hand out:
        (
            "postgresql://u:p@ep-x.neon.tech/db?sslmode=require",
            "postgresql+psycopg://u:p@ep-x.neon.tech/db?sslmode=require",
        ),
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        # Already explicit -- left alone:
        ("postgresql+psycopg://u:p@127.0.0.1:55432/db", "postgresql+psycopg://u:p@127.0.0.1:55432/db"),
    ],
)
def test_normalize_database_url(given, expected):
    assert normalize_database_url(given) == expected


def test_engine_survives_idle_database_suspend():
    # Neon's free tier suspends after a few idle minutes and drops pooled
    # connections; pre-ping swaps out a dead one, recycle retires old ones.
    assert engine.pool._pre_ping is True
    assert engine.pool._recycle == POOL_RECYCLE_SECONDS == 300


def test_cors_unset_falls_back_to_localhost_dev_regex_only():
    assert set(cors_settings(None)) == {"allow_origin_regex"}
    assert set(cors_settings("")) == {"allow_origin_regex"}
    assert set(cors_settings(" , ")) == {"allow_origin_regex"}


def test_cors_origins_are_exact_and_cleaned_up():
    settings = cors_settings(" https://nestpath.vercel.app/ , https://other.example.com ")
    assert settings == {"allow_origins": ["https://nestpath.vercel.app", "https://other.example.com"]}
    assert "allow_origin_regex" not in settings  # production never keeps the dev regex


def _preflight(client, origin):
    return client.options(
        "/anything",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )


def test_cors_middleware_allows_only_configured_origin():
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_methods=["*"],
        allow_headers=["*"],
        **cors_settings("https://nestpath.vercel.app"),
    )
    client = TestClient(app)

    allowed = _preflight(client, "https://nestpath.vercel.app")
    assert allowed.headers["access-control-allow-origin"] == "https://nestpath.vercel.app"

    for hostile in ("https://evil.example.com", "http://localhost:3000", "https://nestpath.vercel.app.evil.com"):
        assert "access-control-allow-origin" not in _preflight(client, hostile).headers


def test_resolve_days_ahead():
    assert resolve_days_ahead(None) == DAYS_AHEAD
    assert resolve_days_ahead("") == DAYS_AHEAD
    assert resolve_days_ahead("30") == 30
    for bad in ("0", "-3", "abc", "400", "1.5"):
        with pytest.raises(SeedError, match="DEMO_SLOT_DAYS"):
            resolve_days_ahead(bad)


def test_seed_days_ahead_widens_slot_window(db_session):
    seed(db_session, DEFAULT_EMAIL, "a-test-only-password", today=MONDAY, days_ahead=21)

    latest = max(slot.start_time.date() for slot in db_session.query(AvailabilitySlot))
    assert latest > date(2026, 10, 12)  # past the default 7-day window
    assert latest <= date(2026, 10, 26)
