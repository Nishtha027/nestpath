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

    # Birth date far enough in the past that DTaP dose 1 (recommended at
    # 2 months) is long overdue.
    birth_date = date.today() - timedelta(days=200)

    resp = client.post("/children", json={"birth_date": birth_date.isoformat()}, headers=headers)
    assert resp.status_code == 201
    child_id = resp.json()["id"]

    schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    dtap_dose1 = next(item for item in schedule if item["vaccine_id"] == "dtap")
    assert dtap_dose1["dose_number"] == 1
    assert dtap_dose1["status"] == "due_now"

    # Simulate a missed/delayed dose: given long after its due date, late
    # enough that dose 1 + the 4-week minimum interval falls after dose 2's
    # 4-month recommended age -- so the delay is what sets dose 2's date.
    original_due_date = date.fromisoformat(dtap_dose1["due_date"])
    late_administered_date = birth_date + timedelta(days=110)
    assert late_administered_date > original_due_date
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


def test_schedule_order_is_stable_when_due_dates_tie(client, auth_headers):
    headers, _ = auth_headers()
    # A 90-day-old has several vaccines due on the same day, so ordering by
    # due_date alone would leave those rows in arbitrary order.
    birth_date = date.today() - timedelta(days=90)
    child_id = client.post(
        "/children", json={"birth_date": birth_date.isoformat()}, headers=headers
    ).json()["id"]

    schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()

    keys = [(item["due_date"], item["vaccine_id"], item["dose_number"]) for item in schedule]
    assert keys == sorted(keys)
    assert len({key[0] for key in keys}) < len(keys)  # the test really does exercise ties


def test_mark_given_rejects_future_date_and_leaves_dose_pending(client, auth_headers):
    headers, _ = auth_headers()
    birth_date = date.today() - timedelta(days=90)
    child_id = client.post(
        "/children", json={"birth_date": birth_date.isoformat()}, headers=headers
    ).json()["id"]
    schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    dtap_dose1 = next(item for item in schedule if item["vaccine_id"] == "dtap")

    future = date.today() + timedelta(days=5)
    resp = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given",
        json={"administered_date": future.isoformat()},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "future" in resp.json()["detail"]

    after = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    assert [item["status"] for item in after] == [item["status"] for item in schedule]
    assert not any(item["status"] == "given" for item in after)


def _child_with_dtap_dose1(client, headers):
    birth_date = date.today() - timedelta(days=90)
    child_id = client.post(
        "/children", json={"birth_date": birth_date.isoformat()}, headers=headers
    ).json()["id"]
    schedule = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    return child_id, schedule, next(item for item in schedule if item["vaccine_id"] == "dtap")


def test_mark_not_given_restores_pending_dose_and_removes_follow_up(client, auth_headers):
    headers, _ = auth_headers()
    child_id, before, dtap_dose1 = _child_with_dtap_dose1(client, headers)

    given_on = date.fromisoformat(dtap_dose1["due_date"]) + timedelta(days=20)
    mark = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given",
        json={"administered_date": given_on.isoformat()},
        headers=headers,
    )
    assert mark.status_code == 200
    assert any(i["vaccine_id"] == "dtap" and i["dose_number"] == 2 for i in mark.json())

    undo = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-not-given", headers=headers
    )
    assert undo.status_code == 200, undo.text
    [restored] = undo.json()
    assert restored["id"] == dtap_dose1["id"]
    assert restored["administered_date"] is None
    assert restored["status"] == dtap_dose1["status"]
    assert restored["due_date"] == dtap_dose1["due_date"]

    # Back to exactly the schedule from before mark-given: the dose-2
    # follow-up is gone and nothing else changed.
    after = client.get(f"/children/{child_id}/schedule", headers=headers).json()
    key = lambda i: (i["id"], i["vaccine_id"], i["dose_number"], i["due_date"], i["status"])  # noqa: E731
    assert sorted(map(key, after)) == sorted(map(key, before))


def test_mark_not_given_rejects_a_dose_that_is_not_given(client, auth_headers):
    headers, _ = auth_headers()
    child_id, _, dtap_dose1 = _child_with_dtap_dose1(client, headers)

    resp = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-not-given", headers=headers
    )
    assert resp.status_code == 400


def test_mark_not_given_only_allows_the_latest_dose_of_a_vaccine(client, auth_headers):
    headers, _ = auth_headers()
    child_id, _, dtap_dose1 = _child_with_dtap_dose1(client, headers)

    # Dose 1 given a while back, then dose 2 given today.
    given_on = date.fromisoformat(dtap_dose1["due_date"]) + timedelta(days=1)
    created = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given",
        json={"administered_date": given_on.isoformat()},
        headers=headers,
    ).json()
    dtap_dose2 = next(i for i in created if i["vaccine_id"] == "dtap" and i["dose_number"] == 2)
    assert client.post(
        f"/children/{child_id}/schedule/{dtap_dose2['id']}/mark-given", json={}, headers=headers
    ).status_code == 200

    earlier = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-not-given", headers=headers
    )
    assert earlier.status_code == 409

    latest = client.post(
        f"/children/{child_id}/schedule/{dtap_dose2['id']}/mark-not-given", headers=headers
    )
    assert latest.status_code == 200
    dtap = [
        i
        for i in client.get(f"/children/{child_id}/schedule", headers=headers).json()
        if i["vaccine_id"] == "dtap"
    ]
    assert sorted((i["dose_number"], i["status"] == "given") for i in dtap) == [(1, True), (2, False)]


def test_mark_not_given_is_family_scoped(client, auth_headers):
    headers_a, _ = auth_headers(email="a@example.com")
    headers_b, _ = auth_headers(email="b@example.com")
    child_id, _, dtap_dose1 = _child_with_dtap_dose1(client, headers_a)
    client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-given", json={}, headers=headers_a
    )

    resp = client.post(
        f"/children/{child_id}/schedule/{dtap_dose1['id']}/mark-not-given", headers=headers_b
    )
    assert resp.status_code == 404

    schedule = client.get(f"/children/{child_id}/schedule", headers=headers_a).json()
    assert next(i for i in schedule if i["id"] == dtap_dose1["id"])["status"] == "given"


def test_remark_after_undo_still_rejects_future_date(client, auth_headers):
    headers, _ = auth_headers()
    child_id, _, dtap_dose1 = _child_with_dtap_dose1(client, headers)
    url = f"/children/{child_id}/schedule/{dtap_dose1['id']}"

    assert client.post(f"{url}/mark-given", json={}, headers=headers).status_code == 200
    assert client.post(f"{url}/mark-not-given", headers=headers).status_code == 200

    future = date.today() + timedelta(days=5)
    resp = client.post(
        f"{url}/mark-given", json={"administered_date": future.isoformat()}, headers=headers
    )
    assert resp.status_code == 400
    assert "future" in resp.json()["detail"]

    corrected = date.today() - timedelta(days=2)
    resp = client.post(
        f"{url}/mark-given", json={"administered_date": corrected.isoformat()}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()[0]["administered_date"] == corrected.isoformat()
