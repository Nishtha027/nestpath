"""Care-log rules and read models: per-type validation, the "latest of each
type" lookup for the Home tiles, and the per-day summary for Insights.

Day boundaries: a "day" is a calendar day in the timezone the client sends
(an IANA name like "Europe/London", from the browser), defaulting to UTC.
The server's own timezone is never used. A sleep that crosses midnight is
split between the two days; a sleep still in progress counts up to now.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import CareLog, CareLogType, FeedType

# Limits for plausible entries.
AMOUNT_ML = (1, 500)
FEED_MIN = (1, 180)
SLEEP_MAX = timedelta(hours=24)
NOTES_MAX = 500
# Clocks differ a little between phones and the server.
FUTURE_TOLERANCE = timedelta(minutes=5)
SUMMARY_DAYS = (7, 30)

# Which structured fields each type may carry. duration_min on a sleep is
# only a way to send its length; it is stored as ended_at.
ALLOWED = {
    CareLogType.FEED: {"feed_type", "amount_ml", "duration_min", "side"},
    CareLogType.SLEEP: {"ended_at", "in_progress", "duration_min"},
    CareLogType.DIAPER: {"diaper_kind"},
    CareLogType.MEDICATION: set(),
}
STRUCTURED = {"feed_type", "amount_ml", "duration_min", "side", "ended_at", "in_progress", "diaper_kind"}

LABELS = {
    "feed_type": "a feed type",
    "amount_ml": "an amount",
    "duration_min": "a duration",
    "side": "a side",
    "ended_at": "an end time",
    "in_progress": "a running timer",
    "diaper_kind": "a diaper kind",
}


class CareLogError(ValueError):
    """A rule was broken; the message is shown to the user as is."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def as_utc(moment: datetime) -> datetime:
    """Times without a timezone are taken as UTC (as the API always did)."""
    return moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment


def resolve_timezone(name: str | None) -> str:
    if not name:
        return "UTC"
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise CareLogError(f"Unknown timezone: {name}")
    return name


def _range(name: str, value: int, low: int, high: int, unit: str) -> None:
    if not low <= value <= high:
        raise CareLogError(f"{name} must be between {low} and {high} {unit}.")


