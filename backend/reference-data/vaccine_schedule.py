"""
CDC Child and Adolescent Immunization Schedule (United States), ages 0-18 years.

PRIMARY SOURCES (retrieved 2026-09-18):
  - Table 1 (recommended age by dose):
    CDC, "Child and Adolescent Immunization Schedule by Age"
    (Addendum updated July 2, 2025). Recommendations for Ages 18 Years or
    Younger, United States, 2025.
    https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html
  - Table 2 (minimum age / minimum interval, i.e. the catch-up table):
    CDC, "Catch-up Immunization Schedule for Children and Adolescents"
    (Addendum updated July 2, 2025).
    https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html
  - Per-vaccine minimum-age callouts and HPV 2-dose/3-dose interval rule:
    CDC, "Child Immunization Schedule Notes" (Addendum updated July 2, 2025).
    https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html

IMPORTANT VERSION NOTE (as of retrieval date 2026-09-18):
  The page above states: "Pursuant to the preliminary order issued on
  March 16, 2026, in American Academy of Pediatrics et al. v. Kennedy et
  al., No. 1:25-cv-11916 (D. Mass.), which stayed all votes taken by the
  ACIP during its June, September and December 2025 meetings, and further
  stayed the Acting CDC Director's January 5, 2026 Decision Memo revising
  the CDC's childhood immunization schedule, the July 2, 2025 immunization
  schedule posted here is the current CDC Child and Adolescent
  Immunization Schedule by Age for Healthcare Professionals."
  In other words: the July 2, 2025 schedule encoded below is, as of the
  retrieval date, the schedule in legal effect -- NOT necessarily the most
  recent ACIP votes. Re-check the CDC URLs above before relying on this
  file for anything beyond Phase 0 review, and re-verify on every future
  refresh of this data, since this is an active, litigated area.

SCOPE: see reference-data/README.md for exactly which vaccines/doses are
modeled with full dose-by-dose logic vs. listed for reference only.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Sequence


# ---------------------------------------------------------------------------
# Age-unit helpers
#
# CDC states: "For calculating intervals between doses, 4 weeks = 28 days.
# Intervals of >=4 months are determined by calendar months."
# (Child Immunization Schedule Notes, "Additional information".)
#
# This module approximates calendar months/years with fixed-length days
# (365.25 / 12 per month, 365.25 per year) rather than true calendar-month
# arithmetic. This is a known Phase 0 simplification -- see README.md,
# "Intentionally left out / simplifications", item 1.
# ---------------------------------------------------------------------------
_DAYS_PER_WEEK = 7
_DAYS_PER_MONTH = 365.25 / 12
_DAYS_PER_YEAR = 365.25


def weeks(n: float) -> int:
    return round(n * _DAYS_PER_WEEK)


def months(n: float) -> int:
    return round(n * _DAYS_PER_MONTH)


def years(n: float) -> int:
    return round(n * _DAYS_PER_YEAR)


@dataclass(frozen=True)
class Dose:
    """One dose within a VaccineSeries.

    All *_days fields are counted from the child's date of birth unless
    otherwise noted (minimum_interval_from_previous_days and
    minimum_days_since_dose1 are counted from a previously administered
    dose of the SAME vaccine).
    """

    dose_number: int
    recommended_age_label: str
    recommended_age_min_days: int | None
    recommended_age_max_days: int | None
    minimum_age_days: int | None = None
    minimum_interval_from_previous_days: int | None = None
    minimum_days_since_dose1: int | None = None
    skip_if_previous_dose_age_days_gte: int | None = None
    maximum_age_for_dose_days: int | None = None
    note: str = ""


@dataclass(frozen=True)
class VaccineSeries:
    vaccine_id: str
    display_name: str
    doses: tuple[Dose, ...]


# ---------------------------------------------------------------------------
# Hepatitis B (HepB)
# Source: Table 1 row "Hepatitis B"; Table 2 row "Hepatitis B",
# minimum age Birth (Notes: "minimum age: birth").
# ---------------------------------------------------------------------------
HEPB = VaccineSeries(
    "hepb",
    "Hepatitis B (HepB)",
    doses=(
        Dose(1, "Birth", 0, 0, minimum_age_days=0),
        Dose(
            2, "1-2 months", months(1), months(2),
            minimum_interval_from_previous_days=weeks(4),
        ),
        Dose(
            3, "6-18 months", months(6), months(18),
            minimum_age_days=weeks(24),
            minimum_interval_from_previous_days=weeks(8),
            minimum_days_since_dose1=weeks(16),
            note=(
                "Min age for final dose: 24 weeks. Min interval dose2->3: "
                "8 weeks AND >=16 weeks after dose 1 (whichever is later)."
            ),
        ),
    ),
)

# ---------------------------------------------------------------------------
# Rotavirus (RV)
# Source: Table 1 row "Rotavirus"; Table 2 row "Rotavirus".
# CDC recognizes two products with different series length: RV1 (Rotarix,
# 2-dose series) and RV5 (RotaTeq, 3-dose series). This entry models the
# RV5 3-dose series, the more conservative (longer) of the two -- see
# README.md simplification #2.
# ---------------------------------------------------------------------------
ROTAVIRUS = VaccineSeries(
    "rotavirus",
    "Rotavirus (RV)",
    doses=(
        Dose(
            1, "2 months", months(2), months(2),
            minimum_age_days=weeks(6),
            maximum_age_for_dose_days=weeks(14) + 6,
            note="Max age for dose 1: 14 weeks, 6 days.",
        ),
        Dose(
            2, "4 months", months(4), months(4),
            minimum_interval_from_previous_days=weeks(4),
        ),
        Dose(
            3, "6 months", months(6), months(6),
            minimum_interval_from_previous_days=weeks(4),
            maximum_age_for_dose_days=months(8),
            note="Max age for final dose: 8 months, 0 days. (RV5/RotaTeq only; RV1/Rotarix is a 2-dose series.)",
        ),
    ),
)

# ---------------------------------------------------------------------------
# Diphtheria, tetanus, acellular pertussis (DTaP: <7 yrs)
# Source: Table 1 row "DTaP"; Table 2 row "Diphtheria, tetanus, and
# acellular pertussis".
# ---------------------------------------------------------------------------
DTAP = VaccineSeries(
    "dtap",
    "Diphtheria, Tetanus, Acellular Pertussis (DTaP)",
    doses=(
        Dose(1, "2 months", months(2), months(2), minimum_age_days=weeks(6)),
        Dose(2, "4 months", months(4), months(4), minimum_interval_from_previous_days=weeks(4)),
        Dose(3, "6 months", months(6), months(6), minimum_interval_from_previous_days=weeks(4)),
        Dose(
            4, "15-18 months", months(15), months(18),
            minimum_interval_from_previous_days=months(6),
        ),
        Dose(
            5, "4-6 years", years(4), years(6),
            minimum_interval_from_previous_days=months(6),
            note=(
                "A 5th dose is NOT necessary if dose 4 was given at age "
                ">=4 years AND >=6 months after dose 3 (CDC Table 2). "
                "This exception is applied in dose logic below, not as static data."
            ),
        ),
    ),
)

# ---------------------------------------------------------------------------
# Haemophilus influenzae type b (Hib)
# Source: Table 1 row "Hib"; Table 2 row "Haemophilus influenzae type b".
# CDC's actual catch-up table branches by product (PRP-T-containing vs.
# PRP-OMP/PedvaxHIB, which uses a 2-dose primary series) and by the age at
# which each prior dose was given. This entry models the standard 4-dose
# primary-series timing (2, 4, 6, 12-15 months) with the age-based "no
# further doses needed" exceptions generalized; brand-specific branching is
# NOT modeled -- see README.md simplification #3.
# ---------------------------------------------------------------------------
HIB = VaccineSeries(
    "hib",
    "Haemophilus influenzae type b (Hib)",
    doses=(
        Dose(1, "2 months", months(2), months(2), minimum_age_days=weeks(6)),
        Dose(
            2, "4 months", months(4), months(4),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(15),
            note="No further doses needed if dose 1 was given at age >=15 months.",
        ),
        Dose(
            3, "6 months", months(6), months(6),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(15),
            note="No further doses needed if dose 2 was given at age >=15 months.",
        ),
        Dose(
            4, "12-15 months", months(12), months(15),
            minimum_interval_from_previous_days=weeks(8),
            skip_if_previous_dose_age_days_gte=months(15),
            note=(
                "Booster; final dose. Only necessary for children age "
                "12-59 months who received 3 primary doses before the 1st birthday."
            ),
        ),
    ),
)

# ---------------------------------------------------------------------------
# Pneumococcal conjugate (PCV15, PCV20)
# Source: Table 1 row "Pneumococcal conjugate"; Table 2 row "Pneumococcal
# conjugate". Mirrors the Hib pattern but with a 24-month (not 15-month)
# "no further doses needed for healthy children" threshold.
# ---------------------------------------------------------------------------
PCV = VaccineSeries(
    "pcv",
    "Pneumococcal Conjugate (PCV15/PCV20)",
    doses=(
        Dose(1, "2 months", months(2), months(2), minimum_age_days=weeks(6)),
        Dose(
            2, "4 months", months(4), months(4),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(24),
            note="No further doses needed for healthy children if dose 1 was given at age >=24 months.",
        ),
        Dose(
            3, "6 months", months(6), months(6),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(24),
            note="No further doses needed for healthy children if dose 2 was given at age >=24 months.",
        ),
        Dose(
            4, "12-15 months", months(12), months(15),
            minimum_interval_from_previous_days=weeks(8),
            skip_if_previous_dose_age_days_gte=months(24),
            note=(
                "Booster; final dose. Only necessary for children age "
                "12-59 months (any risk) or 60-71 months (with a risk "
                "condition) who received 3 doses before age 12 months."
            ),
        ),
    ),
)

# ---------------------------------------------------------------------------
# Inactivated poliovirus (IPV)
# Source: Table 1 row "IPV"; Table 2 row "Inactivated poliovirus".
# ---------------------------------------------------------------------------
IPV = VaccineSeries(
    "ipv",
    "Inactivated Poliovirus (IPV)",
    doses=(
        Dose(1, "2 months", months(2), months(2), minimum_age_days=weeks(6)),
        Dose(2, "4 months", months(4), months(4), minimum_interval_from_previous_days=weeks(4)),
        Dose(
            3, "6-18 months", months(6), months(18),
            minimum_interval_from_previous_days=weeks(4),
        ),
        Dose(
            4, "4-6 years", years(4), years(6),
            minimum_age_days=years(4),
            minimum_interval_from_previous_days=months(6),
            note=(
                "A 4th dose is NOT necessary if dose 3 was given at age "
                ">=4 years AND >=6 months after dose 2 (CDC Table 2). "
                "Conversely, a 4th dose IS indicated if all previous doses "
                "were given before age 4y, or if dose 3 was <6 months after "
                "dose 2 -- this is simply the default (non-skip) outcome."
            ),
        ),
    ),
)

# ---------------------------------------------------------------------------
# Measles, mumps, rubella (MMR)
# Source: Table 1 row "MMR"; Table 2 row "Measles, mumps, rubella".
# ---------------------------------------------------------------------------
MMR = VaccineSeries(
    "mmr",
    "Measles, Mumps, Rubella (MMR)",
    doses=(
        Dose(1, "12-15 months", months(12), months(15), minimum_age_days=months(12)),
        Dose(2, "4-6 years", years(4), years(6), minimum_interval_from_previous_days=weeks(4)),
    ),
)

# ---------------------------------------------------------------------------
# Varicella (VAR)
# Source: Table 1 row "Varicella"; Table 2 rows "Varicella" (4mo-6yr table:
# 3 months) and "Varicella" (7-18yr table: 3 months if <13yr, 4 weeks if
# >=13yr).
# ---------------------------------------------------------------------------
VARICELLA = VaccineSeries(
    "varicella",
    "Varicella (VAR)",
    doses=(
        Dose(1, "12-15 months", months(12), months(15), minimum_age_days=months(12)),
        Dose(
            2, "4-6 years", years(4), years(6),
            minimum_interval_from_previous_days=months(3),
            note=(
                "Min interval is 3 months if dose 1 was given before age "
                "13 years (the routine pediatric case modeled by the "
                "static value above); if dose 1 was given at age >=13 "
                "years, the minimum interval is instead 4 weeks -- applied "
                "in dose logic below, not as static data."
            ),
        ),
    ),
)

# ---------------------------------------------------------------------------
# Hepatitis A (HepA)
# Source: Table 1 row "Hepatitis A"; Table 2 row "Hepatitis A"
# (4mo-6yr table: minimum age 12 months, minimum interval 6 months).
# ---------------------------------------------------------------------------
HEPA = VaccineSeries(
    "hepa",
    "Hepatitis A (HepA)",
    doses=(
        Dose(1, "12-23 months", months(12), months(23), minimum_age_days=months(12)),
        Dose(
            2, "6-18 months after dose 1", months(18), months(30),
            minimum_interval_from_previous_days=months(6),
            note="Recommended-age window shown is an approximation of 'dose 1 + 6-18 months'.",
        ),
    ),
)

# ---------------------------------------------------------------------------
# Meningococcal ACWY (MenACWY) -- routine healthy-adolescent 2-dose series
# only. Additional infant/toddler and high-risk dosing (Table 3, medical
# indications) is NOT modeled -- see README.md simplification #4.
# Source: Table 1 row "Meningococcal"; Table 2 row "Meningococcal ACWY".
# ---------------------------------------------------------------------------
MENACWY = VaccineSeries(
    "menacwy",
    "Meningococcal ACWY (MenACWY)",
    doses=(
        Dose(
            1, "11-12 years", years(11), years(12),
            minimum_age_days=months(2),
            note=(
                "Minimum age 2 months applies to MenACWY-CRM (Menveo); "
                "MenACWY-TT (MenQuadfi) has minimum age 2 years. This "
                "entry models the routine adolescent dose."
            ),
        ),
        Dose(2, "16 years", years(16), years(16), minimum_interval_from_previous_days=weeks(8)),
    ),
)

# ---------------------------------------------------------------------------
# Tetanus, diphtheria, acellular pertussis booster (Tdap: >=7 yrs)
# Source: Table 1 row "Tdap"; Table 2 row "Tetanus, diphtheria; tetanus,
# diphtheria, and acellular pertussis"; Notes minimum-age callout
# ("minimum age: 11 years for routine vaccination, 7 years for catch-up").
# Modeled as a single-dose series distinct from the DTaP primary series.
# ---------------------------------------------------------------------------
TDAP = VaccineSeries(
    "tdap",
    "Tetanus, Diphtheria, Acellular Pertussis booster (Tdap)",
    doses=(
        Dose(
            1, "11-12 years", years(11), years(12),
            minimum_age_days=years(7),
            note="Minimum age 7 years applies to catch-up vaccination; routine adolescent dose minimum age is 11 years.",
        ),
    ),
)

# ---------------------------------------------------------------------------
# Human papillomavirus (HPV) -- age-at-first-dose determines series length.
# Source: Table 1 row "HPV"; Notes "Human papillomavirus vaccination"
# (minimum age 9 years) and CDC ACIP guidance: 2-dose series (0, 6-12
# months) if series started before the 15th birthday; 3-dose series
# (0, 1-2 months, 6 months) if started at age >=15 years or for people
# with certain immunocompromising conditions. Minimum intervals: 2-dose ->
# 5 months; 3-dose -> dose1->2 4 weeks, dose2->3 12 weeks, AND dose1->3
# >=5 months (whichever is later).
# ---------------------------------------------------------------------------
HPV_2DOSE = VaccineSeries(
    "hpv_2dose",
    "Human Papillomavirus (HPV), 2-dose series (start age <15 years)",
    doses=(
        Dose(1, "11-12 years", years(11), years(12), minimum_age_days=years(9)),
        Dose(
            2, "6-12 months after dose 1", years(11) + months(6), years(12) + months(12),
            minimum_interval_from_previous_days=months(5),
        ),
    ),
)

HPV_3DOSE = VaccineSeries(
    "hpv_3dose",
    "Human Papillomavirus (HPV), 3-dose series (start age >=15 years, or immunocompromised)",
    doses=(
        Dose(1, "15 years or older at first dose", years(15), None, minimum_age_days=years(9)),
        Dose(2, "1-2 months after dose 1", None, None, minimum_interval_from_previous_days=weeks(4)),
        Dose(
            3, "6 months after dose 1", None, None,
            minimum_interval_from_previous_days=weeks(12),
            minimum_days_since_dose1=months(5),
            note="Min interval dose2->3: 12 weeks AND >=5 months after dose 1 (whichever is later).",
        ),
    ),
)


# ---------------------------------------------------------------------------
# Schedule metadata -- self-describing so a future version of the schedule
# can be swapped in without guessing what this one represents. Keep these
# in sync with the module docstring's "IMPORTANT VERSION NOTE" above.
# ---------------------------------------------------------------------------
effective_date = date(2025, 7, 2)
source_version = "CDC 2025-07-02, pre-2025-ACIP-changes, per AAP v. Kennedy injunction"

VACCINE_SCHEDULE: dict[str, VaccineSeries] = {
    s.vaccine_id: s
    for s in (
        HEPB, ROTAVIRUS, DTAP, HIB, PCV, IPV, MMR, VARICELLA, HEPA,
        MENACWY, TDAP, HPV_2DOSE, HPV_3DOSE,
    )
}

# ---------------------------------------------------------------------------
# Reference-only entries: vaccines/immunizing agents on Table 1 that are NOT
# modeled with dose-by-dose catch-up logic, because they don't fit the
# "fixed dose count with minimum inter-dose interval" shape (annual
# reformulated vaccines, single-dose immunoprophylaxis, shared clinical
# decision-making, or narrow risk-group indications). See README.md,
# "Intentionally left out", for the full explanation.
# Source: Table 1 (by-age) and Notes minimum-age callouts, same pages as above.
# ---------------------------------------------------------------------------
OTHER_IMMUNIZATIONS = {
    "rsv_mab": {
        "display_name": "Respiratory Syncytial Virus monoclonal antibody (Nirsevimab)",
        "minimum_age_days": 0,
        "note": "1 dose at birth or entering first RSV season depending on maternal vaccination status; 1 dose age 8-19 months for some high-risk children entering second season. Not a fixed multi-dose series.",
    },
    "rsv_maternal": {
        "display_name": "Respiratory Syncytial Virus vaccine, maternal (Abrysvo)",
        "minimum_age_days": None,
        "note": "Seasonal administration during pregnancy; not a pediatric dose.",
    },
    "influenza": {
        "display_name": "Influenza (IIV3, ccIIV3, LAIV3)",
        "minimum_age_days": months(6),
        "note": "Annual vaccination, 1-2 doses depending on prior vaccination history and age; reformulated yearly.",
    },
    "covid19": {
        "display_name": "COVID-19",
        "minimum_age_days": months(6),
        "note": "Per product- and risk-specific ACIP guidance; shared clinical decision-making for some ages.",
    },
    "menb": {
        "display_name": "Meningococcal B (MenB-4C, MenB-FHbp)",
        "minimum_age_days": years(10),
        "note": "Shared clinical decision-making, typically ages 16-23 years; not a routine universal dose.",
    },
    "dengue": {
        "display_name": "Dengue (DEN4CYD)",
        "minimum_age_days": years(9),
        "note": "Only for children ages 9-16 years with laboratory confirmation of previous dengue infection, living in endemic areas.",
    },
    "mpox": {
        "display_name": "Mpox (Jynneos)",
        "minimum_age_days": years(18),
        "note": "Outside pediatric (0-18) scope for routine use; listed on Table 1 for special situations only.",
    },
}


# ---------------------------------------------------------------------------
# Catch-up logic
# ---------------------------------------------------------------------------
@dataclass
class DoseResult:
    vaccine_id: str
    dose_number: int | None
    status: str  # "complete" | "not_required" | "due_now" | "upcoming"
    earliest_valid_date: date | None
    notes: str


def _dose_not_required(
    vaccine_id: str, dose: Dose, dose_history: Sequence[date], dob: date
) -> tuple[bool, str]:
    """Check CDC Table 2 exceptions that make a dose unnecessary."""
    if not dose_history:
        return False, ""

    prev_date = dose_history[-1]
    prev_age_days = (prev_date - dob).days

    if (
        dose.skip_if_previous_dose_age_days_gte is not None
        and prev_age_days >= dose.skip_if_previous_dose_age_days_gte
    ):
        return True, dose.note or "Not required per CDC catch-up exception."

    # DTaP dose 5: CDC Table 2 -- "A fifth dose is not necessary if the
    # fourth dose was administered at age 4 years or older and at least
    # 6 months after dose 3."
    if vaccine_id == "dtap" and dose.dose_number == 5 and len(dose_history) >= 4:
        dose4_date = dose_history[3]
        dose3_date = dose_history[2]
        dose4_age_days = (dose4_date - dob).days
        if dose4_age_days >= years(4) and (dose4_date - dose3_date).days >= months(6):
            return True, (
                "5th dose not necessary: 4th dose was given at age >=4y "
                "and >=6mo after the 3rd dose (CDC Table 2)."
            )

    # IPV dose 4: CDC Table 2 -- "A fourth dose is not necessary if the
    # third dose was administered at age 4 years or older and at least
    # 6 months after the previous dose."
    if vaccine_id == "ipv" and dose.dose_number == 4 and len(dose_history) >= 3:
        dose3_date = dose_history[2]
        dose2_date = dose_history[1]
        dose3_age_days = (dose3_date - dob).days
        if dose3_age_days >= years(4) and (dose3_date - dose2_date).days >= months(6):
            return True, (
                "4th dose not necessary: 3rd dose was given at age >=4y "
                "and >=6mo after the 2nd dose (CDC Table 2)."
            )

    return False, ""


def _effective_interval(
    vaccine_id: str, dose: Dose, dose_history: Sequence[date], dob: date
) -> int | None:
    """Resolve interval rules that depend on the age at a previous dose."""
    if vaccine_id == "varicella" and dose.dose_number == 2 and dose_history:
        age_at_dose1_days = (dose_history[0] - dob).days
        # CDC Table 2 (7-18yr section): 4 weeks if dose 1 given at age
        # >=13 years; otherwise (4mo-6yr section) 3 months.
        return weeks(4) if age_at_dose1_days >= years(13) else months(3)
    return dose.minimum_interval_from_previous_days


def next_valid_dose(
    vaccine_id: str,
    date_of_birth: date,
    dose_history: Sequence[date],
    today: date | None = None,
) -> DoseResult:
    """Given a vaccine series, a child's date of birth, and the dates of
    doses already administered for that vaccine, return the next dose that
    is due and the earliest date it becomes CDC-valid, correctly applying
    minimum age and minimum interval-since-previous-dose rules (including
    missed/delayed doses -- a vaccine series never restarts, per CDC:
    "A vaccine series does not need to be restarted, regardless of the
    time that has elapsed between doses.").
    """
    today = today or date.today()
    series = VACCINE_SCHEDULE[vaccine_id]
    dose_history = sorted(dose_history)
    given = len(dose_history)

    if given >= len(series.doses):
        return DoseResult(vaccine_id, None, "complete", None, "All doses in this series have been recorded.")

    dose = series.doses[given]

    skip, skip_reason = _dose_not_required(vaccine_id, dose, dose_history, date_of_birth)
    if skip:
        return DoseResult(vaccine_id, dose.dose_number, "not_required", None, skip_reason)

    candidates: list[date] = []
    if dose.minimum_age_days is not None:
        candidates.append(date_of_birth + timedelta(days=dose.minimum_age_days))
    if dose_history:
        interval = _effective_interval(vaccine_id, dose, dose_history, date_of_birth)
        if interval is not None:
            candidates.append(dose_history[-1] + timedelta(days=interval))
        if dose.minimum_days_since_dose1 is not None:
            candidates.append(dose_history[0] + timedelta(days=dose.minimum_days_since_dose1))
    if not candidates:
        candidates.append(date_of_birth)

    earliest = max(candidates)
    status = "due_now" if earliest <= today else "upcoming"

    notes = dose.note
    if dose.maximum_age_for_dose_days is not None:
        window_close = date_of_birth + timedelta(days=dose.maximum_age_for_dose_days)
        if today > window_close:
            extra = "Recommended CDC age window for this dose has passed; consult a clinician about next steps."
            notes = f"{notes} {extra}".strip()

    return DoseResult(vaccine_id, dose.dose_number, status, earliest, notes)


def next_valid_hpv_dose(
    date_of_birth: date, dose_history: Sequence[date], today: date | None = None
) -> DoseResult:
    """HPV series length (2-dose vs 3-dose) depends on age at dose 1, so it
    is resolved here rather than being a single static VaccineSeries.
    """
    today = today or date.today()
    dose_history = sorted(dose_history)
    if dose_history:
        age_at_dose1_days = (dose_history[0] - date_of_birth).days
    else:
        # No doses yet: CDC recommends the 2-dose series if vaccination
        # begins before the 15th birthday, else the 3-dose series.
        age_at_dose1_days = (today - date_of_birth).days
    track = "hpv_2dose" if age_at_dose1_days < years(15) else "hpv_3dose"
    return next_valid_dose(track, date_of_birth, dose_history, today)


def catch_up_plan(
    date_of_birth: date,
    history: dict[str, Sequence[date]],
    today: date | None = None,
) -> dict[str, DoseResult]:
    """Compute the next valid dose for every modeled vaccine.

    `history` maps vaccine_id (e.g. "dtap") -> list of dates already
    administered for that vaccine. For HPV, supply history under the key
    "hpv" (not "hpv_2dose"/"hpv_3dose" -- those are internal track ids).
    """
    today = today or date.today()
    plan: dict[str, DoseResult] = {}
    for vaccine_id, series in VACCINE_SCHEDULE.items():
        if series in (HPV_2DOSE, HPV_3DOSE):
            continue
        plan[vaccine_id] = next_valid_dose(vaccine_id, date_of_birth, history.get(vaccine_id, []), today)
    plan["hpv"] = next_valid_hpv_dose(date_of_birth, history.get("hpv", []), today)
    return plan
