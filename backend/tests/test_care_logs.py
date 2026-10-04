from datetime import date

import pytest
from starlette.websockets import WebSocketDisconnect

from app.models import Caregiver, CaregiverRole
from app.security import hash_password


def _assert_closed_with_1008(client, url):
    """The socket must be accepted and then closed with 1008 (not refused
    during the handshake): browsers only expose the close code for an
    accepted socket, and the frontend relies on it to stop reconnecting.
    """
    with client.websocket_connect(url) as websocket:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            websocket.receive_json()
    assert exc_info.value.code == 1008


def test_second_caregiver_receives_broadcast_care_log_over_websocket(client, auth_headers, db_session):
    headers_a, register_a = auth_headers(email="parent-a@example.com")
    family_id = register_a["family_id"]

    # No "invite a caregiver" endpoint exists yet, so seed the second
    # caregiver in the SAME family directly -- this is what that endpoint
    # would do under the hood.
    caregiver_b = Caregiver(
        family_id=family_id,
        name="Co-Parent B",
        email="parent-b@example.com",
        password_hash=hash_password("another strong password"),
        role=CaregiverRole.CO_PARENT,
        permission_level="full",
    )
    db_session.add(caregiver_b)
    db_session.commit()

    login_b = client.post(
        "/auth/login",
        data={"username": "parent-b@example.com", "password": "another strong password"},
    )
    assert login_b.status_code == 200
    token_b = login_b.json()["access_token"]

    child_resp = client.post("/children", json={"birth_date": date.today().isoformat()}, headers=headers_a)
    assert child_resp.status_code == 201
    child_id = child_resp.json()["id"]

    with client.websocket_connect(f"/ws/families/{family_id}?token={token_b}") as websocket:
        create_resp = client.post(
            f"/children/{child_id}/care-logs",
            json={"type": "feed", "notes": "8oz bottle"},
            headers=headers_a,
        )
        assert create_resp.status_code == 201
        created = create_resp.json()

        received = websocket.receive_json()

    assert received["id"] == created["id"]
    assert received["child_id"] == child_id
    assert received["type"] == "feed"
    assert received["notes"] == "8oz bottle"
    assert received["caregiver_id"] == register_a["id"]


def test_websocket_rejects_connection_for_another_family(client, auth_headers):
    headers_a, register_a = auth_headers(email="parent-a@example.com")
    headers_b, register_b = auth_headers(email="parent-b@example.com")

    login_b = client.post(
        "/auth/login",
        data={"username": "parent-b@example.com", "password": "correct horse battery staple"},
    )
    token_b = login_b.json()["access_token"]

    _assert_closed_with_1008(client, f"/ws/families/{register_a['family_id']}?token={token_b}")


def test_websocket_closes_with_1008_for_missing_or_invalid_token(client, auth_headers):
    _, register = auth_headers()
    family_id = register["family_id"]

    _assert_closed_with_1008(client, f"/ws/families/{family_id}")
    _assert_closed_with_1008(client, f"/ws/families/{family_id}?token=not-a-real-token")


def test_websocket_closes_with_1008_for_expired_token(client, auth_headers):
    _, register = auth_headers()
    expired = _expired_token(register["id"], register["family_id"])

    _assert_closed_with_1008(client, f"/ws/families/{register['family_id']}?token={expired}")


def _expired_token(caregiver_id, family_id):
    import time

    import jwt

    from app.security import JWT_ALGORITHM, JWT_SECRET

    now = int(time.time())
    return jwt.encode(
        {"sub": caregiver_id, "family_id": family_id, "is_provider": False,
         "iat": now - 7200, "exp": now - 3600},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def test_access_token_expires_in_about_an_hour(client, auth_headers):
    import jwt

    from app.security import JWT_ALGORITHM, JWT_SECRET

    auth_headers()
    login = client.post(
        "/auth/login",
        data={"username": "parent@example.com", "password": "correct horse battery staple"},
    )
    claims = jwt.decode(login.json()["access_token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])

    assert claims["exp"] - claims["iat"] == 60 * 60


def test_expired_token_is_rejected_with_401(client, auth_headers):
    _, register = auth_headers()
    expired = _expired_token(register["id"], register["family_id"])

    resp = client.get("/children", headers={"Authorization": f"Bearer {expired}"})

    assert resp.status_code == 401


def _make_child(client, headers):
    return client.post(
        "/children", json={"name": "Baby", "birth_date": "2026-08-01"}, headers=headers
    ).json()["id"]


def test_list_care_logs_newest_first_and_limited(client, auth_headers):
    headers, _ = auth_headers()
    child_id = _make_child(client, headers)
    for i, minute in enumerate((10, 30, 20)):
        resp = client.post(
            f"/children/{child_id}/care-logs",
            json={"type": "feed", "notes": f"entry {i}", "timestamp": f"2026-10-03T08:{minute}:00Z"},
            headers=headers,
        )
        assert resp.status_code == 201

    listed = client.get(f"/children/{child_id}/care-logs", headers=headers)
    assert listed.status_code == 200
    assert [e["notes"] for e in listed.json()] == ["entry 1", "entry 2", "entry 0"]

    limited = client.get(f"/children/{child_id}/care-logs?limit=2", headers=headers).json()
    assert [e["notes"] for e in limited] == ["entry 1", "entry 2"]
    assert client.get(f"/children/{child_id}/care-logs?limit=0", headers=headers).status_code == 422


def test_list_care_logs_is_family_scoped_and_requires_auth(client, auth_headers):
    headers_a, _ = auth_headers(email="parent-a@example.com")
    headers_b, _ = auth_headers(email="parent-b@example.com")
    child_id = _make_child(client, headers_a)
    client.post(f"/children/{child_id}/care-logs", json={"type": "feed"}, headers=headers_a)

    assert client.get(f"/children/{child_id}/care-logs", headers=headers_b).status_code == 404
    assert client.get(f"/children/{child_id}/care-logs").status_code == 401
