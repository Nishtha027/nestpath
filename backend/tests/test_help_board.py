import threading
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import Caregiver, CaregiverRole, HelpRequest
from app.security import hash_password
from app.services.help_board import CannotClaimOwnRequestError, HelpRequestAlreadyClaimedError, claim_request

_START = datetime(2026, 10, 5, 9, 0, tzinfo=timezone.utc)
_END = _START + timedelta(hours=2)


def _payload(**overrides):
    body = {
        "need_type": "meal",
        "description": "Dinner drop-off, anything freezer-friendly",
        "time_window_start": _START.isoformat(),
        "time_window_end": _END.isoformat(),
    }
    body.update(overrides)
    return body


def _add_caregiver_to_family(db_session, family_id, email, name):
    """No "invite a caregiver" endpoint exists yet, so seed a second (or
    third) caregiver in the SAME family directly, same pattern as
    test_care_logs.py.
    """
    caregiver = Caregiver(
        family_id=family_id,
        name=name,
        email=email,
        password_hash=hash_password("another strong password"),
        role=CaregiverRole.CO_PARENT,
        permission_level="full",
    )
    db_session.add(caregiver)
    db_session.commit()
    db_session.refresh(caregiver)
    return caregiver


def _login(client, email):
    resp = client.post("/auth/login", data={"username": email, "password": "another strong password"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_create_and_list_open_help_request(client, auth_headers):
    headers, _ = auth_headers()

    create_resp = client.post("/help-requests", json=_payload(), headers=headers)
    assert create_resp.status_code == 201
    body = create_resp.json()
    assert body["status"] == "open"
    assert body["claimed_by"] is None
    assert body["need_type"] == "meal"

    list_resp = client.get("/help-requests", headers=headers)
    assert list_resp.status_code == 200
    assert [r["id"] for r in list_resp.json()] == [body["id"]]


def test_claiming_records_claimer_and_removes_from_open_list(client, auth_headers, db_session):
    headers_a, register_a = auth_headers(email="parent-a@example.com")
    caregiver_b = _add_caregiver_to_family(db_session, register_a["family_id"], "parent-b@example.com", "B")
    headers_b = _login(client, caregiver_b.email)

    create_resp = client.post("/help-requests", json=_payload(), headers=headers_a)
    request_id = create_resp.json()["id"]

    claim_resp = client.post(f"/help-requests/{request_id}/claim", headers=headers_b)
    assert claim_resp.status_code == 200
    body = claim_resp.json()
    assert body["status"] == "claimed"
    assert body["claimed_by"] == str(caregiver_b.id)

    list_resp = client.get("/help-requests", headers=headers_a)
    assert list_resp.json() == []


def test_cannot_claim_own_request(client, auth_headers):
    headers, _ = auth_headers()

    create_resp = client.post("/help-requests", json=_payload(), headers=headers)
    request_id = create_resp.json()["id"]

    claim_resp = client.post(f"/help-requests/{request_id}/claim", headers=headers)
    assert claim_resp.status_code == 400


def test_claiming_an_already_claimed_request_conflicts(client, auth_headers, db_session):
    headers_a, register_a = auth_headers(email="parent-a@example.com")
    family_id = register_a["family_id"]
    caregiver_b = _add_caregiver_to_family(db_session, family_id, "parent-b@example.com", "B")
    caregiver_c = _add_caregiver_to_family(db_session, family_id, "parent-c@example.com", "C")
    headers_b = _login(client, caregiver_b.email)
    headers_c = _login(client, caregiver_c.email)

    create_resp = client.post("/help-requests", json=_payload(), headers=headers_a)
    request_id = create_resp.json()["id"]

    first_claim = client.post(f"/help-requests/{request_id}/claim", headers=headers_b)
    assert first_claim.status_code == 200

    second_claim = client.post(f"/help-requests/{request_id}/claim", headers=headers_c)
    assert second_claim.status_code == 409


def test_complete_requires_being_the_claimer(client, auth_headers, db_session):
    headers_a, register_a = auth_headers(email="parent-a@example.com")
    caregiver_b = _add_caregiver_to_family(db_session, register_a["family_id"], "parent-b@example.com", "B")
    headers_b = _login(client, caregiver_b.email)

    create_resp = client.post("/help-requests", json=_payload(), headers=headers_a)
    request_id = create_resp.json()["id"]

    # Not yet claimed -- the creator can't complete it either.
    premature = client.post(f"/help-requests/{request_id}/complete", headers=headers_a)
    assert premature.status_code == 409

    claim_resp = client.post(f"/help-requests/{request_id}/claim", headers=headers_b)
    assert claim_resp.status_code == 200

    # The creator (not the claimer) still can't complete it.
    wrong_completer = client.post(f"/help-requests/{request_id}/complete", headers=headers_a)
    assert wrong_completer.status_code == 409

    completed = client.post(f"/help-requests/{request_id}/complete", headers=headers_b)
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"


def test_help_requests_scoped_to_family(client, auth_headers):
    headers_a, _ = auth_headers(email="parent-a@example.com")
    headers_other, _ = auth_headers(email="outsider@example.com")

    create_resp = client.post("/help-requests", json=_payload(), headers=headers_a)
    request_id = create_resp.json()["id"]

    list_resp = client.get("/help-requests", headers=headers_other)
    assert list_resp.json() == []

    claim_resp = client.post(f"/help-requests/{request_id}/claim", headers=headers_other)
    assert claim_resp.status_code == 404


def test_concurrent_claims_only_one_succeeds(client, auth_headers, db_session):
    headers_a, register_a = auth_headers(email="parent-a@example.com")
    family_id = register_a["family_id"]
    caregiver_b = _add_caregiver_to_family(db_session, family_id, "parent-b@example.com", "B")
    caregiver_c = _add_caregiver_to_family(db_session, family_id, "parent-c@example.com", "C")

    create_resp = client.post("/help-requests", json=_payload(), headers=headers_a)
    request_id = create_resp.json()["id"]

    barrier = threading.Barrier(2)
    results: list[str] = [None, None]  # type: ignore[list-item]
    claimer_ids = [caregiver_b.id, caregiver_c.id]

    def attempt(index: int):
        session = SessionLocal()
        try:
            barrier.wait(timeout=10)
            try:
                claim_request(session, request_id, claimer_ids[index])
                session.commit()
                results[index] = "claimed"
            except (HelpRequestAlreadyClaimedError, CannotClaimOwnRequestError):
                session.rollback()
                results[index] = "conflict"
        except Exception as exc:  # surfaces unexpected errors instead of a silent None
            results[index] = f"error: {exc!r}"
        finally:
            session.close()

    t1 = threading.Thread(target=attempt, args=(0,))
    t2 = threading.Thread(target=attempt, args=(1,))
    t1.start()
    t2.start()
    t1.join(timeout=15)
    t2.join(timeout=15)

    assert sorted(results) == ["claimed", "conflict"], results

    db_session.expire_all()
    help_request = db_session.get(HelpRequest, request_id)
    assert help_request.status.value == "claimed"
    assert help_request.claimed_by in claimer_ids
