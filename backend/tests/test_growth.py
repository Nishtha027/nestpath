from datetime import date, timedelta

from growth_percentile import (
    LMS_LENGTH_FOR_AGE_GIRLS,
    length_for_age_percentile,
    reference_curves,
    weight_for_age_percentile,
)


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


def test_growth_measurement_rejects_future_date(client, auth_headers):
    headers, _ = auth_headers()
    birth_date = date.today() - timedelta(days=60)
    child_id = client.post(
        "/children", json={"birth_date": birth_date.isoformat()}, headers=headers
    ).json()["id"]

    future = date.today() + timedelta(days=5)
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": future.isoformat(), "sex": "female", "weight_kg": 5.0},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "future" in resp.json()["detail"]
    assert client.get(f"/children/{child_id}/growth", headers=headers).json() == []


def test_growth_measurement_allows_one_day_of_timezone_slack(client, auth_headers):
    headers, _ = auth_headers()
    birth_date = date.today() - timedelta(days=60)
    child_id = client.post(
        "/children", json={"birth_date": birth_date.isoformat()}, headers=headers
    ).json()["id"]

    tomorrow = date.today() + timedelta(days=1)
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": tomorrow.isoformat(), "sex": "female", "weight_kg": 5.0},
        headers=headers,
    )
    assert resp.status_code == 201


def _child(client, headers, days_old=180):
    birth_date = date.today() - timedelta(days=days_old)
    resp = client.post("/children", json={"birth_date": birth_date.isoformat()}, headers=headers)
    return resp.json()["id"]


def test_length_for_age_median_is_the_50th_percentile():
    # Girls, 6 months: M = 65.7311 cm in WHO's table.
    result = length_for_age_percentile(6, "female", LMS_LENGTH_FOR_AGE_GIRLS[6][1])
    assert abs(result.z_score) < 1e-9
    assert abs(result.percentile - 50) < 1e-9
    # CDC's published 2nd (2.3rd) percentile value for girls at 6 months is
    # 61.1982833 cm, i.e. z = -2.
    assert abs(length_for_age_percentile(6, "female", 61.1982833).z_score + 2) < 1e-4


def test_reference_curves_match_the_who_median_and_are_ordered():
    rows = reference_curves("male", "weight")
    assert [r["month"] for r in rows] == list(range(25))
    assert rows[0]["p50"] == 3.346  # WHO boys' median birth weight, 3.3464 kg
    for r in rows:
        assert r["p3"] < r["p15"] < r["p50"] < r["p85"] < r["p97"]


def test_measurement_with_weight_and_length(client, auth_headers):
    headers, _ = auth_headers()
    child_id = _child(client, headers)
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": date.today().isoformat(), "sex": "female",
              "weight_kg": 7.3, "length_cm": 65.7},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    expected = length_for_age_percentile(body["age_months"], "female", 65.7)
    assert body["length_cm"] == 65.7
    assert body["length_percentile"] == expected.percentile
    assert body["length_z_score"] == expected.z_score
    assert body["percentile"] is not None


def test_measurement_with_length_only(client, auth_headers):
    headers, _ = auth_headers()
    child_id = _child(client, headers)
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": date.today().isoformat(), "sex": "male", "length_cm": 67.0},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["weight_kg"] is None and body["percentile"] is None
    assert body["length_percentile"] is not None


def test_measurement_needs_weight_or_length(client, auth_headers):
    headers, _ = auth_headers()
    child_id = _child(client, headers)
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": date.today().isoformat(), "sex": "male"},
        headers=headers,
    )
    assert resp.status_code == 422
    assert client.get(f"/children/{child_id}/growth", headers=headers).json() == []


def test_growth_reference_endpoint(client, auth_headers):
    assert client.get("/growth/reference?sex=female").status_code == 401
    headers, _ = auth_headers()
    resp = client.get("/growth/reference?sex=female", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["sex"] == "female"
    assert len(body["weight_kg"]) == 25 and len(body["length_cm"]) == 25
    assert body["length_cm"][6]["p50"] == round(LMS_LENGTH_FOR_AGE_GIRLS[6][1], 3)
    assert client.get("/growth/reference?sex=other", headers=headers).status_code == 422


def test_implausible_values_are_rejected(client, auth_headers):
    headers, _ = auth_headers()
    child_id = _child(client, headers)
    today = date.today().isoformat()
    for body, unit in [
        ({"weight_kg": 7300}, "kilograms"),  # grams typed into the kg box
        ({"weight_kg": 40}, "kilograms"),
        ({"length_cm": 26}, "centimetres"),  # inches typed into the cm box
        ({"weight_kg": 7.3, "length_cm": 150}, "centimetres"),
    ]:
        resp = client.post(
            f"/children/{child_id}/growth",
            json={"measured_at": today, "sex": "female", **body},
            headers=headers,
        )
        assert resp.status_code == 400, body
        assert unit in resp.json()["detail"]
    for body in ({"weight_kg": 0}, {"length_cm": -5}):
        resp = client.post(
            f"/children/{child_id}/growth",
            json={"measured_at": today, "sex": "female", **body},
            headers=headers,
        )
        assert resp.status_code == 400, body
    assert client.get(f"/children/{child_id}/growth", headers=headers).json() == []


def test_unrecognized_sex_is_rejected(client, auth_headers):
    headers, _ = auth_headers()
    child_id = _child(client, headers)
    resp = client.post(
        f"/children/{child_id}/growth",
        json={"measured_at": date.today().isoformat(), "sex": "other", "weight_kg": 7.0},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "sex" in resp.json()["detail"]


# Published values copied from CDC's WHO length-for-age data files (the
# "5th", "50th" and "95th" columns), the same files the LMS table came from:
#   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Boys-Length-for-age-Percentiles.csv
#   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/WHO-Girls-Length-for-age-Percentiles.csv
CDC_PUBLISHED_LENGTH_CM = {
    ("male", 0): (46.77032, 49.8842, 52.99808),
    ("male", 6): (64.10314, 67.6236, 71.14406),
    ("male", 12): (71.84023, 75.7488, 79.65737),
    ("male", 24): (82.79087, 87.8161, 92.84133),
    ("female", 0): (46.08383, 49.1477, 52.21157),
    ("female", 6): (62.00319, 65.7311, 69.45901),
    ("female", 12): (69.77953, 74.015, 78.25047),
    ("female", 24): (81.10777, 86.4153, 91.72283),
}


def test_length_curves_match_cdc_published_percentiles():
    from statistics import NormalDist

    from growth_percentile import value_at_z

    for (sex, month), published in CDC_PUBLISHED_LENGTH_CM.items():
        for percentile, expected in zip((5, 50, 95), published):
            got = value_at_z(month, sex, "length", NormalDist().inv_cdf(percentile / 100))
            assert abs(got - expected) < 0.00001, (sex, month, percentile, got, expected)
