"""
WHO Child Growth Standards -- Weight-for-age, boys and girls, birth to
24 months, LMS method.

METHOD SOURCE:
  WHO Multicentre Growth Reference Study Group. "WHO Child Growth
  Standards: Length/height-for-age, weight-for-age, weight-for-length,
  weight-for-height and body mass index-for-age: Methods and
  development." Geneva: World Health Organization, 2006. Chapter 5
  ("Construction of the standards") defines the LMS method used below.

DATA SOURCE (the exact L, M, S numbers transcribed into the tables below):
  CDC National Center for Health Statistics, "WHO Growth Charts Data
  Files" (weight-for-age, birth-24 months), retrieved 2026-09-18:
    Boys:  https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Boys-Weight-for-age-Percentiles.csv
    Girls: https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Girls-Weight-for-age%20Percentiles.csv
  These CDC-hosted files are CDC's official mirror of the WHO 2006
  standards, reformatted for clinical use in the United States (CDC/AAP
  jointly recommend using the WHO standards, not the older CDC 1977/2000
  reference, for children under age 2). See also:
  https://www.who.int/tools/child-growth-standards/standards/weight-for-age

WAZ PLAUSIBILITY FLAG SOURCE:
  WHO flags a weight-for-age z-score (WAZ) as biologically implausible
  when it falls below -6 or above +5. (Cited in, e.g., WHO Anthro/AnthroPlus
  software documentation and used throughout WHO/UNICEF nutrition survey
  guidance.) This module surfaces that flag; it does not change how the
  z-score itself is computed.

SCOPE: age in COMPLETE months, 0 through 24, both sexes, weight-for-age
only. See reference-data/README.md for what is intentionally left out
(height/length-for-age, weight-for-length, head circumference, ages beyond
24 months, and sub-month/day-level precision) and exactly how to extend
this table if those are needed later.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# LMS parameters: {age_in_completed_months: (L, M, S)}
# L = Box-Cox power transformation parameter (skewness)
# M = median
# S = coefficient of variation
#
# Transcribed verbatim from the CDC-hosted CSV files cited above
# (columns "Month", "L", "M", "S"), months 0-24 inclusive, on 2026-09-18.
# ---------------------------------------------------------------------------

LMS_WEIGHT_FOR_AGE_BOYS: dict[int, tuple[float, float, float]] = {
    0: (0.3487, 3.3464, 0.14602),
    1: (0.2297, 4.4709, 0.13395),
    2: (0.1970, 5.5675, 0.12385),
    3: (0.1738, 6.3762, 0.11727),
    4: (0.1553, 7.0023, 0.11316),
    5: (0.1395, 7.5105, 0.11080),
    6: (0.1257, 7.9340, 0.10958),
    7: (0.1134, 8.2970, 0.10902),
    8: (0.1021, 8.6151, 0.10882),
    9: (0.0917, 8.9014, 0.10881),
    10: (0.0820, 9.1649, 0.10891),
    11: (0.0730, 9.4122, 0.10906),
    12: (0.0644, 9.6479, 0.10925),
    13: (0.0563, 9.8749, 0.10949),
    14: (0.0487, 10.0953, 0.10976),
    15: (0.0413, 10.3108, 0.11007),
    16: (0.0343, 10.5228, 0.11041),
    17: (0.0275, 10.7319, 0.11079),
    18: (0.0211, 10.9385, 0.11119),
    19: (0.0148, 11.1430, 0.11164),
    20: (0.0087, 11.3462, 0.11211),
    21: (0.0029, 11.5486, 0.11261),
    22: (-0.0028, 11.7504, 0.11314),
    23: (-0.0083, 11.9514, 0.11369),
    24: (-0.0137, 12.1515, 0.11426),
}

LMS_WEIGHT_FOR_AGE_GIRLS: dict[int, tuple[float, float, float]] = {
    0: (0.3809, 3.2322, 0.14171),
    1: (0.1714, 4.1873, 0.13724),
    2: (0.0962, 5.1282, 0.13000),
    3: (0.0402, 5.8458, 0.12619),
    4: (-0.0050, 6.4237, 0.12402),
    5: (-0.0430, 6.8985, 0.12274),
    6: (-0.0756, 7.2970, 0.12204),
    7: (-0.1039, 7.6422, 0.12178),
    8: (-0.1288, 7.9487, 0.12181),
    9: (-0.1507, 8.2254, 0.12199),
    10: (-0.1700, 8.4800, 0.12223),
    11: (-0.1872, 8.7192, 0.12247),
    12: (-0.2024, 8.9481, 0.12268),
    13: (-0.2158, 9.1699, 0.12283),
    14: (-0.2278, 9.3870, 0.12294),
    15: (-0.2384, 9.6008, 0.12299),
    16: (-0.2478, 9.8124, 0.12303),
    17: (-0.2562, 10.0226, 0.12306),
    18: (-0.2637, 10.2315, 0.12309),
    19: (-0.2703, 10.4393, 0.12315),
    20: (-0.2762, 10.6464, 0.12323),
    21: (-0.2815, 10.8534, 0.12335),
    22: (-0.2862, 11.0608, 0.12350),
    23: (-0.2903, 11.2688, 0.12369),
    24: (-0.2941, 11.4775, 0.12390),
}

_SEX_ALIASES = {
    "male": "male", "m": "male", "boy": "male",
    "female": "female", "f": "female", "girl": "female",
}

# WHO-documented biological plausibility bounds for weight-for-age z-scores.
_WAZ_PLAUSIBLE_MIN = -6.0
_WAZ_PLAUSIBLE_MAX = 5.0


def _normalize_sex(sex: str) -> str:
    key = sex.strip().lower()
    if key not in _SEX_ALIASES:
        raise ValueError(f"Unrecognized sex {sex!r}; expected one of {sorted(_SEX_ALIASES)}")
    return _SEX_ALIASES[key]


def _lms_for(age_months: int, sex: str) -> tuple[float, float, float]:
    sex_key = _normalize_sex(sex)
    table = LMS_WEIGHT_FOR_AGE_BOYS if sex_key == "male" else LMS_WEIGHT_FOR_AGE_GIRLS
    if age_months not in table:
        raise ValueError(
            f"age_months must be a whole number from 0 to 24 (got {age_months!r}); "
            "this table does not cover other ages or sub-month/day precision -- "
            "see reference-data/README.md for how to extend it."
        )
    return table[age_months]


def weight_for_age_z_score(age_months: int, sex: str, weight_kg: float) -> float:
    """WHO LMS method:
        Z = (((X / M) ** L) - 1) / (L * S)   if L != 0
        Z = ln(X / M) / S                     if L == 0
    (WHO Multicentre Growth Reference Study Group, 2006, Chapter 5.)
    """
    if weight_kg <= 0:
        raise ValueError("weight_kg must be positive")
    L, M, S = _lms_for(age_months, sex)
    if L == 0:
        return math.log(weight_kg / M) / S
    return ((weight_kg / M) ** L - 1) / (L * S)


def z_score_to_percentile(z: float) -> float:
    """Standard normal CDF, expressed as a percentile in [0, 100]."""
    return 0.5 * (1 + math.erf(z / math.sqrt(2))) * 100


@dataclass(frozen=True)
class GrowthResult:
    age_months: int
    sex: str
    weight_kg: float
    z_score: float
    percentile: float
    plausible: bool  # False if WHO WAZ plausibility bounds are exceeded


def weight_for_age_percentile(age_months: int, sex: str, weight_kg: float) -> GrowthResult:
    """Return the WHO weight-for-age z-score and percentile for a single
    weight measurement at a given age (whole completed months, 0-24) and
    sex ("male"/"female", or the aliases in _SEX_ALIASES).
    """
    z = weight_for_age_z_score(age_months, sex, weight_kg)
    percentile = z_score_to_percentile(z)
    plausible = _WAZ_PLAUSIBLE_MIN <= z <= _WAZ_PLAUSIBLE_MAX
    return GrowthResult(
        age_months=age_months,
        sex=_normalize_sex(sex),
        weight_kg=weight_kg,
        z_score=z,
        percentile=percentile,
        plausible=plausible,
    )
