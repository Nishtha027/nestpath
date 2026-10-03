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


def test_new_family_gets_invite_code(client, auth_headers):
    headers, _ = auth_headers()
    resp = client.get("/family", headers=headers)
    assert resp.status_code == 200
    code = resp.json()["invite_code"]
    assert len(code) == 8
    assert code == code.upper()


def test_each_family_gets_a_distinct_invite_code(client, auth_headers):
    headers_a, _ = auth_headers(email="parent-a@example.com")
    headers_b, _ = auth_headers(email="parent-b@example.com")
    code_a = client.get("/family", headers=headers_a).json()["invite_code"]
    code_b = client.get("/family", headers=headers_b).json()["invite_code"]
    assert code_a != code_b


def test_family_endpoint_requires_auth(client):
    assert client.get("/family").status_code == 401


def test_register_with_invite_code_joins_existing_family(client, auth_headers):
    headers_a, reg_a = auth_headers(email="parent-a@example.com")
    code = client.get("/family", headers=headers_a).json()["invite_code"]
    child = client.post(
        "/children", json={"name": "Alice", "birth_date": "2026-01-01"}, headers=headers_a
    ).json()

    join_resp = client.post(
        "/auth/register",
        json={
            "name": "Second Caregiver",
            "email": "parent-b@example.com",
            "password": "correct horse battery staple",
            "invite_code": code,
        },
    )
    assert join_resp.status_code == 201
    assert join_resp.json()["family_id"] == reg_a["family_id"]

    login_resp = client.post(
        "/auth/login",
        data={"username": "parent-b@example.com", "password": "correct horse battery staple"},
    )
    headers_b = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # The joiner sees the family's existing child, and the same invite code.
    children = client.get("/children", headers=headers_b).json()
    assert [c["id"] for c in children] == [child["id"]]
    assert client.get("/family", headers=headers_b).json()["invite_code"] == code


def test_invite_code_is_forgiving_about_case_and_separators(client, auth_headers):
    headers_a, reg_a = auth_headers(email="parent-a@example.com")
    code = client.get("/family", headers=headers_a).json()["invite_code"]
    typed = f" {code[:4].lower()}-{code[4:].lower()} "

    resp = client.post(
        "/auth/register",
        json={
            "name": "Second Caregiver",
            "email": "parent-b@example.com",
            "password": "correct horse battery staple",
            "invite_code": typed,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["family_id"] == reg_a["family_id"]


def test_register_with_unknown_invite_code_rejected(client, db_session):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Nobody",
            "email": "nobody@example.com",
            "password": "correct horse battery staple",
            "invite_code": "ZZZZZZZZ",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid invite code"

    # The failed attempt must not leave an account or a stray family behind.
    from app.models import Caregiver, Family

    assert db_session.query(Caregiver).count() == 0
    assert db_session.query(Family).count() == 0


def test_register_with_blank_invite_code_rejected(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Nobody",
            "email": "nobody@example.com",
            "password": "correct horse battery staple",
            "invite_code": "   ",
        },
    )
    assert resp.status_code == 400


def test_joining_does_not_expose_other_families(client, auth_headers):
    headers_a, _ = auth_headers(email="parent-a@example.com")
    headers_c, _ = auth_headers(email="parent-c@example.com")
    client.post("/children", json={"name": "Carol", "birth_date": "2026-01-01"}, headers=headers_c)

    code_a = client.get("/family", headers=headers_a).json()["invite_code"]
    client.post(
        "/auth/register",
        json={
            "name": "Second Caregiver",
            "email": "parent-b@example.com",
            "password": "correct horse battery staple",
            "invite_code": code_a,
        },
    )
    login = client.post(
        "/auth/login",
        data={"username": "parent-b@example.com", "password": "correct horse battery staple"},
    )
    headers_b = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/children", headers=headers_b).json() == []
