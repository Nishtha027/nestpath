"""The structured care-log migration (98a7defffb47), run for real with
Alembic: a care-log row written the old way must read back unchanged after
the upgrade, and the downgrade must restore the old schema (dropping the new
enum types too) while keeping the entries themselves.

Rebuilds the public schema from the migrations, so -- like every test here --
it must only ever run against a disposable local database.
"""

from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.database import engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
BEFORE = "b7d2e9c41f60"
TRACKER_REVISION = "98a7defffb47"
NEW_COLUMNS = {"feed_type", "amount_ml", "duration_min", "side", "ended_at", "in_progress", "diaper_kind", "updated_at"}
NEW_TYPES = {"feed_type", "feed_side", "diaper_kind"}


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


def _columns() -> set[str]:
    return {c["name"] for c in inspect(engine).get_columns("care_logs")}


def _enum_types() -> set[str]:
    with engine.connect() as conn:
        return set(conn.execute(text("SELECT typname FROM pg_type WHERE typtype = 'e'")).scalars())


def _revision() -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def test_migration_keeps_old_care_logs_and_downgrades(client, auth_headers):
    assert engine.url.host in ("127.0.0.1", "localhost"), "migration test needs a local DB"
    cfg = _alembic_config()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    # The schema the live database has today, with an entry written by the
    # old code (type + notes only).
    command.upgrade(cfg, BEFORE)
    assert NEW_COLUMNS.isdisjoint(_columns())
    headers, register = auth_headers()
    child_id = client.post("/children", json={"birth_date": "2026-08-01"}, headers=headers).json()["id"]
    old_id = uuid4()
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO care_logs (id, child_id, caregiver_id, type, timestamp, notes) VALUES"
                " (:id, :child_id, :caregiver_id, 'FEED', now() - interval '2 hours', '4oz bottle')"
            ),
            {"id": old_id, "child_id": child_id, "caregiver_id": register["id"]},
        )

    command.upgrade(cfg, "head")
    assert _revision() == TRACKER_REVISION
    assert NEW_COLUMNS <= _columns()
    assert NEW_TYPES <= _enum_types()

    entries = client.get(f"/children/{child_id}/care-logs", headers=headers).json()
    assert len(entries) == 1
    old = entries[0]
    assert (old["id"], old["type"], old["notes"]) == (str(old_id), "feed", "4oz bottle")
    assert old["feed_type"] is None and old["amount_ml"] is None and old["in_progress"] is False
    assert client.get(f"/children/{child_id}/care-logs/summary", headers=headers).status_code == 200

    # A new structured entry alongside it, then back down: both entries keep
    # their type, time and notes; the structured details go with the columns.
    resp = client.post(
        f"/children/{child_id}/care-logs",
        json={"type": "feed", "feed_type": "bottle", "amount_ml": 120, "notes": "new"},
        headers=headers,
    )
    assert resp.status_code == 201
    command.downgrade(cfg, BEFORE)
    assert NEW_COLUMNS.isdisjoint(_columns())
    assert NEW_TYPES.isdisjoint(_enum_types())
    with engine.connect() as conn:
        notes = set(conn.execute(text("SELECT notes FROM care_logs")).scalars())
    assert notes == {"4oz bottle", "new"}

    # And up again cleanly.
    command.upgrade(cfg, "head")
    assert _revision() == TRACKER_REVISION
