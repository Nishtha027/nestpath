from datetime import date, timedelta

from growth_percentile import weight_for_age_percentile


def test_creating_growth_measurement_matches_who_lms_calculation(client, auth_headers):
    headers, _ = auth_headers()

    birth_date = date.today() - timedelta(days=180)
    resp = client.post("/children", json={"birth_date": birth_date.isoformat()}, headers=headers)
    assert resp.status_code == 201
    child_id = resp.json()["id"]

    measured_at = date.today()
    weight_kg = 7.8
    sex = "female"

    growth_resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": measured_at.isoformat(), "sex": sex, "weight_kg": weight_kg},
        headers=headers,
    )
    assert growth_resp.status_code == 201
    body = growth_resp.json()

    # Hand-calculated straight from growth_percentile.py's LMS function --
    # not via our service layer -- to confirm the stored value is real.
    age_months = (measured_at.year - birth_date.year) * 12 + (measured_at.month - birth_date.month)
    if measured_at.day < birth_date.day:
        age_months -= 1
    expected = weight_for_age_percentile(age_months, sex, weight_kg)

    assert body["age_months"] == expected.age_months
    assert body["sex"] == expected.sex
    assert body["weight_kg"] == expected.weight_kg
    assert body["percentile"] == expected.percentile
    assert body["z_score"] == expected.z_score
    assert body["source_version"]

    list_resp = client.get(f"/children/{child_id}/growth", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["id"] == body["id"]


def test_growth_measurement_requires_auth(client):
    resp = client.post(
        "/children/00000000-0000-0000-0000-000000000000/growth",
        json={"measured_at": date.today().isoformat(), "sex": "male", "weight_kg": 5.0},
    )
    assert resp.status_code == 401
