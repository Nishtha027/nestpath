"""Recommended-age scheduling and hard age limits ("age window closed"),
per the CDC July 2, 2025 schedule re-verified 2026-10-07 (see the module
docstring of reference-data/vaccine_schedule.py for the exact sources)."""

from datetime import date, timedelta
from uuid import UUID

from vaccine_schedule import (
    AGE_WINDOW_CLOSED,
    add_calendar_months,
    catch_up_plan,
    months,
    next_valid_dose,
    next_valid_hpv_dose,
    source_version,
    weeks,
    years,
)

from app.models import Child, ScheduleItem

TODAY = date(2026, 10, 7)
PENDING = ("due_now", "upcoming")


def born_days_ago(days: int) -> date:
    return TODAY - timedelta(days=days)


def born_months_ago(n: int) -> date:
    return add_calendar_months(TODAY, -n)


# --- Rotavirus ---------------------------------------------------------------

def test_six_month_old_gets_no_rotavirus_dose_1_as_due_or_overdue():
    plan = catch_up_plan(born_months_ago(6), {}, TODAY)
    assert plan["rotavirus"].dose_number == 1
    assert plan["rotavirus"].status == AGE_WINDOW_CLOSED
    assert plan["rotavirus"].age_window_note


def test_rotavirus_dose_1_allowed_through_14_weeks_6_days_and_closed_at_15_weeks():
    last_day = next_valid_dose("rotavirus", born_days_ago(weeks(14) + 6), [], TODAY)
    assert last_day.status == "due_now"
    first_closed = next_valid_dose("rotavirus", born_days_ago(weeks(15)), [], TODAY)
    assert first_closed.status == AGE_WINDOW_CLOSED


def test_rotavirus_final_dose_allowed_at_8_months_0_days_and_closed_after():
    for age, expected in ((0, "due_now"), (1, AGE_WINDOW_CLOSED)):
        dob = add_calendar_months(TODAY, -8) - timedelta(days=age)
        history = [dob + timedelta(days=months(2)), dob + timedelta(days=months(4))]
        result = next_valid_dose("rotavirus", dob, history, TODAY)
        assert result.dose_number == 3
        assert result.status == expected, (age, result)


def test_rotavirus_dose_that_could_only_fall_after_8_months_is_closed():
    # Dose 1 at 14 weeks, dose 2 not given; child is 7 months 20 days old.
    # Dose 2 is due now, before the 8-month limit.
    dob = add_calendar_months(TODAY, -7) - timedelta(days=20)
    result = next_valid_dose("rotavirus", dob, [dob + timedelta(days=weeks(14))], TODAY)
    assert result.dose_number == 2
    assert result.status == "due_now"
    # But if dose 2 only becomes valid after 8 months, 0 days, it's closed
    # even though the child hasn't reached that age yet.
    dob = add_calendar_months(TODAY, -7) - timedelta(days=20)
    late_dose1 = TODAY  # minimum interval pushes dose 2 past the limit
    result = next_valid_dose("rotavirus", dob, [late_dose1], TODAY)
    assert result.status == AGE_WINDOW_CLOSED


# --- MenACWY -----------------------------------------------------------------

def test_menacwy_not_scheduled_before_routine_age_for_child_without_risk_factors():
    for dob in (TODAY, born_months_ago(2), born_months_ago(6), born_months_ago(12 * 10)):
        result = catch_up_plan(dob, {}, TODAY)["menacwy"]
        assert result.dose_number == 1
        assert result.earliest_valid_date >= dob + timedelta(days=years(11)), dob
        assert result.status == "upcoming"


def test_menacwy_overdue_for_unvaccinated_13_year_old():
    result = catch_up_plan(born_months_ago(13 * 12), {}, TODAY)["menacwy"]
    assert result.status == "due_now"


