from datetime import date, timedelta

from vaccine_schedule import VACCINE_SCHEDULE, catch_up_plan, source_version


def test_creating_child_generates_real_schedule_for_newborn(client, auth_headers):
    headers, _ = auth_headers()
    today = date.today()

    resp = client.post("/children", json={"birth_date": today.isoformat()}, headers=headers)
    assert resp.status_code == 201
    child_id = resp.json()["id"]

    schedule_resp = client.get(f"/children/{child_id}/schedule", headers=headers)
    assert schedule_resp.status_code == 200
    items = schedule_resp.json()

    # One pending item per vaccine (12: every VACCINE_SCHEDULE entry
    # except the two internal HPV tracks, which collapse to one "hpv" key).
    expected_plan = catch_up_plan(today, {}, today)
    assert len(items) == len(expected_plan) == 12

    by_vaccine = {item["vaccine_id"]: item for item in items}
    assert set(by_vaccine) == set(expected_plan)

    for vaccine_id, result in expected_plan.items():
        item = by_vaccine[vaccine_id]
        assert item["dose_number"] == result.dose_number
        assert item["due_date"] == result.earliest_valid_date.isoformat()
        assert item["status"] == result.status
        assert item["source_version"] == source_version
        assert item["administered_date"] is None

    # Sorted by due date.
    due_dates = [item["due_date"] for item in items]
    assert due_dates == sorted(due_dates)

    # Spot-check one concrete vaccine: HepB dose 1 is due at birth.
    assert by_vaccine["hepb"]["due_date"] == today.isoformat()
    assert by_vaccine["hepb"]["dose_number"] == 1


def test_mark_given_late_dose_recalculates_next_due_date(client, auth_headers):
    headers, _ = auth_headers()

    # Birth date far enough in the past that DTaP dose 1 (min age 6 weeks)
    # is already due.
    birth_date = date.today() - timedelta(days=90)

    resp = client.post("/children", json={"birth_date": birth_date.isoformat()}, headers=headers)
    assert resp.status_code == 201
    child_id = resp.json()["id"]

    schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    dtap_dose1 = next(item for item in schedule if item["vaccine_id"] == "dtap")
    assert dtap_dose1["dose_number"] == 1
    assert dtap_dose1["status"] == "due_now"

    # Simulate a missed/delayed dose: given well after its earliest valid
    # date, but before today.
    original_due_date = date.fromisoformat(dtap_dose1["due_date"])
    late_administered_date = original_due_date + timedelta(days=20)
    assert late_administered_date <= date.today()

    mark_resp = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given",
        json={"administered_date": late_administered_date.isoformat()},
        headers=headers,
    )
    assert mark_resp.status_code == 200
    updated_items = mark_resp.json()

    updated_dose1 = next(item for item in updated_items if item["id"] == dtap_dose1["id"])
    assert updated_dose1["status"] == "given"
    assert updated_dose1["administered_date"] == late_administered_date.isoformat()

    new_dose2 = next(item for item in updated_items if item["vaccine_id"] == "dtap" and item["id"] != dtap_dose1["id"])
    assert new_dose2["dose_number"] == 2

    # The catch-up-correct due date for dose 2, computed independently
    # from vaccine_schedule.py using the REAL (late) administered date --
    # not the originally-estimated due date.
    dtap_dose2_min_interval = VACCINE_SCHEDULE["dtap"].doses[1].minimum_interval_from_previous_days
    expected_dose2_due = late_administered_date + timedelta(days=dtap_dose2_min_interval)
    assert new_dose2["due_date"] == expected_dose2_due.isoformat()

    # The delay actually pushed dose 2 later than a naive on-time
    # projection from the original (unmet) dose-1 due date would have.
    naive_dose2_due = original_due_date + timedelta(days=dtap_dose2_min_interval)
    assert expected_dose2_due > naive_dose2_due

    expected_dose2_status = "due_now" if expected_dose2_due <= date.today() else "upcoming"
    assert new_dose2["status"] == expected_dose2_status

    # Re-fetching the full schedule reflects both the given dose and the
    # newly-created next one.
    full_schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    dtap_items = [item for item in full_schedule if item["vaccine_id"] == "dtap"]
    assert len(dtap_items) == 2
    assert {item["status"] for item in dtap_items} == {"given", expected_dose2_status}


def test_mark_given_twice_rejected(client, auth_headers):
    headers, _ = auth_headers()
    birth_date = date.today() - timedelta(days=90)

    resp = client.post("/children", json={"birth_date": birth_date.isoformat()}, headers=headers)
    child_id = resp.json()["id"]
    schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    dtap_dose1 = next(item for item in schedule if item["vaccine_id"] == "dtap")

    first = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given",
        json={},
        headers=headers,
    )
    assert first.status_code == 200

    second = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given",
        json={},
        headers=headers,
    )
    assert second.status_code == 400
