from uuid import UUID

from epds_screening import score_epds

from app.models import Caregiver

# Every item answered at its least-concerning option -- see
# reference-data/epds_screening.py for the top-to-bottom scoring
# convention per item (items 1/2/4 score = index; the rest reverse).
LOW_ANSWERS = [0, 0, 3, 0, 3, 3, 3, 3, 3, 3]

# Items 1-9 each scored 2 (total 18, well over the 13+ "high" band);
# item 10 answered "Never" (score 0, not flagged) -- isolates the
# total-score pathway from the item-10 pathway.
HIGH_TOTAL_ANSWERS = [2, 2, 1, 2, 1, 1, 1, 1, 1, 3]

# Items 1-9 all at their least-concerning option (total from those: 0);
# item 10 answered "Hardly ever" (score 1, index 2) -- total score is 1,
# unambiguously in the "low" band, but item 10 is positive.
LOW_TOTAL_ITEM10_POSITIVE_ANSWERS = [0, 0, 3, 0, 3, 3, 3, 3, 3, 2]


def test_low_score_no_flag():
    result = score_epds(LOW_ANSWERS)
    assert result.total_score == 0
    assert result.item_10_flag is False
    assert result.risk_level == "low"


def test_high_total_score_flags_high_risk():
    result = score_epds(HIGH_TOTAL_ANSWERS)
    assert result.total_score == 18
    assert result.item_10_flag is False
    assert result.risk_level == "high"


def test_low_total_score_with_item_10_positive_still_flags_high_risk():
    """The critical safety rule: item 10 alone forces a high-risk flag,
    independent of how low the total score otherwise is.
    """
    result = score_epds(LOW_TOTAL_ITEM10_POSITIVE_ANSWERS)
    assert result.total_score == 1
    assert result.total_score < 10  # unambiguously "low" by total score alone
    assert result.item_10_flag is True
    assert result.risk_level == "high"


def test_submit_screening_low_risk(client, auth_headers):
    headers, _ = auth_headers()
    resp = client.post("/screenings", json={"answers": LOW_ANSWERS}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["risk_level"] == "low"
    assert body["item_10_flag"] is False
    assert body["total_score"] == 0
    assert "provider" not in body["message"].lower()


def test_submit_screening_high_risk_message_frames_as_suggestion_not_diagnosis(client, auth_headers):
    headers, _ = auth_headers()
    resp = client.post("/screenings", json={"answers": HIGH_TOTAL_ANSWERS}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["risk_level"] == "high"
    assert body["item_10_flag"] is False
    assert "speaking with a provider" in body["message"].lower()
    assert "988" not in body["message"]  # no self-harm notice when item 10 isn't flagged


def test_submit_screening_item_10_positive_includes_crisis_resources(client, auth_headers):
    headers, _ = auth_headers()
    resp = client.post(
        "/screenings", json={"answers": LOW_TOTAL_ITEM10_POSITIVE_ANSWERS}, headers=headers
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["risk_level"] == "high"
    assert body["item_10_flag"] is True
    assert body["total_score"] == 1
    assert "988" in body["message"]


def test_submit_screening_rejects_malformed_answers(client, auth_headers):
    headers, _ = auth_headers()

    too_short = client.post("/screenings", json={"answers": [0, 1, 2]}, headers=headers)
    assert too_short.status_code == 422

    out_of_range = client.post(
        "/screenings", json={"answers": [0, 1, 2, 3, 0, 1, 2, 3, 0, 9]}, headers=headers
    )
    assert out_of_range.status_code == 422


def test_alerts_forbidden_for_non_provider_then_visible_once_flagged(client, auth_headers, db_session):
    headers, register = auth_headers()

    flagged_resp = client.post(
        "/screenings", json={"answers": LOW_TOTAL_ITEM10_POSITIVE_ANSWERS}, headers=headers
    )
    assert flagged_resp.status_code == 201
    flagged_id = flagged_resp.json()["id"]

    unflagged_resp = client.post("/screenings", json={"answers": LOW_ANSWERS}, headers=headers)
    assert unflagged_resp.status_code == 201

    forbidden = client.get("/alerts", headers=headers)
    assert forbidden.status_code == 403

    caregiver = db_session.get(Caregiver, UUID(register["id"]))
    caregiver.is_provider = True
    db_session.commit()

    alerts_resp = client.get("/alerts", headers=headers)
    assert alerts_resp.status_code == 200
    alert_ids = [a["id"] for a in alerts_resp.json()]
    assert alert_ids == [flagged_id]