def test_menacwy_dose_2_not_needed_when_dose_1_given_at_16_or_older():
    dob = born_months_ago(17 * 12)
    at_16 = add_calendar_months(dob, 16 * 12)
    assert next_valid_dose("menacwy", dob, [at_16], TODAY).status == "not_required"
    at_13 = add_calendar_months(dob, 13 * 12)
    assert next_valid_dose("menacwy", dob, [at_13], TODAY).status in PENDING


# --- Recommended ages instead of minimum ages ----------------------------------

def test_infant_doses_due_at_recommended_age_not_minimum_age():
    dob = TODAY
    plan = catch_up_plan(dob, {}, TODAY)
    for vaccine_id in ("rotavirus", "dtap", "hib", "pcv", "ipv"):
        # Recommended 2 months, not the 6-week minimum age.
        assert plan[vaccine_id].earliest_valid_date == dob + timedelta(days=months(2)), vaccine_id
    assert plan["tdap"].earliest_valid_date == dob + timedelta(days=years(11))  # not 7 years
    assert plan["hpv"].earliest_valid_date == dob + timedelta(days=years(11))  # not 9 years


def test_on_time_dose_2_follows_recommended_age_not_minimum_interval():
    dob = born_months_ago(3)
    dose1 = dob + timedelta(days=months(2))
    result = next_valid_dose("dtap", dob, [dose1], TODAY)
    assert result.earliest_valid_date == dob + timedelta(days=months(4))  # not dose1 + 4 weeks


def test_hpv_dose_2_due_6_months_after_dose_1():
    dob = born_months_ago(10 * 12)
    dose1 = add_calendar_months(dob, 9 * 12)
    result = next_valid_hpv_dose(dob, [dose1], TODAY)
    assert result.earliest_valid_date == dose1 + timedelta(days=months(6))


# --- DTaP, Hib, PCV age limits -------------------------------------------------

def test_dtap_closed_from_7th_birthday():
    assert catch_up_plan(add_calendar_months(TODAY, -84) + timedelta(days=1), {}, TODAY)["dtap"].status == "due_now"
    assert catch_up_plan(born_months_ago(84), {}, TODAY)["dtap"].status == AGE_WINDOW_CLOSED


def test_hib_and_pcv_closed_from_5th_birthday_for_healthy_child():
    almost_5 = add_calendar_months(TODAY, -60) + timedelta(days=1)
    five = born_months_ago(60)
    for vaccine_id in ("hib", "pcv"):
        assert catch_up_plan(almost_5, {}, TODAY)[vaccine_id].status == "due_now", vaccine_id
        assert catch_up_plan(five, {}, TODAY)[vaccine_id].status == AGE_WINDOW_CLOSED, vaccine_id


def test_vaccines_without_hard_limits_stay_due_for_older_children():
    plan = catch_up_plan(born_months_ago(15 * 12), {}, TODAY)
    for vaccine_id in ("hepb", "ipv", "mmr", "varicella", "hepa"):
        assert plan[vaccine_id].status == "due_now", vaccine_id
        assert plan[vaccine_id].window_closes_on is None


def test_add_calendar_months_clamps_to_month_end():
    assert add_calendar_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_calendar_months(date(2024, 2, 29), 12) == date(2025, 2, 28)
    assert add_calendar_months(date(2026, 12, 15), 1) == date(2027, 1, 15)


# --- API ---------------------------------------------------------------------

