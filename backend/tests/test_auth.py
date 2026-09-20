def test_register_and_login(client):
    register_resp = client.post(
        "/auth/register",
        json={"name": "Test Parent", "email": "parent@example.com", "password": "correct horse battery staple"},
    )
    assert register_resp.status_code == 201
    body = register_resp.json()
    assert body["email"] == "parent@example.com"
    assert body["role"] == "parent"
    assert "family_id" in body

    login_resp = client.post(
        "/auth/login",
        data={"username": "parent@example.com", "password": "correct horse battery staple"},
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["token_type"] == "bearer"
    assert login_resp.json()["access_token"]


def test_login_rejects_wrong_password(client):
    client.post(
        "/auth/register",
        json={"name": "Test Parent", "email": "parent@example.com", "password": "correct horse battery staple"},
    )
    resp = client.post(
        "/auth/login",
        data={"username": "parent@example.com", "password": "wrong password"},
    )
    assert resp.status_code == 401


def test_duplicate_email_registration_rejected(client):
    payload = {"name": "Test Parent", "email": "parent@example.com", "password": "correct horse battery staple"}
    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 400


def test_children_endpoint_requires_auth(client):
    resp = client.post("/children", json={"birth_date": "2026-01-01"})
    assert resp.status_code == 401


def test_caregiver_cannot_access_another_familys_child(client, auth_headers):
    headers_a, _ = auth_headers(email="parent-a@example.com")
    headers_b, _ = auth_headers(email="parent-b@example.com")

    create_resp = client.post("/children", json={"birth_date": "2026-01-01"}, headers=headers_a)
    assert create_resp.status_code == 201
    child_id = create_resp.json()["id"]

    resp = client.get(f"/children/{child_id}/schedule", headers=headers_b)
    assert resp.status_code == 404
