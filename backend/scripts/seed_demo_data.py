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

Against a LOCAL database only, it also seeds a demo family for the baby
tracker: a parent login (demo-parent@example.com; its password is
LOCAL_PARENT_PASSWORD below, or DEMO_PARENT_PASSWORD), a second caregiver
with no usable password (so entries show who logged them), a demo child, and
the last week of made-up feeds, sleeps and diapers. Entries are generated
from the date, so a re-run on the same day adds nothing and a later re-run
only fills in the days since. Against any other host this part is skipped:
fake entries never belong in a real database.

    DEMO_TZ                 the IANA timezone the demo days follow
                            (default: this computer's)
"""

import os
import random
import secrets
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from pathlib import Path
from zoneinfo import ZoneInfo

# Lets `python scripts/seed_demo_data.py` import the app package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import DATABASE_URL, SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    AvailabilitySlot,
    Caregiver,
    CaregiverRole,
    CareLog,
    CareLogType,
    Child,
    DiaperKind,
    Family,
    FeedSide,
    FeedType,
    Provider,
)
from app.security import hash_password  # noqa: E402
from app.services.timeline import generate_schedule_for_child  # noqa: E402

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


def is_local(database_url: str) -> bool:
    return make_url(database_url).host in _LOCAL_HOSTS


def resolve_password(env_password: str | None, database_url: str) -> str:
    if env_password:
        return env_password
    if is_local(database_url):
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


# --- Baby tracker demo family (local databases only) ------------------------

DEMO_PARENT_EMAIL = "demo-parent@example.com"
LOCAL_PARENT_PASSWORD = "demo-parent-local-only"
DEMO_PARENT_NAME = "Alex"
# The second caregiver can't log in (its password is random and never
# shown); it is there so entries show two different names.
DEMO_PARTNER_EMAIL = "demo-partner@example.com"
DEMO_PARTNER_NAME = "Sam"
DEMO_CHILD_NAME = "Mia"
DEMO_CHILD_AGE_DAYS = 130
TRACKER_DAYS = 7


@dataclass
class TrackerSeedResult:
    parent_created: bool = False
    child_created: bool = False
    entries_created: int = 0
    entries_existing: int = 0


def resolve_demo_timezone(name: str | None) -> tzinfo:
    if not name:
        return datetime.now().astimezone().tzinfo or timezone.utc
    try:
        return ZoneInfo(name)
    except (ValueError, KeyError) as exc:
        raise SeedError(f"DEMO_TZ must be an IANA timezone like Europe/London, got {name!r}.") from exc


def _night(start: date) -> tuple[time, int]:
    """Bedtime on `start` and the first stretch of sleep, in minutes. One
    night a week is a much longer stretch."""
    rng = random.Random(start.toordinal() * 31 + 7)
    bedtime = time(20, rng.choice((0, 15, 30)))
    if start.toordinal() % 7 == 3:
        return bedtime, rng.randint(420, 455)
    return bedtime, rng.randint(230, 300)


def demo_day_entries(day: date, tz: tzinfo) -> list[dict]:
    """The made-up entries for one local calendar day: the night feed and
    the rest of the night's sleep, the day's feeds (bottle, breast and one
    solid), naps, diapers, and the start of that evening's sleep.
    Deterministic for a given day, so a re-run finds the same entries."""
    rng = random.Random(day.toordinal())
    entries: list[dict] = []

    def at(hour: int, minute: int, jitter: int = 10) -> datetime:
        local = datetime.combine(day, time(hour, minute), tzinfo=tz)
        return (local + timedelta(minutes=rng.randint(-jitter, jitter))).astimezone(timezone.utc)

    def who() -> str:
        return rng.choice(("parent", "parent", "partner"))

    def feed(when: datetime, feed_type: FeedType, notes: str | None = None, **fields) -> None:
        entries.append({"type": CareLogType.FEED, "occurred_at": when, "feed_type": feed_type, "notes": notes, "by": who(), **fields})

    def bottle(when: datetime, low: int, high: int, notes: str | None = None) -> None:
        feed(when, FeedType.BOTTLE, notes, amount_ml=rng.randrange(low, high + 1, 10))

    def breast(when: datetime) -> None:
        side = rng.choice((FeedSide.LEFT, FeedSide.RIGHT, FeedSide.BOTH))
        feed(when, FeedType.BREAST, side=side, duration_min=rng.randint(10, 20))

    def sleep(start: datetime, minutes: int, notes: str | None = None) -> None:
        entries.append({
            "type": CareLogType.SLEEP,
            "occurred_at": start,
            "ended_at": start + timedelta(minutes=minutes),
            "notes": notes,
            "by": who(),
        })

    def diaper(when: datetime, kind: DiaperKind) -> None:
        entries.append({"type": CareLogType.DIAPER, "occurred_at": when, "diaper_kind": kind, "by": who()})

    # The end of last night: woke, fed, back to sleep until morning.
    bedtime, first_stretch = _night(day - timedelta(days=1))
    woke = datetime.combine(day - timedelta(days=1), bedtime, tzinfo=tz) + timedelta(minutes=first_stretch)
    woke = woke.astimezone(timezone.utc)
    diaper(woke + timedelta(minutes=3), DiaperKind.WET)
    breast(woke + timedelta(minutes=6))
    back_to_sleep = woke + timedelta(minutes=rng.randint(28, 40))
    morning = at(6, 40, jitter=15)
    if morning - back_to_sleep > timedelta(hours=4):
        # A second, shorter waking before morning.
        stretch = rng.randint(170, 210)
        sleep(back_to_sleep, stretch)
        woke = back_to_sleep + timedelta(minutes=stretch)
        bottle(woke + timedelta(minutes=5), 90, 120)
        back_to_sleep = woke + timedelta(minutes=rng.randint(25, 35))
    sleep(back_to_sleep, max(30, int((morning - back_to_sleep).total_seconds() // 60)))

    diaper(at(6, 50, jitter=5), DiaperKind.WET)
    bottle(at(7, 0, jitter=5), 120, 150)
    sleep(at(9, 0), rng.randint(55, 80))
    bottle(at(10, 20), 110, 150)
    diaper(at(10, 30), rng.choice((DiaperKind.DIRTY, DiaperKind.BOTH)))
    feed(at(12, 0), FeedType.SOLID, rng.choice((None, None, "Tried mashed banana", "Pear puree")), amount_ml=rng.randrange(30, 71, 10))
    sleep(at(13, 0), rng.randint(80, 115), rng.choice((None, None, "Fussy before the nap")))
    breast(at(15, 0))
    diaper(at(15, 10), DiaperKind.WET)
    bottle(at(17, 0), 120, 150)
    sleep(at(17, 40, jitter=5), rng.randint(25, 40))
    diaper(at(18, 40), rng.choice((DiaperKind.WET, DiaperKind.DIRTY)))
    bottle(at(19, 35, jitter=5), 150, 180, rng.choice((None, None, "Took the bottle slowly")))
    diaper(at(19, 50, jitter=3), DiaperKind.WET)

    # Tonight's first stretch (it ends tomorrow).
    bedtime, first_stretch = _night(day)
    sleep(datetime.combine(day, bedtime, tzinfo=tz).astimezone(timezone.utc), first_stretch)
    return entries


def _add_caregiver(db: Session, family: Family, email: str, name: str, password: str) -> Caregiver:
    caregiver = Caregiver(
        family_id=family.id,
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=CaregiverRole.PARENT,
        permission_level="full",
    )
    db.add(caregiver)
    db.flush()
    return caregiver


def seed_tracker(
    db: Session,
    password: str,
    now: datetime | None = None,
    tz: tzinfo = timezone.utc,
    email: str = DEMO_PARENT_EMAIL,
) -> TrackerSeedResult:
    """Create the demo parent, partner and child if missing, and add the
    entries of the last TRACKER_DAYS days that aren't there yet (none that
    end after `now`). Commits. Only ever call this for a local database."""
    now = now or datetime.now(timezone.utc)
    result = TrackerSeedResult()

    parent = db.query(Caregiver).filter(Caregiver.email == email).first()
    if parent is not None and parent.is_provider:
        raise SeedError(f"{email} is a provider account; refusing to add a demo child to it.")
    if parent is None:
        family = Family()
        db.add(family)
        db.flush()
        parent = _add_caregiver(db, family, email, DEMO_PARENT_NAME, password)
        result.parent_created = True
    family = parent.family

    partner = db.query(Caregiver).filter(Caregiver.email == DEMO_PARTNER_EMAIL).first()
    if partner is None:
        partner = _add_caregiver(db, family, DEMO_PARTNER_EMAIL, DEMO_PARTNER_NAME, secrets.token_urlsafe(32))
    elif partner.family_id != family.id:
        partner = parent  # an unrelated account with that email: leave it alone

    today = now.astimezone(tz).date()
    child = db.query(Child).filter(Child.family_id == family.id, Child.name == DEMO_CHILD_NAME).first()
    if child is None:
        child = Child(family_id=family.id, name=DEMO_CHILD_NAME, birth_date=today - timedelta(days=DEMO_CHILD_AGE_DAYS))
        db.add(child)
        db.flush()
        generate_schedule_for_child(db, child, today)
        result.child_created = True

    existing = {
        (row.type, row.timestamp)
        for row in db.query(CareLog).filter(
            CareLog.child_id == child.id, CareLog.timestamp >= now - timedelta(days=TRACKER_DAYS + 2)
        )
    }
    for offset in range(TRACKER_DAYS - 1, -1, -1):
        for entry in demo_day_entries(today - timedelta(days=offset), tz):
            fields = dict(entry)
            by = fields.pop("by")
            occurred_at = fields.pop("occurred_at")
            if max(occurred_at, fields.get("ended_at") or occurred_at) > now:
                continue
            if (fields["type"], occurred_at) in existing:
                result.entries_existing += 1
                continue
            db.add(
                CareLog(
                    child_id=child.id,
                    caregiver_id=(partner if by == "partner" else parent).id,
                    timestamp=occurred_at,
                    **fields,
                )
            )
            existing.add((fields["type"], occurred_at))
            result.entries_created += 1

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

    if not is_local(DATABASE_URL):
        print("Tracker demo family: skipped (local databases only)")
        return 0
    try:
        tz = resolve_demo_timezone(os.environ.get("DEMO_TZ"))
        with SessionLocal() as db:
            tracker = seed_tracker(db, os.environ.get("DEMO_PARENT_PASSWORD") or LOCAL_PARENT_PASSWORD, tz=tz)
    except SeedError as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1
    if tracker.parent_created:
        print(f"Demo parent created: {DEMO_PARENT_EMAIL}")
        if "DEMO_PARENT_PASSWORD" not in os.environ:
            print("  password: the local default (LOCAL_PARENT_PASSWORD in this script)")
    else:
        print(f"Demo parent already present: {DEMO_PARENT_EMAIL}")
    print(f"Tracker entries: {tracker.entries_created} created, {tracker.entries_existing} already present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
