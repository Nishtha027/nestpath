"""Computes a WHO weight-for-age percentile/z-score for a growth
measurement using backend/reference-data/growth_percentile.py, and
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

from growth_percentile import weight_for_age_percentile  # noqa: E402

from ..models import Child, GrowthMeasurement  # noqa: E402

# growth_percentile.py has no exported version constant (unlike
# vaccine_schedule.py's source_version) -- this mirrors its module
# docstring's own data provenance statement instead.
SOURCE_VERSION = (
    "WHO Child Growth Standards, weight-for-age 0-24mo, LMS method "
    "(CDC-hosted WHO growth chart tables, retrieved 2026-09-18)"
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
    db: Session, child: Child, measured_at: date, sex: str, weight_kg: float
) -> GrowthMeasurement:
    """Compute the WHO percentile/z-score for a single measurement and
    stage a GrowthMeasurement row (caller commits). Raises ValueError
    (via growth_percentile.py) for an out-of-range age, unrecognized
    sex, or non-positive weight.
    """
    age_months = age_in_completed_months(child.birth_date, measured_at)
    result = weight_for_age_percentile(age_months, sex, weight_kg)
    measurement = GrowthMeasurement(
        child_id=child.id,
        measured_at=measured_at,
        age_months=result.age_months,
        sex=result.sex,
        weight_kg=result.weight_kg,
        percentile=result.percentile,
        z_score=result.z_score,
        source_version=SOURCE_VERSION,
    )
    db.add(measurement)
    return measurement
