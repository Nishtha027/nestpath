"""
WHO Child Growth Standards -- Weight-for-age and length-for-age, boys and
girls, birth to 24 months, LMS method.

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

  Length-for-age, same CDC mirror, retrieved 2026-10-08 (rows 0-24 of
  columns "Month", "L", "M", "S", generated from the CSVs, not retyped):
    Boys:  https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Boys-Length-for-age-Percentiles.csv
    Girls: https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Girls-Length-for-age-Percentiles.csv
  https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
  WHO's length-for-age standard has L = 1 at every month (length is
  normally distributed), so the LMS formula reduces to (X - M) / (M * S).

PLAUSIBILITY FLAG SOURCE:
  WHO flags a weight-for-age z-score (WAZ) as biologically implausible
  when it falls below -6 or above +5, and a length-for-age z-score (HAZ)
  below -6 or above +6. (Cited in, e.g., WHO Anthro/AnthroPlus software
  documentation and used throughout WHO/UNICEF nutrition survey
  guidance.) This module surfaces those flags; they do not change how the
  z-score itself is computed.

SCOPE: age in COMPLETE months, 0 through 24, both sexes, weight-for-age
and length-for-age (recumbent length, which WHO uses under 24 months).
See reference-data/README.md for what is intentionally left out
(weight-for-length, head circumference, ages beyond 24 months, and
sub-month/day-level precision) and exactly how to extend these tables if
those are needed later.
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

# Length-for-age (recumbent length, cm). Generated from the CDC-hosted CSVs
# cited above (columns "Month", "L", "M", "S"), months 0-24, on 2026-10-08.

LMS_LENGTH_FOR_AGE_BOYS: dict[int, tuple[float, float, float]] = {
    0: (1.0, 49.8842, 0.03795),
    1: (1.0, 54.7244, 0.03557),
    2: (1.0, 58.4249, 0.03424),
    3: (1.0, 61.4292, 0.03328),
    4: (1.0, 63.886, 0.03257),
    5: (1.0, 65.9026, 0.03204),
    6: (1.0, 67.6236, 0.03165),
    7: (1.0, 69.1645, 0.03139),
    8: (1.0, 70.5994, 0.03124),
    9: (1.0, 71.9687, 0.03117),
    10: (1.0, 73.2812, 0.03118),
    11: (1.0, 74.5388, 0.03125),
    12: (1.0, 75.7488, 0.03137),
    13: (1.0, 76.9186, 0.03154),
    14: (1.0, 78.0497, 0.03174),
    15: (1.0, 79.1458, 0.03197),
    16: (1.0, 80.2113, 0.03222),
    17: (1.0, 81.2487, 0.0325),
    18: (1.0, 82.2587, 0.03279),
    19: (1.0, 83.2418, 0.0331),
    20: (1.0, 84.1996, 0.03342),
    21: (1.0, 85.1348, 0.03376),
    22: (1.0, 86.0477, 0.0341),
    23: (1.0, 86.941, 0.03445),
    24: (1.0, 87.8161, 0.03479),
}


LMS_LENGTH_FOR_AGE_GIRLS: dict[int, tuple[float, float, float]] = {
    0: (1.0, 49.1477, 0.0379),
    1: (1.0, 53.6872, 0.0364),
    2: (1.0, 57.0673, 0.03568),
    3: (1.0, 59.8029, 0.0352),
    4: (1.0, 62.0899, 0.03486),
    5: (1.0, 64.0301, 0.03463),
    6: (1.0, 65.7311, 0.03448),
    7: (1.0, 67.2873, 0.03441),
    8: (1.0, 68.7498, 0.0344),
    9: (1.0, 70.1435, 0.03444),
    10: (1.0, 71.4818, 0.03452),
    11: (1.0, 72.771, 0.03464),
    12: (1.0, 74.015, 0.03479),
    13: (1.0, 75.2176, 0.03496),
    14: (1.0, 76.3817, 0.03514),
    15: (1.0, 77.5099, 0.03534),
    16: (1.0, 78.6055, 0.03555),
    17: (1.0, 79.671, 0.03576),
    18: (1.0, 80.7079, 0.03598),
    19: (1.0, 81.7182, 0.0362),
    20: (1.0, 82.7036, 0.03643),
    21: (1.0, 83.6654, 0.03666),
    22: (1.0, 84.604, 0.03688),
    23: (1.0, 85.5202, 0.03711),
    24: (1.0, 86.4153, 0.03734),
}

_SEX_ALIASES = {
    "male": "male", "m": "male", "boy": "male",
    "female": "female", "f": "female", "girl": "female",
}

# WHO-documented biological plausibility bounds for weight-for-age z-scores.
_WAZ_PLAUSIBLE_MIN = -6.0
_WAZ_PLAUSIBLE_MAX = 5.0
# ...and for length-for-age z-scores.
_HAZ_PLAUSIBLE_MIN = -6.0
_HAZ_PLAUSIBLE_MAX = 6.0


def _normalize_sex(sex: str) -> str:
    key = sex.strip().lower()
    if key not in _SEX_ALIASES:
        raise ValueError(f"Unrecognized sex {sex!r}; expected one of {sorted(_SEX_ALIASES)}")
    return _SEX_ALIASES[key]


_TABLES = {
    ("weight", "male"): LMS_WEIGHT_FOR_AGE_BOYS,
    ("weight", "female"): LMS_WEIGHT_FOR_AGE_GIRLS,
    ("length", "male"): LMS_LENGTH_FOR_AGE_BOYS,
    ("length", "female"): LMS_LENGTH_FOR_AGE_GIRLS,
}


def _lms_for(age_months: int, sex: str, indicator: str = "weight") -> tuple[float, float, float]:
    if indicator not in ("weight", "length"):
        raise ValueError(f"indicator must be 'weight' or 'length' (got {indicator!r})")
    table = _TABLES[(indicator, _normalize_sex(sex))]
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


def length_for_age_z_score(age_months: int, sex: str, length_cm: float) -> float:
    """Same LMS formula as weight_for_age_z_score, on the length-for-age
    table. WHO's L is 1 here, so this is (X - M) / (M * S).
    """
    if length_cm <= 0:
        raise ValueError("length_cm must be positive")
    L, M, S = _lms_for(age_months, sex, "length")
    if L == 0:
        return math.log(length_cm / M) / S
    return ((length_cm / M) ** L - 1) / (L * S)


@dataclass(frozen=True)
class LengthResult:
    age_months: int
    sex: str
    length_cm: float
    z_score: float
    percentile: float
    plausible: bool  # False if WHO HAZ plausibility bounds are exceeded


def length_for_age_percentile(age_months: int, sex: str, length_cm: float) -> LengthResult:
    """Return the WHO length-for-age z-score and percentile for a single
    length measurement at a given age (whole completed months, 0-24).
    """
    z = length_for_age_z_score(age_months, sex, length_cm)
    return LengthResult(
        age_months=age_months,
        sex=_normalize_sex(sex),
        length_cm=length_cm,
        z_score=z,
        percentile=z_score_to_percentile(z),
        plausible=_HAZ_PLAUSIBLE_MIN <= z <= _HAZ_PLAUSIBLE_MAX,
    )


def value_at_z(age_months: int, sex: str, indicator: str, z: float) -> float:
    """Inverse of the LMS z-score: the weight (kg) or length (cm) at which a
    child of this age and sex has z-score z (WHO 2006, Chapter 5):
        X = M * (1 + L * S * Z) ** (1 / L)   if L != 0
        X = M * exp(S * Z)                   if L == 0
    """
    L, M, S = _lms_for(age_months, sex, indicator)
    if L == 0:
        return M * math.exp(S * z)
    return M * (1 + L * S * z) ** (1 / L)


# The percentile lines printed on WHO's own 0-2 year charts.
CHART_PERCENTILES = (3, 15, 50, 85, 97)


def reference_curves(sex: str, indicator: str) -> list[dict[str, float]]:
    """One row per month 0-24: {"month": m, "p3": ..., "p50": ..., "p97": ...}
    -- the values a child of that age and sex would need to sit exactly on
    each WHO chart percentile. p50 is the median (M), i.e. the "average" baby.
    """
    from statistics import NormalDist

    zs = {p: NormalDist().inv_cdf(p / 100) for p in CHART_PERCENTILES}
    rows = []
    for month in range(0, 25):
        row: dict[str, float] = {"month": month}
        for p, z in zs.items():
            row[f"p{p}"] = round(value_at_z(month, sex, indicator, z), 3)
        rows.append(row)
    return rows