def _create_child(client, headers, birth_date):
    resp = client.post("/children", json={"birth_date": birth_date.isoformat()}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_api_six_month_old_rotavirus_is_age_window_closed_and_menacwy_at_11(client, auth_headers):
    headers, _ = auth_headers()
    birth_date = add_calendar_months(date.today(), -6)
    child_id = _create_child(client, headers, birth_date)
    by_vaccine = {
        i["vaccine_id"]: i for i in client.get(f"/children/{child_id}/schedule", headers=headers).json()
    }

    rotavirus = by_vaccine["rotavirus"]
    assert rotavirus["status"] == "age_window_closed"
    assert rotavirus["window_closes_on"] == (birth_date + timedelta(days=weeks(15))).isoformat()
    assert "15 weeks" in rotavirus["age_window_note"]

    menacwy = by_vaccine["menacwy"]
    assert date.fromisoformat(menacwy["due_date"]) >= birth_date + timedelta(days=years(11))
    assert menacwy["status"] == "upcoming"
    assert menacwy["age_window_note"] is None


def test_api_reports_window_closed_once_it_passes_even_if_row_said_due(client, auth_headers, db_session):
    """A row written while the window was open must not keep showing as
    due after the child ages past the limit."""
    headers, _ = auth_headers()
    birth_date = date.today() - timedelta(days=weeks(10))
    child_id = _create_child(client, headers, birth_date)
    item = next(
        i for i in client.get(f"/children/{child_id}/schedule", headers=headers).json()
        if i["vaccine_id"] == "rotavirus"
    )
    assert item["status"] in PENDING

    # Age the child past 15 weeks without touching the row.
    child = db_session.get(Child, UUID(child_id))
    child.birth_date = date.today() - timedelta(days=weeks(16))
    db_session.commit()

    item = next(
        i for i in client.get(f"/children/{child_id}/schedule", headers=headers).json()
        if i["vaccine_id"] == "rotavirus"
    )
    assert item["status"] == "age_window_closed"


def test_api_closed_dose_can_still_be_recorded_as_given_earlier(client, auth_headers):
    """A parent entering history for a 6-month-old: rotavirus dose 1 was
    given at 2 months, inside its window. Recording it re-opens the series
    with dose 2."""
    headers, _ = auth_headers()
    birth_date = add_calendar_months(date.today(), -6)
    child_id = _create_child(client, headers, birth_date)
    rotavirus = next(
        i for i in client.get(f"/children/{child_id}/schedule", headers=headers).json()
        if i["vaccine_id"] == "rotavirus"
    )
    resp = client.post(
        f"/children/{child_id}/schedule/{rotavirus['id']}/mark-given",
        json={"administered_date": (birth_date + timedelta(days=months(2))).isoformat()},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    dose2 = next(i for i in resp.json() if i["dose_number"] == 2)
    assert dose2["vaccine_id"] == "rotavirus"
    assert dose2["status"] == "due_now"


def test_api_regenerates_pending_rows_from_old_encoding(client, auth_headers, db_session):
    """Rows written before the 2026-10-07 revision (MenACWY due at 2 months)
    are replaced on the next schedule fetch; given doses are kept."""
    headers, _ = auth_headers()
    birth_date = add_calendar_months(date.today(), -6)
    child_id = _create_child(client, headers, birth_date)

    old_version = "CDC 2025-07-02, pre-2025-ACIP-changes, per AAP v. Kennedy injunction"
    menacwy = db_session.query(ScheduleItem).filter_by(vaccine_id="menacwy").one()
    menacwy.due_date = birth_date + timedelta(days=months(2))
    menacwy.status = "due_now"
    menacwy.source_version = old_version
    hepb = db_session.query(ScheduleItem).filter_by(vaccine_id="hepb").one()
    hepb.status = "given"
    hepb.administered_date = birth_date
    hepb.source_version = old_version
    db_session.commit()

    items = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    by_vaccine = {}
    for i in items:
        by_vaccine.setdefault(i["vaccine_id"], []).append(i)
    [menacwy_row] = by_vaccine["menacwy"]
    assert date.fromisoformat(menacwy_row["due_date"]) >= birth_date + timedelta(days=years(11))
    assert menacwy_row["source_version"] == source_version
    # The given HepB dose is untouched, and its follow-up dose was added.
    assert sorted((i["dose_number"], i["status"]) for i in by_vaccine["hepb"])[0] == (1, "given")
    assert any(i["dose_number"] == 2 for i in by_vaccine["hepb"])
    # Exactly one not-yet-given row per vaccine.
    for vaccine_id, rows in by_vaccine.items():
        assert sum(r["status"] != "given" for r in rows) <= 1, vaccine_id
