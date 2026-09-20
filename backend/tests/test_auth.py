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


def test_list_children_scoped_to_family(client, auth_headers):
    headers_a, _ = auth_headers(email="parent-a@example.com")
    headers_b, _ = auth_headers(email="parent-b@example.com")

    resp_a1 = client.post(
        "/children", json={"name": "Alice", "birth_date": "2026-01-01"}, headers=headers_a
    )
    assert resp_a1.status_code == 201
    resp_a2 = client.post(
        "/children", json={"name": "Bob", "birth_date": "2026-02-01"}, headers=headers_a
    )
    assert resp_a2.status_code == 201
    client.post("/children", json={"name": "Carol", "birth_date": "2026-01-01"}, headers=headers_b)

    list_a = client.get("/children", headers=headers_a)
    assert list_a.status_code == 200
    names = {child["name"] for child in list_a.json()}
    assert names == {"Alice", "Bob"}