def validate(log_type: CareLogType, values: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Checks one entry's fields (the complete set, after any update is
    applied) and returns them normalized: a sleep's duration becomes its
    ended_at, and finishing a sleep clears in_progress."""
    values = dict(values)
    kind = log_type.value

    for field in sorted(STRUCTURED - ALLOWED[log_type]):
        if values.get(field) not in (None, False):
            raise CareLogError(f"A {kind} entry can't have {LABELS[field]}.")

    occurred_at = as_utc(values["occurred_at"])
    values["occurred_at"] = occurred_at
    if occurred_at > now + FUTURE_TOLERANCE:
        raise CareLogError("The time can't be in the future.")

    notes = values.get("notes")
    if notes is not None:
        notes = notes.strip() or None
        if notes and len(notes) > NOTES_MAX:
            raise CareLogError(f"Notes can be at most {NOTES_MAX} characters.")
        values["notes"] = notes

    if log_type is CareLogType.FEED:
        feed_type = values.get("feed_type")
        details = [f for f in ("amount_ml", "duration_min", "side") if values.get(f) is not None]
        if details and feed_type is None:
            raise CareLogError("Choose breast, bottle or solid to add details to a feed.")
        if values.get("side") is not None and feed_type is not FeedType.BREAST:
            raise CareLogError("A side only applies to a breast feed.")
        if values.get("amount_ml") is not None:
            if feed_type is FeedType.BREAST:
                raise CareLogError("An amount only applies to a bottle or solid feed.")
            _range("Amount", values["amount_ml"], *AMOUNT_ML, "ml")
        if values.get("duration_min") is not None:
            _range("Duration", values["duration_min"], *FEED_MIN, "minutes")

    if log_type is CareLogType.SLEEP:
        duration = values.pop("duration_min", None)
        ended_at = values.get("ended_at")
        if duration is not None:
            if ended_at is not None:
                raise CareLogError("Give either an end time or a duration for a sleep, not both.")
            _range("Sleep duration", duration, 1, int(SLEEP_MAX.total_seconds() // 60), "minutes")
            ended_at = occurred_at + timedelta(minutes=duration)
        if ended_at is not None:
            ended_at = as_utc(ended_at)
            if ended_at <= occurred_at:
                raise CareLogError("A sleep must end after it starts.")
            if ended_at - occurred_at > SLEEP_MAX:
                raise CareLogError("A single sleep can't be longer than 24 hours.")
            if ended_at > now + FUTURE_TOLERANCE:
                raise CareLogError("A sleep can't end in the future.")
            values["in_progress"] = False
        values["ended_at"] = ended_at
        values["in_progress"] = bool(values.get("in_progress"))
    else:
        values.pop("in_progress", None)

    return values


def sleep_in_progress(db: Session, child_id: UUID, exclude: UUID | None = None) -> CareLog | None:
    query = db.query(CareLog).filter(CareLog.child_id == child_id, CareLog.in_progress.is_(True))
    if exclude is not None:
        query = query.filter(CareLog.id != exclude)
    return query.first()


def latest_by_type(db: Session, child_id: UUID) -> dict[str, CareLog]:
    """The most recent entry of each type (by when it happened)."""
    rows = (
        db.query(CareLog)
        .filter(CareLog.child_id == child_id)
        .distinct(CareLog.type)
        .order_by(CareLog.type, CareLog.timestamp.desc(), CareLog.id)
        .all()
    )
    return {row.type.value: row for row in rows}


# Per-day aggregates, all in SQL. `days` lists each local calendar day with
# its start and end as absolute times in the requested timezone. Feeds and
# diapers belong to the day they happened; sleep minutes are the overlap of
# each sleep with the day (an in-progress sleep runs until :now); the
# longest stretch is the longest finished sleep that started that day.
# Enum values are stored by name (FEED, BOTTLE, ...), as everywhere else.
_SUMMARY_SQL = text(
    """
    WITH days AS (
        SELECT d::date AS day,
               (d::timestamp AT TIME ZONE :tz) AS day_start,
               ((d + interval '1 day')::timestamp AT TIME ZONE :tz) AS day_end
        FROM generate_series(CAST(:start AS date), CAST(:end AS date), interval '1 day') AS d
    )
    SELECT days.day,
           feed.feeds, feed.feed_ml, feed.ml_count, feed.min_sum, feed.min_count,
           diaper.wet, diaper.dirty, diaper.both, diaper.other,
           sleep.sleep_seconds, sleep.longest_seconds, sleep.sleeps
    FROM days
    CROSS JOIN LATERAL (
        SELECT count(*) AS feeds,
               coalesce(sum(c.amount_ml), 0) AS feed_ml,
               count(c.amount_ml) AS ml_count,
               coalesce(sum(c.duration_min), 0) AS min_sum,
               count(c.duration_min) AS min_count
        FROM care_logs c
        WHERE c.child_id = :child_id AND c.type = 'FEED'
          AND c.timestamp >= days.day_start AND c.timestamp < days.day_end
    ) feed
    CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE c.diaper_kind = 'WET') AS wet,
               count(*) FILTER (WHERE c.diaper_kind = 'DIRTY') AS dirty,
               count(*) FILTER (WHERE c.diaper_kind = 'BOTH') AS both,
               count(*) FILTER (WHERE c.diaper_kind IS NULL) AS other
        FROM care_logs c
        WHERE c.child_id = :child_id AND c.type = 'DIAPER'
          AND c.timestamp >= days.day_start AND c.timestamp < days.day_end
    ) diaper
    CROSS JOIN LATERAL (
        SELECT coalesce(sum(extract(epoch FROM
                   least(CASE WHEN c.in_progress THEN CAST(:now AS timestamptz) ELSE c.ended_at END, days.day_end)
                   - greatest(c.timestamp, days.day_start))), 0) AS sleep_seconds,
               max(extract(epoch FROM c.ended_at - c.timestamp))
                   FILTER (WHERE c.ended_at IS NOT NULL AND c.timestamp >= days.day_start) AS longest_seconds,
               count(*) FILTER (WHERE c.timestamp >= days.day_start) AS sleeps
        FROM care_logs c
        WHERE c.child_id = :child_id AND c.type = 'SLEEP'
          AND (c.ended_at IS NOT NULL OR c.in_progress)
          AND c.timestamp < days.day_end
          AND (CASE WHEN c.in_progress THEN CAST(:now AS timestamptz) ELSE c.ended_at END) > days.day_start
    ) sleep
    ORDER BY days.day
    """
)

# Sleeps of unknown length still mark a day as one with entries.
_UNTIMED_SLEEP_DAYS_SQL = text(
    """
    SELECT DISTINCT (c.timestamp AT TIME ZONE :tz)::date AS day
    FROM care_logs c
    WHERE c.child_id = :child_id AND c.type = 'SLEEP'
      AND c.ended_at IS NULL AND NOT c.in_progress
      AND c.timestamp >= (CAST(:start AS date)::timestamp AT TIME ZONE :tz)
      AND c.timestamp < ((CAST(:end AS date) + 1)::timestamp AT TIME ZONE :tz)
    UNION
    SELECT DISTINCT (c.timestamp AT TIME ZONE :tz)::date
    FROM care_logs c
    WHERE c.child_id = :child_id AND c.type = 'MEDICATION'
      AND c.timestamp >= (CAST(:start AS date)::timestamp AT TIME ZONE :tz)
      AND c.timestamp < ((CAST(:end AS date) + 1)::timestamp AT TIME ZONE :tz)
    """
)


@dataclass
class _Totals:
    feeds: int = 0
    feed_ml: int = 0
    ml_count: int = 0
    min_sum: int = 0
    min_count: int = 0
    diapers: int = 0
    sleep_min: int = 0


def _mean(total: float, count: int) -> float | None:
    return round(total / count, 1) if count else None


def summary(db: Session, child_id: UUID, days: int, tz: str, now: datetime) -> dict:
    if days not in SUMMARY_DAYS:
        raise CareLogError("days must be 7 or 30.")
    end = now.astimezone(ZoneInfo(tz)).date()
    start = end - timedelta(days=days - 1)
    params = {"child_id": child_id, "tz": tz, "start": start, "end": end, "now": now}

    daily = []
    totals = _Totals()
    active_days: set[date] = {row.day for row in db.execute(_UNTIMED_SLEEP_DAYS_SQL, params)}
    for row in db.execute(_SUMMARY_SQL, params):
        diapers = row.wet + row.dirty + row.both + row.other
        sleep_min = round(float(row.sleep_seconds) / 60)
        daily.append(
            {
                "day": row.day,
                "feeds": row.feeds,
                "feed_ml": int(row.feed_ml),
                "avg_feed_ml": _mean(row.feed_ml, row.ml_count),
                "avg_feed_min": _mean(row.min_sum, row.min_count),
                "diapers_wet": row.wet,
                "diapers_dirty": row.dirty,
                "diapers_both": row.both,
                "diapers_other": row.other,
                "sleep_min": sleep_min,
                "longest_sleep_min": None if row.longest_seconds is None else round(float(row.longest_seconds) / 60),
            }
        )
        if row.feeds or diapers or row.sleeps or sleep_min:
            active_days.add(row.day)
        totals.feeds += row.feeds
        totals.feed_ml += int(row.feed_ml)
        totals.ml_count += row.ml_count
        totals.min_sum += int(row.min_sum)
        totals.min_count += row.min_count
        totals.diapers += diapers
        totals.sleep_min += sleep_min

    n = len(active_days)
    return {
        "days": days,
        "timezone": tz,
        "start": start,
        "end": end,
        "daily": daily,
        "averages": {
            "days_with_entries": n,
            "feeds_per_day": _mean(totals.feeds, n),
            "feed_ml_per_day": _mean(totals.feed_ml, n),
            "avg_feed_ml": _mean(totals.feed_ml, totals.ml_count),
            "avg_feed_min": _mean(totals.min_sum, totals.min_count),
            "diapers_per_day": _mean(totals.diapers, n),
            "sleep_min_per_day": _mean(totals.sleep_min, n),
        },
    }
