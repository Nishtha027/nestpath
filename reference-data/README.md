# reference-data — Phase 0 (Research)

Structured reference data only. **No database, API, or frontend
connections.** Everything here is meant to be reviewed for accuracy before
any later phase depends on it.

All data was retrieved and transcribed on **2026-09-18**. Both CDC and
WHO revise these documents; re-verify against the live sources below
before this data feeds any user-facing feature, and periodically after
that (see "Currency" below).

## Files

- [`vaccine_schedule.py`](vaccine_schedule.py) — CDC child/adolescent
  immunization schedule (US), ages 0–18, plus a catch-up dose-calculation
  function.
- [`growth_percentile.py`](growth_percentile.py) — WHO Child Growth
  Standards LMS method for weight-for-age, ages 0–24 months, both sexes.

## Sources (exact document, page, and access date)

### Vaccine schedule

All three pages are dated **"Addendum updated July 2, 2025"** and were
retrieved **2026-09-18**:

| Table used | URL |
|---|---|
| Table 1 — recommended age by dose | https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html |
| Table 2 — minimum age / minimum interval (catch-up) | https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html |
| Notes — per-vaccine minimum-age callouts, HPV interval rule | https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html |

**Important currency note:** at the time of retrieval, each of these
pages displayed the following notice, which is reproduced verbatim
because it materially affects what "the current CDC schedule" means
right now:

> "Pursuant to the preliminary order issued on March 16, 2026, in
> American Academy of Pediatrics et al. v. Kennedy et al., No.
> 1:25-cv-11916 (D. Mass.), which stayed all votes taken by the ACIP
> during its June, September and December 2025 meetings, and further
> stayed the Acting CDC Director's January 5, 2026 Decision Memo
> revising the CDC's childhood immunization schedule, the July 2, 2025
> immunization schedule posted here is the current CDC Child and
> Adolescent Immunization Schedule by Age for Healthcare Professionals."

In plain terms: the July 2, 2025 schedule encoded in `vaccine_schedule.py`
is, as of the retrieval date, the version in legal/clinical effect — but
this is an actively litigated area and could change. **Do not treat this
file as self-updating; re-check the URLs above before relying on it
beyond Phase 0 review.**

### Growth percentiles (weight-for-age)

- **Method:** WHO Multicentre Growth Reference Study Group. *WHO Child
  Growth Standards: Length/height-for-age, weight-for-age,
  weight-for-length, weight-for-height and body mass index-for-age:
  Methods and development.* Geneva: World Health Organization, 2006,
  Chapter 5 ("Construction of the standards") — defines the LMS
  transformation used in `growth_percentile.py`.
- **Numeric data (the actual L, M, S values transcribed into the
  table):** CDC National Center for Health Statistics, "WHO Growth
  Charts Data Files," retrieved 2026-09-18:
  - Boys: https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Boys-Weight-for-age-Percentiles.csv
  - Girls: https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Girls-Weight-for-age%20Percentiles.csv
  - Index page: https://www.cdc.gov/growthcharts/who-data-files.htm

  These CDC files are CDC's official mirror/reformatting of the WHO 2006
  standard, not an independent computation — CDC and AAP jointly
  recommend using the WHO (not CDC 1977/2000) growth standards for
  children under age 2 in the US. See also the WHO's own indicator page:
  https://www.who.int/tools/child-growth-standards/standards/weight-for-age
- **Plausibility-flag threshold** (WAZ outside [-6, +5] flagged as
  biologically implausible): standard WHO/UNICEF nutrition-survey data
  quality convention, as documented in WHO Anthro/AnthroPlus software
  guidance.

Every table and rule also has its source cited again as a code comment
directly above it in the `.py` files — the README is a summary, not the
sole citation.

## Scope

- **Vaccine schedule:** United States, CDC/ACIP schedule only. Ages
  birth through 18 years.
- **Growth percentiles:** WHO Child Growth Standards, **weight-for-age
  only**, ages 0–24 months (completed months), both sexes. The full LMS
  table (25 rows × 2 sexes, months 0–24) is included in full — nothing
  is truncated for length.

## Intentionally left out / simplifications (Phase 0)

These are deliberate scoping decisions for this phase, not oversights.
Each is also flagged as a code comment at the relevant spot.

**Vaccine schedule:**

