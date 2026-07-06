from .conftest import (
    create_user,
    verify_email,
    login_worker,
    login_with_otp,
    get_pending_otp,
)


def test_create_user_requires_email_verification(client):
    response = client.post(
        "/api/users/",
        json={
            "username": "unverified",
            "email": "unverified@example.com",
            "password": "Password123!",
            "role": "worker",
        },
    )
    assert response.status_code == 400
    assert "not been verified" in response.text


def test_create_user_succeeds_after_email_verification(client):
    user = create_user(client, "alice", "alice@example.com", role="worker")
    assert user["username"] == "alice"
    assert "hashed_password" not in user


def test_create_user_duplicate_username_rejected(client):
    create_user(client, "bob", "bob@example.com", role="worker")
    verify_email("bob2@example.com")
    response = client.post(
        "/api/users/",
        json={
            "username": "bob",
            "email": "bob2@example.com",
            "password": "Password123!",
            "role": "worker",
        },
    )
    assert response.status_code == 400
    assert "already registered" in response.text


def test_create_user_duplicate_phone_rejected(client):
    create_user(client, "carol", "carol@example.com", role="worker", phone="9000000001")
    verify_email("carol2@example.com")
    response = client.post(
        "/api/users/",
        json={
            "username": "carol2",
            "email": "carol2@example.com",
            "password": "Password123!",
            "role": "worker",
            "phone": "9000000001",
        },
    )
    assert response.status_code == 400
    assert "Mobile number already registered" in response.text


def test_login_worker_role_returns_token_without_otp(client):
    create_user(client, "dave", "dave@example.com", role="worker")
    token = login_worker(client, "dave")
    assert token


def test_login_non_worker_role_requires_otp(client):
    create_user(client, "erin", "erin@example.com", role="store")
    response = client.post("/api/users/token", data={"username": "erin", "password": "Password123!"})
    assert response.status_code == 200
    body = response.json()
    assert body["otp_required"] is True
    assert body["email"] == "erin@example.com"


def test_full_otp_login_flow_for_non_worker(client):
    create_user(client, "frank", "frank@example.com", role="store")
    token = login_with_otp(client, "frank")
    assert token


def test_verify_otp_with_wrong_code_is_rejected(client):
    create_user(client, "grace", "grace@example.com", role="store")
    response = client.post("/api/users/token", data={"username": "grace", "password": "Password123!"})
    assert response.status_code == 200
    client.post("/api/users/token/verify-otp", json={"username": "grace", "otp": "000000"})
    resp = client.post("/api/users/token/verify-otp", json={"username": "grace", "otp": "000000"})
    assert resp.status_code == 400


def test_login_invalid_password_rejected(client):
    create_user(client, "heidi", "heidi@example.com", role="worker")
    response = client.post(
        "/api/users/token", data={"username": "heidi", "password": "WrongPassword"}
    )
    assert response.status_code == 401


def test_login_unknown_username_rejected(client):
    response = client.post(
        "/api/users/token", data={"username": "nobody", "password": "whatever"}
    )
    assert response.status_code == 401


def test_login_deactivated_account_rejected(client):
    create_user(client, "ivan", "ivan@example.com", role="worker", status="inactive")
    response = client.post(
        "/api/users/token", data={"username": "ivan", "password": "Password123!"}
    )
    assert response.status_code == 403
    assert "deactivated" in response.text


def test_login_by_email_instead_of_username(client):
    create_user(client, "judy", "judy@example.com", role="worker")
    token = login_worker(client, "judy@example.com")
    assert token
