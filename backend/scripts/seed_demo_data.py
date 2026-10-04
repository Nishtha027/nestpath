"""Seeds demo data: a few providers with open availability slots, and one
demo caregiver account with is_provider=true (so the Alerts page is
reachable). There's deliberately no admin UI for any of this.

Safe to re-run: providers are matched by name, slots by (provider, start
time), and the caregiver by email -- running it again only fills in what's
missing, e.g. topping up the next week's slots.

Run from backend/, after `alembic upgrade head`:

    python scripts/seed_demo_data.py

Env vars:
    DEMO_PROVIDER_EMAIL     login for the provider-flagged account
                            (default: demo-provider@example.com)
    DEMO_SLOT_DAYS          how many days ahead to create slots for (default 7).
                            Slots only cover that window from the day the script
                            runs, so for a long-lived public demo use a bigger
                            number (e.g. 30) or re-run the script now and then --
                            re-running tops up without duplicating anything.
    DEMO_PROVIDER_PASSWORD  its password. Optional against a local database
                            (falls back to LOCAL_DEFAULT_PASSWORD below), but
                            REQUIRED against any other host -- a provider
                            account can read flagged screenings from every
                            family, so a password committed to the repo must
                            never protect a deployed instance.

An account that already exists with the demo email is never modified: if it
isn't already a provider the script refuses, rather than promote it (on a
deployed instance, anyone could have registered that email first).
"""

import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Lets `python scripts/seed_demo_data.py` import the app package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import DATABASE_URL, SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    AvailabilitySlot,
    Caregiver,
    CaregiverRole,
    Family,
    Provider,
)
from app.security import hash_password  # noqa: E402

DEFAULT_EMAIL = "demo-provider@example.com"
LOCAL_DEFAULT_PASSWORD = "demo-provider-local-only"
_LOCAL_HOSTS = {None, "", "localhost", "127.0.0.1", "::1"}

# (name, specialty, slot start hours in UTC). Fictional providers.
DEMO_PROVIDERS = [
    ("Dr. Ada Rivera", "Pediatrics", (9, 10, 14)),
    ("Nora Okafor, IBCLC", "Lactation consulting", (11, 13, 15)),
    ("Dr. Priya Nair", "Perinatal mental health", (10, 14, 16)),
]
SLOT_MINUTES = 30
DAYS_AHEAD = 7  # default window: weekday slots within this many days after "today"


@dataclass
class SeedResult:
    providers_created: int = 0
    providers_existing: int = 0
    slots_created: int = 0
    caregiver_created: bool = False
    caregiver_existing: bool = False


class SeedError(Exception):
    pass


def resolve_password(env_password: str | None, database_url: str) -> str:
    if env_password:
        return env_password
    if make_url(database_url).host in _LOCAL_HOSTS:
        return LOCAL_DEFAULT_PASSWORD
    raise SeedError(
        "DEMO_PROVIDER_PASSWORD must be set when seeding a non-local database "
        "(the built-in default is for local development only)."
    )


def resolve_days_ahead(raw: str | None) -> int:
    if not raw:
        return DAYS_AHEAD
    try:
        days = int(raw)
    except ValueError:
        days = 0
    if not 1 <= days <= 365:
        raise SeedError(f"DEMO_SLOT_DAYS must be a whole number from 1 to 365, got {raw!r}.")
    return days


def _slot_starts(today: date, hours: tuple[int, ...], days_ahead: int) -> list[datetime]:
    starts = []
    for offset in range(1, days_ahead + 1):
        day = today + timedelta(days=offset)
        if day.weekday() >= 5:  # Saturday/Sunday
            continue
        for hour in hours:
            starts.append(datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc))
    return starts


def seed(
    db: Session,
    email: str,
    password: str,
    today: date | None = None,
    days_ahead: int = DAYS_AHEAD,
) -> SeedResult:
    """Create whatever demo data is missing and commit. `password` is only
    used if the caregiver doesn't exist yet.
    """
    today = today or date.today()
    result = SeedResult()

    # Check the account first so a refusal leaves the database untouched.
    caregiver = db.query(Caregiver).filter(Caregiver.email == email).first()
    if caregiver is not None and not caregiver.is_provider:
        raise SeedError(
            f"{email} already exists but is not a provider; refusing to modify it. "
            "Delete that account or set DEMO_PROVIDER_EMAIL to a different address."
        )

    for name, specialty, hours in DEMO_PROVIDERS:
        provider = db.query(Provider).filter(Provider.name == name).first()
        if provider is None:
            provider = Provider(name=name, specialty=specialty)
            db.add(provider)
            db.flush()
            result.providers_created += 1
        else:
            result.providers_existing += 1

        existing_starts = {
            slot.start_time
            for slot in db.query(AvailabilitySlot).filter(AvailabilitySlot.provider_id == provider.id)
        }
        for start in _slot_starts(today, hours, days_ahead):
            if start in existing_starts:
                continue
            db.add(
                AvailabilitySlot(
                    provider_id=provider.id,
                    start_time=start,
                    end_time=start + timedelta(minutes=SLOT_MINUTES),
                )
            )
            result.slots_created += 1

    if caregiver is None:
        family = Family()
        db.add(family)
        db.flush()
        db.add(
            Caregiver(
                family_id=family.id,
                name="Demo Provider",
                email=email,
                password_hash=hash_password(password),
                role=CaregiverRole.PARENT,
                permission_level="full",
                is_provider=True,
            )
        )
        result.caregiver_created = True
    else:
        result.caregiver_existing = True

    db.commit()
    return result


def main() -> int:
    email = os.environ.get("DEMO_PROVIDER_EMAIL") or DEFAULT_EMAIL
    try:
        password = resolve_password(os.environ.get("DEMO_PROVIDER_PASSWORD"), DATABASE_URL)
        days_ahead = resolve_days_ahead(os.environ.get("DEMO_SLOT_DAYS"))
        with SessionLocal() as db:
            result = seed(db, email, password, days_ahead=days_ahead)
    except SeedError as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"Providers: {result.providers_created} created, {result.providers_existing} already present"
    )
    print(f"Availability slots created: {result.slots_created}")
    if result.caregiver_created:
        print(f"Provider account created: {email}")
        if "DEMO_PROVIDER_PASSWORD" not in os.environ:
            print("  password: the local default (LOCAL_DEFAULT_PASSWORD in this script)")
        else:
            print("  password: the value of DEMO_PROVIDER_PASSWORD")
    else:
        print(f"Provider account already present: {email} (left unchanged)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