1. **Month/year day-counts are approximations**, not true calendar-month
   arithmetic. CDC's own rule is "intervals ≥4 months are determined by
   calendar months" (real, variable-length calendar months), but this
   module uses fixed conversions (1 month = 365.25/12 days, 1 year =
   365.25 days) for simplicity. This is accurate to within ~1 day in
   most cases but is not calendar-exact. Before this feeds a real
   scheduling UI, replace the `weeks()/months()/years()` helpers in
   `vaccine_schedule.py` with real calendar-date arithmetic (e.g.
   `dateutil.relativedelta`).
2. **Rotavirus** is modeled as the 3-dose RV5 (RotaTeq) series only. The
   alternative RV1 (Rotarix) 2-dose series (doses at 2, 4 months) is not
   separately modeled. To add it, create a second `VaccineSeries` the
   same way `HPV_2DOSE`/`HPV_3DOSE` are split.
3. **Hib** catch-up branching by vaccine brand (PRP-T-containing products
   vs. PRP-OMP/PedvaxHIB, which uses a 2-dose primary series) is not
   modeled — only the standard 4-dose (2, 4, 6, 12–15 month) timing with
   generalized age-based "no further doses needed" exceptions. Full
   brand-specific logic is in CDC Table 2 and would need to be added as
   additional `VaccineSeries`/branch logic if the app needs to track
   product brand.
4. **MenACWY** models only the routine healthy-adolescent 2-dose series
   (11–12 years, 16 years). Additional infant/toddler dosing and
   high-risk-condition dosing (CDC "Table 3 — By Medical Indication") are
   out of scope.
5. **Not modeled at all** (listed only as reference data in
   `OTHER_IMMUNIZATIONS`, with no dose/interval catch-up logic): RSV
   monoclonal antibody (single dose/season, not a fixed series), RSV
   maternal vaccine (not pediatric), Influenza (annual, reformulated
   yearly), COVID-19 (product- and risk-specific), Meningococcal B
   (shared clinical decision-making), Dengue (narrow risk-group
   indication), Mpox (adult only in routine use). These don't fit the
   "fixed dose count + minimum interval" shape the catch-up function
   assumes.
6. **Retroactive dose-validity checking is not implemented.** CDC states
   doses given ≥5 days before the minimum age/interval should not be
   counted as valid. `next_valid_dose()` assumes every date in the
   supplied history was itself a valid dose and only looks *forward*
   from it — it does not audit history for early/invalid doses.
7. CDC's medical/risk-condition indications (Table 3) are entirely out of
   scope; only the routine (healthy-child) schedule is modeled.

**Growth percentiles:**

1. **Only weight-for-age is included.** Length/height-for-age,
   weight-for-length/height, head circumference, and BMI-for-age are not
   included in this phase.
2. **Only ages 0–24 months.** WHO's weight-for-age standard actually
   extends to 5 years (60 months); this phase stops at 24 months to match
   the vaccine-schedule's early-childhood focus. **To extend:** download
   the same CDC-hosted CSVs' full 0–60-month range (or the WHO source
   tables directly from
   https://www.who.int/tools/child-growth-standards/standards/weight-for-age),
   and append rows 25–60 to `LMS_WEIGHT_FOR_AGE_BOYS`/`_GIRLS` in the same
   `{month: (L, M, S)}` format.
3. **Only whole completed months are supported** (`age_months` must be an
   int 0–24). WHO's own software (WHO Anthro) uses day-precision LMS
   tables rather than interpolating between monthly values, and this
   module does not attempt to replicate that with its own interpolation
   (which could silently produce numbers that don't match the official
   WHO output). **To extend:** obtain WHO's day-based LMS tables (a much
   larger dataset — 1 row per day of age rather than 1 per month) and add
   a day-level lookup path alongside the current month-level one, rather
   than interpolating the existing monthly table.
4. Only the weight-for-age plausibility flag (WAZ outside [-6, +5]) is
   implemented; WHO's additional flag conventions for other indicators
   (e.g., BMI-for-age, weight-for-length) are out of scope since those
   indicators aren't included here.

## Not covered at all (future phases)

- Any country's schedule other than the US CDC/ACIP schedule.
- Any growth indicator other than WHO weight-for-age 0–24 months.
- Ages beyond what's listed above (vaccine schedule 0–18y is complete per
  scope; growth data stops at 24 months).
- Any persistence, API, or UI — this phase is pure reference data.
