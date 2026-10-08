"""Computes WHO weight-for-age and length-for-age percentiles/z-scores for
a growth measurement using backend/reference-data/growth_percentile.py, and
stores the result as a GrowthMeasurement row.

Same sys.path shim as timeline.py -- reference-data/ is a hyphenated
directory, not a valid Python package.
"""

import sys
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

_REFERENCE_DATA_DIR = Path(__file__).resolve().parents[2] / "reference-data"
if str(_REFERENCE_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(_REFERENCE_DATA_DIR))

from growth_percentile import (  # noqa: E402
    length_for_age_percentile,
    reference_curves,
    weight_for_age_percentile,
)

from ..dates import is_in_future  # noqa: E402
from ..models import Child, GrowthMeasurement  # noqa: E402

# growth_percentile.py has no exported version constant (unlike
# vaccine_schedule.py's source_version) -- this mirrors its module
# docstring's own data provenance statement instead.
SOURCE_VERSION = (
    "WHO Child Growth Standards, weight-for-age 0-24mo, LMS method "
    "(CDC-hosted WHO growth chart tables, retrieved 2026-09-18)"
)
# Used when a measurement includes a length (the length table was added later).
SOURCE_VERSION_WITH_LENGTH = (
    "WHO Child Growth Standards, weight-for-age and length-for-age 0-24mo, "
    "LMS method (CDC-hosted WHO growth chart tables, retrieved 2026-09-18 "
    "and 2026-10-08)"
)


def age_in_completed_months(birth_date: date, measured_at: date) -> int:
    """Whole completed months between birth_date and measured_at, matching
    the granularity growth_percentile.py's LMS tables are keyed by.
    """
    months = (measured_at.year - birth_date.year) * 12 + (measured_at.month - birth_date.month)
    if measured_at.day < birth_date.day:
        months -= 1
    return months


def record_growth_measurement(
    db: Session,
    child: Child,
    measured_at: date,
    sex: str,
    weight_kg: float | None = None,
    length_cm: float | None = None,
) -> GrowthMeasurement:
    """Compute the WHO percentiles/z-scores for a single measurement (weight,
    length, or both) and stage a GrowthMeasurement row (caller commits).
    Raises ValueError (via growth_percentile.py) for an out-of-range age,
    unrecognized sex, a non-positive weight or length, or a value outside
    WHO's plausibility limits.
    """
    if is_in_future(measured_at):
        raise ValueError("Measurement date cannot be in the future")
    if weight_kg is None and length_cm is None:
        raise ValueError("Enter a weight, a length, or both")

    age_months = age_in_completed_months(child.birth_date, measured_at)
    weight = weight_for_age_percentile(age_months, sex, weight_kg) if weight_kg is not None else None
    length = length_for_age_percentile(age_months, sex, length_cm) if length_cm is not None else None
    # WHO's data-quality limits (WAZ outside [-6, +5], HAZ outside [-6, +6])
    # catch typos and unit mix-ups (grams for kg, inches for cm) before
    # they're stored and charted.
    if weight and not weight.plausible:
        raise ValueError(
            f"{weight_kg} kg isn't a plausible weight at {age_months} months -- "
            "check the number and that it's in kilograms"
        )
    if length and not length.plausible:
        raise ValueError(
            f"{length_cm} cm isn't a plausible length at {age_months} months -- "
            "check the number and that it's in centimetres"
        )
    result = weight or length
    measurement = GrowthMeasurement(
        child_id=child.id,
        measured_at=measured_at,
        age_months=result.age_months,
        sex=result.sex,
        weight_kg=weight.weight_kg if weight else None,
        percentile=weight.percentile if weight else None,
        z_score=weight.z_score if weight else None,
        length_cm=length.length_cm if length else None,
        length_percentile=length.percentile if length else None,
        length_z_score=length.z_score if length else None,
        source_version=SOURCE_VERSION_WITH_LENGTH if length else SOURCE_VERSION,
    )
    db.add(measurement)
    return measurement


def growth_reference(sex: str) -> dict:
    """WHO chart percentile curves (3rd/15th/50th/85th/97th) for months
    0-24, for drawing a child's measurements against the standard.
    """
    return {
        "sex": sex,
        "source": SOURCE_VERSION_WITH_LENGTH,
        "weight_kg": reference_curves(sex, "weight"),
        "length_cm": reference_curves(sex, "length"),
    }
