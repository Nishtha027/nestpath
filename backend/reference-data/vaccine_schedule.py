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

RE-VERIFIED 2026-10-07 (all three pages above re-read in a browser; each
still dated "Addendum updated July 2, 2025" and still showing the court-
order notice above). That review found the original encoding scheduled
every dose at its MINIMUM age (Table 2) rather than its RECOMMENDED age
(Table 1), and had no hard maximum ages. Revision 2026-10-07:
  - Due dates are now anchored on the Table 1 recommended age (or the
    recommended interval after a previous dose), never earlier than the
    Table 2 minimum age/interval. Minimum ages alone are only for travel/
    outbreak situations (Notes, Poliovirus: "In the first 6 months of
    life, use minimum ages and intervals only for travel to a polio-
    endemic region or during an outbreak.").
  - Hard age limits ("age window closed") per Notes/Table 1/Table 2:
    rotavirus (dose 1 not on/after 15 weeks 0 days; no dose after
    8 months 0 days), DTaP (under 7 years only), Hib and PCV (healthy
    children: not needed from age 5 years).
  - MenACWY: infant/child doses are high-risk only (Table 1 purple), so
    the routine series is anchored at 11-12 years; dose 2 is skipped if
    dose 1 was given at 16 years or older (Notes: "Age 16-18 years:
    1 dose").

SCOPE: see reference-data/README.md for exactly which vaccines/doses are
modeled with full dose-by-dose logic vs. listed for reference only.

NOT MEDICAL ADVICE: this encodes a published schedule for display. A
child's pediatrician decides what that child actually needs.
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


def add_calendar_months(start: date, n: int) -> date:
    """`start` plus n calendar months, clamped to the last day of a short
    month (Jan 31 + 1 month -> Feb 28/29). Used for hard age limits, where
    an off-by-one-day approximation could show a dose as allowed on a day
    CDC says it is not.
    """
    month_index = start.month - 1 + n
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    next_month_first = date(year + month // 12, month % 12 + 1, 1)
    last_day = (next_month_first - timedelta(days=1)).day
    return date(year, month, min(start.day, last_day))


@dataclass(frozen=True)
class AgeLimit:
    """A hard age limit, as the FIRST age at which the dose should no
    longer be given: date of birth + `months` calendar months + `days`.
    E.g. "maximum age 14 weeks, 6 days" -> AgeLimit(days=105) (15 weeks,
    0 days is the first day it's closed); "maximum age 8 months, 0 days"
    -> AgeLimit(months=8, days=1); "under 7 years" -> AgeLimit(months=84).
    """

    months: int = 0
    days: int = 0

    def closes_on(self, date_of_birth: date) -> date:
        return add_calendar_months(date_of_birth, self.months) + timedelta(days=self.days)


@dataclass(frozen=True)
class Dose:
    """One dose within a VaccineSeries.

    All *_days fields are counted from the child's date of birth unless
    otherwise noted (*_interval_from_previous_days and *_since_dose1 are
    counted from a previously administered dose of the SAME vaccine).

    The due date is the LATEST of: the recommended age (Table 1), the
    recommended interval after the previous dose, the minimum age, and the
    minimum intervals (Table 2) -- so a dose is never scheduled at its
    bare minimum age when a later recommended age applies.
    """

    dose_number: int
    recommended_age_label: str
    recommended_age_min_days: int | None
    recommended_age_max_days: int | None
    minimum_age_days: int | None = None
    minimum_interval_from_previous_days: int | None = None
    minimum_days_since_dose1: int | None = None
    recommended_interval_from_previous_days: int | None = None
    recommended_days_since_dose1: int | None = None
    skip_if_previous_dose_age_days_gte: int | None = None
    # Hard limit: from this age on the dose is no longer recommended (for
    # a healthy child), so it must not be shown as due or overdue.
    age_window_closes: AgeLimit | None = None
    # Parent-facing explanation of age_window_closes, shown in the app.
    age_window_note: str = ""
    # Developer/source note (not shown to parents).
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
#
# Hard age limits (Notes, Rotavirus, catch-up: "Do not start the series on
# or after age 15 weeks, 0 days. The maximum age for the final dose is
# 8 months, 0 days."; Table 2: "Maximum age for first dose is 14 weeks,
# 6 days" / "Maximum age for final dose is 8 months, 0 days"):
#   - dose 1 closes at 15 weeks, 0 days (105 days);
#   - doses 2 and 3 close after 8 months, 0 days. CDC's text names the
#     FINAL dose; it is applied to dose 2 as well because a dose 2 given
#     after 8 months could never be followed by a valid final dose, and
#     Table 1 shades rotavirus gray (not applicable) from 9 months on.
# ---------------------------------------------------------------------------
_RV_LATE_DOSE_NOTE = "Rotavirus doses are only given up to 8 months of age."

ROTAVIRUS = VaccineSeries(
    "rotavirus",
    "Rotavirus (RV)",
    doses=(
        Dose(
            1, "2 months", months(2), months(2),
            minimum_age_days=weeks(6),
            age_window_closes=AgeLimit(days=weeks(15)),
            age_window_note="Rotavirus dose 1 is only given before 15 weeks of age (by 14 weeks, 6 days).",
            note="Max age for dose 1: 14 weeks, 6 days.",
        ),
        Dose(
            2, "4 months", months(4), months(4),
            minimum_interval_from_previous_days=weeks(4),
            age_window_closes=AgeLimit(months=8, days=1),
            age_window_note=_RV_LATE_DOSE_NOTE,
        ),
        Dose(
            3, "6 months", months(6), months(6),
            minimum_interval_from_previous_days=weeks(4),
            age_window_closes=AgeLimit(months=8, days=1),
            age_window_note=_RV_LATE_DOSE_NOTE,
            note="Max age for final dose: 8 months, 0 days. (RV5/RotaTeq only; RV1/Rotarix is a 2-dose series.)",
        ),
    ),
)

# ---------------------------------------------------------------------------
# Diphtheria, tetanus, acellular pertussis (DTaP: <7 yrs)
# Source: Table 1 row "DTaP"; Table 2 row "Diphtheria, tetanus, and
# acellular pertussis".
# Age limit: DTaP is "<7 yrs" (Table 1 row label; gray from 7-10 yrs). From
# age 7, catch-up uses Tdap/Td (Table 2, 7-18 yrs; Notes, Tdap) -- that
# Td/Tdap catch-up series is NOT modeled, so a closed DTaP dose tells the
# parent to ask their pediatrician instead.
# ---------------------------------------------------------------------------
_DTAP_CLOSES = AgeLimit(months=84)
_DTAP_NOTE = "DTaP is given before age 7; older children catch up with Tdap/Td instead."

DTAP = VaccineSeries(
    "dtap",
    "Diphtheria, Tetanus, Acellular Pertussis (DTaP)",
    doses=(
        Dose(
            1, "2 months", months(2), months(2), minimum_age_days=weeks(6),
            age_window_closes=_DTAP_CLOSES, age_window_note=_DTAP_NOTE,
        ),
        Dose(
            2, "4 months", months(4), months(4), minimum_interval_from_previous_days=weeks(4),
            age_window_closes=_DTAP_CLOSES, age_window_note=_DTAP_NOTE,
        ),
        Dose(
            3, "6 months", months(6), months(6), minimum_interval_from_previous_days=weeks(4),
            age_window_closes=_DTAP_CLOSES, age_window_note=_DTAP_NOTE,
        ),
        Dose(
            4, "15-18 months", months(15), months(18),
            minimum_age_days=months(12),
            minimum_interval_from_previous_days=months(6),
            age_window_closes=_DTAP_CLOSES, age_window_note=_DTAP_NOTE,
            note="Notes: dose 4 may be given as early as 12 months if >=6 months after dose 3.",
        ),
        Dose(
            5, "4-6 years", years(4), years(6),
            minimum_interval_from_previous_days=months(6),
            age_window_closes=_DTAP_CLOSES, age_window_note=_DTAP_NOTE,
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
# Age limit (healthy children): Notes, Hib catch-up: "Previously
# unvaccinated children age 60 months or older who are not considered high
# risk: Catch-up vaccination not required"; Table 2: final doses are for
# "age 12 through 59 months"; Table 1 shades Hib as catch-up (green)
# through the 4-year column and high-risk only (purple) from 5 years.
# ---------------------------------------------------------------------------
_HIB_PCV_CLOSES = AgeLimit(months=60)
_HIB_NOTE = "Hib is usually not needed for healthy children aged 5 and older."

HIB = VaccineSeries(
    "hib",
    "Haemophilus influenzae type b (Hib)",
    doses=(
        Dose(
            1, "2 months", months(2), months(2), minimum_age_days=weeks(6),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_HIB_NOTE,
        ),
        Dose(
            2, "4 months", months(4), months(4),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(15),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_HIB_NOTE,
            note="No further doses needed if dose 1 was given at age >=15 months.",
        ),
        Dose(
            3, "6 months", months(6), months(6),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(15),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_HIB_NOTE,
            note="No further doses needed if dose 2 was given at age >=15 months.",
        ),
        Dose(
            4, "12-15 months", months(12), months(15),
            minimum_interval_from_previous_days=weeks(8),
            skip_if_previous_dose_age_days_gte=months(15),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_HIB_NOTE,
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
# Age limit (healthy children): Notes, PCV catch-up: "Healthy children ages
# 2-4 years with any incomplete PCV series: 1 dose PCV"; Table 2: dose 4
# "only necessary for children age 12 through 59 months regardless of
# risk, or age 60 through 71 months with any risk"; Table 1 shades PCV as
# catch-up (green) through the 4-year column and high-risk only (purple)
# from 5 years. Risk conditions are not modeled (README simplification 7).
# ---------------------------------------------------------------------------
_PCV_NOTE = "PCV is usually not needed for healthy children aged 5 and older."

PCV = VaccineSeries(
    "pcv",
    "Pneumococcal Conjugate (PCV15/PCV20)",
    doses=(
        Dose(
            1, "2 months", months(2), months(2), minimum_age_days=weeks(6),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_PCV_NOTE,
        ),
        Dose(
            2, "4 months", months(4), months(4),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(24),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_PCV_NOTE,
            note="No further doses needed for healthy children if dose 1 was given at age >=24 months.",
        ),
        Dose(
            3, "6 months", months(6), months(6),
            minimum_interval_from_previous_days=weeks(4),
            skip_if_previous_dose_age_days_gte=months(24),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_PCV_NOTE,
            note="No further doses needed for healthy children if dose 2 was given at age >=24 months.",
        ),
        Dose(
            4, "12-15 months", months(12), months(15),
            minimum_interval_from_previous_days=weeks(8),
            skip_if_previous_dose_age_days_gte=months(24),
            age_window_closes=_HIB_PCV_CLOSES, age_window_note=_PCV_NOTE,
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
            2, "6-18 months after dose 1", None, None,
            minimum_interval_from_previous_days=months(6),
            recommended_interval_from_previous_days=months(6),
            note="Notes: 2-dose series at 12-23 months, minimum interval 6 months.",
        ),
    ),
)

# ---------------------------------------------------------------------------
# Meningococcal ACWY (MenACWY) -- routine healthy-adolescent 2-dose series
# only. Additional infant/toddler and high-risk dosing (Table 3, medical
# indications) is NOT modeled -- see README.md simplification #4.
# Source: Table 1 row "Meningococcal"; Table 2 row "Meningococcal ACWY";
# Notes, MenACWY: "Routine vaccination 2-dose series at age 11-12 years;
# 16 years"; catch-up "Age 13-15 years: 1 dose now and booster at age
# 16-18 years (minimum interval: 8 weeks) / Age 16-18 years: 1 dose".
# Table 1 shades MenACWY purple (high-risk groups only) from 2 months
# through 7-10 years, so nothing is scheduled before 11 years: the due
# date is the recommended age, not the 2-month product minimum age.
# ---------------------------------------------------------------------------
MENACWY = VaccineSeries(
    "menacwy",
    "Meningococcal ACWY (MenACWY)",
    doses=(
        Dose(
            1, "11-12 years", years(11), years(12),
            minimum_age_days=months(2),
            note=(
                "Minimum age 2 months applies to MenACWY-CRM (Menveo), "
                "and only for high-risk infants; MenACWY-TT (MenQuadfi) "
                "has minimum age 2 years. Routine dose 1 is at 11-12 years."
            ),
        ),
        Dose(
            2, "16 years", years(16), years(16),
            minimum_interval_from_previous_days=weeks(8),
            skip_if_previous_dose_age_days_gte=years(16),
            note="Not needed if dose 1 was given at age 16 or older (Notes: 'Age 16-18 years: 1 dose').",
        ),
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
            2, "6-12 months after dose 1", None, None,
            minimum_interval_from_previous_days=months(5),
            recommended_interval_from_previous_days=months(6),
            note="Notes: 2-dose series at 0, 6-12 months (minimum interval: 5 months).",
        ),
    ),
)

HPV_3DOSE = VaccineSeries(
    "hpv_3dose",
    "Human Papillomavirus (HPV), 3-dose series (start age >=15 years, or immunocompromised)",
    doses=(
        Dose(1, "15 years or older at first dose", years(15), None, minimum_age_days=years(9)),
        Dose(
            2, "1-2 months after dose 1", None, None,
            minimum_interval_from_previous_days=weeks(4),
            recommended_interval_from_previous_days=months(1),
        ),
        Dose(
            3, "6 months after dose 1", None, None,
            minimum_interval_from_previous_days=weeks(12),
            minimum_days_since_dose1=months(5),
            recommended_days_since_dose1=months(6),
            note="Min interval dose2->3: 12 weeks AND >=5 months after dose 1 (whichever is later).",
        ),
    ),
)


# ---------------------------------------------------------------------------
# Schedule metadata -- self-describing so a future version of the schedule
# can be swapped in without guessing what this one represents. Keep these
# in sync with the module docstring's "IMPORTANT VERSION NOTE" above.
# ---------------------------------------------------------------------------
# effective_date is the CDC schedule's own date and is unchanged by the
# 2026-10-07 revision (same schedule, corrected encoding). source_version
# changed so rows generated by the old encoding can be detected and
# regenerated (see app/services/timeline.py).
effective_date = date(2025, 7, 2)
encoding_revision = date(2026, 10, 7)
source_version = (
    "CDC 2025-07-02, pre-2025-ACIP-changes, per AAP v. Kennedy injunction; "
    "NestPath encoding rev 2026-10-07 (recommended ages, age windows)"
)

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
    # "complete" | "not_required" | "due_now" | "upcoming" | "age_window_closed"
    status: str
    # The date the dose is due: recommended age/interval, never before the
    # minimum age/interval. (Name kept for compatibility.)
    earliest_valid_date: date | None
    notes: str
    # First date the dose should no longer be given, if it has a hard limit.
    window_closes_on: date | None = None
    age_window_note: str = ""


AGE_WINDOW_CLOSED = "age_window_closed"


def _dose_for(vaccine_id: str, dose_number: int | None) -> Dose | None:
    """The Dose for a stored (vaccine_id, dose_number). "hpv" items have no
    hard age limits in this schedule, so they resolve to None here."""
    series = VACCINE_SCHEDULE.get(vaccine_id)
    if series is None or dose_number is None or not 1 <= dose_number <= len(series.doses):
        return None
    return series.doses[dose_number - 1]


def age_window(vaccine_id: str, dose_number: int | None, date_of_birth: date) -> tuple[date | None, str]:
    """(first date the dose should no longer be given, parent-facing note)
    for a dose, or (None, "") if it has no hard age limit."""
    dose = _dose_for(vaccine_id, dose_number)
    if dose is None or dose.age_window_closes is None:
        return None, ""
    return dose.age_window_closes.closes_on(date_of_birth), dose.age_window_note


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
    doses already administered for that vaccine, return the next dose and
    the date it is due: its recommended age (Table 1) or recommended
    interval after the previous dose, never earlier than the minimum age
    and minimum intervals (Table 2), including missed/delayed doses -- a
    vaccine series never restarts, per CDC: "A vaccine series does not
    need to be restarted, regardless of the time that has elapsed between
    doses."

    If the dose has a hard age limit and the child has reached it (or the
    dose couldn't be due until after it), the status is
    "age_window_closed": the dose is no longer recommended at this age
    and must not be presented as due or overdue.
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
    # Recommended timing (Table 1 / Notes).
    if dose.recommended_age_min_days is not None:
        candidates.append(date_of_birth + timedelta(days=dose.recommended_age_min_days))
    # Minimum age / intervals (Table 2): the due date never precedes these.
    if dose.minimum_age_days is not None:
        candidates.append(date_of_birth + timedelta(days=dose.minimum_age_days))
    if dose_history:
        interval = _effective_interval(vaccine_id, dose, dose_history, date_of_birth)
        if interval is not None:
            candidates.append(dose_history[-1] + timedelta(days=interval))
        if dose.minimum_days_since_dose1 is not None:
            candidates.append(dose_history[0] + timedelta(days=dose.minimum_days_since_dose1))
        if dose.recommended_interval_from_previous_days is not None:
            candidates.append(dose_history[-1] + timedelta(days=dose.recommended_interval_from_previous_days))
        if dose.recommended_days_since_dose1 is not None:
            candidates.append(dose_history[0] + timedelta(days=dose.recommended_days_since_dose1))
    if not candidates:
        candidates.append(date_of_birth)

    due = max(candidates)
    status = "due_now" if due <= today else "upcoming"

    window_closes_on, window_note = age_window(vaccine_id, dose.dose_number, date_of_birth)
    if window_closes_on is not None and (today >= window_closes_on or due >= window_closes_on):
        status = AGE_WINDOW_CLOSED

    return DoseResult(
        vaccine_id, dose.dose_number, status, due, dose.note,
        window_closes_on=window_closes_on, age_window_note=window_note,
    )


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
