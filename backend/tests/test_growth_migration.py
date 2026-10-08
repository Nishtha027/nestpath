"""The length-for-age migration (b7d2e9c41f60), run for real with Alembic:
an existing weight-only row must read back unchanged after the upgrade, and
the downgrade must restore the old schema.

Rebuilds the public schema from the migrations, so -- like every test here --
it must only ever run against a disposable local database.
"""

from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.database import engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
BEFORE = "a0fb9949d9ff"
LENGTH_REVISION = "b7d2e9c41f60"
NEW_COLUMNS = {"length_cm", "length_percentile", "length_z_score"}


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


def _growth_columns() -> dict[str, bool]:
    return {c["name"]: c["nullable"] for c in inspect(engine).get_columns("growth_measurements")}


def test_migration_keeps_old_weight_rows_and_downgrades(client, auth_headers):
    assert engine.url.host in ("127.0.0.1", "localhost"), "migration test needs a local DB"
    cfg = _alembic_config()
    # The autouse fixture built tables with create_all; start from migrations instead.
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    command.upgrade(cfg, "head")

    headers, _ = auth_headers()
    birth_date = date.today() - timedelta(days=200)
    child_id = client.post(
        "/children", json={"birth_date": birth_date.isoformat()}, headers=headers
    ).json()["id"]

    # Back to the schema the live database has today, and store a row the
    # way the old code did (weight only, NOT NULL percentile/z-score).
    command.downgrade(cfg, BEFORE)
    columns = _growth_columns()
    assert NEW_COLUMNS.isdisjoint(columns)
    assert columns["weight_kg"] is False and columns["percentile"] is False
    old_id = uuid4()
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO growth_measurements (id, child_id, measured_at, age_months, sex,"
                " weight_kg, percentile, z_score, source_version) VALUES"
                " (:id, :child_id, :measured_at, 6, 'female', 7.3, 51.2, 0.03, 'old row')"
            ),
            {"id": old_id, "child_id": child_id, "measured_at": date.today() - timedelta(days=10)},
        )

    command.upgrade(cfg, "head")
    columns = _growth_columns()
    assert NEW_COLUMNS <= set(columns)
    assert columns["weight_kg"] is True and columns["percentile"] is True

    rows = client.get(f"/children/{child_id}/growth", headers=headers).json()
    assert len(rows) == 1
    old = rows[0]
    assert old["id"] == str(old_id)
    assert (old["weight_kg"], old["percentile"], old["z_score"]) == (7.3, 51.2, 0.03)
    assert old["length_cm"] is None and old["length_percentile"] is None

    # New length-only rows work alongside it...
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": date.today().isoformat(), "sex": "female", "length_cm": 67.0},
        headers=headers,
    )
    assert resp.status_code == 201
    # ...and a downgrade with weight-bearing rows only (after removing the
    # length-only one, which the old schema can't hold) restores the schema.
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM growth_measurements WHERE weight_kg IS NULL"))
    command.downgrade(cfg, BEFORE)
    assert NEW_COLUMNS.isdisjoint(_growth_columns())
    command.upgrade(cfg, "head")
    assert LENGTH_REVISION == _current_revision()


def _current_revision() -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
