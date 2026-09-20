from datetime import date

import pytest
from starlette.websockets import WebSocketDisconnect

from app.models import Caregiver, CaregiverRole
from app.security import hash_password


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

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/families/{register_a['family_id']}?token={token_b}"):
            pass
