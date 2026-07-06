from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from ..main import app
from ..database import get_session
from .. import email_utils


def _fake_send_otp(identifier: str) -> str:
    """Stand-in for send_otp_email/send_otp_sms: stores the OTP the same way
    the real functions do, without touching SMTP/Twilio/Fast2SMS."""
    otp = email_utils.generate_otp()
    email_utils._otp_store[identifier] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=email_utils.OTP_TTL_MINUTES),
        "verified": False,
    }
    return otp


@pytest.fixture(autouse=True)
def no_real_external_calls(monkeypatch):
    """Tests must never depend on live email/SMS providers, regardless of
    what credentials happen to be configured in backend/.env. Without this,
    a real GMAIL_USER/GMAIL_APP_PASSWORD or Twilio config in .env makes the
    whole suite slow and flaky (or outright fail) by hitting real SMTP/Twilio."""
    monkeypatch.setattr(email_utils, "send_otp_email", _fake_send_otp)
    monkeypatch.setattr(email_utils, "send_otp_sms", _fake_send_otp)
    monkeypatch.setattr(email_utils, "register_twilio_verified_caller_id", lambda *a, **kw: None)


@pytest.fixture()
def client():
    """Fresh in-memory SQLite DB + TestClient for each test, fully isolated."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override

    # Deliberately not used as a context manager: entering/exiting TestClient
    # fires the app's lifespan/startup event, whose migration logic in main.py
    # imports the *real* engine straight from database.py (bypassing this
    # dependency override) and would try to hit the actual configured
    # DATABASE_URL. Plain instantiation skips lifespan entirely.
    test_client = TestClient(app, raise_server_exceptions=False)
    yield test_client

    app.dependency_overrides.clear()
    email_utils._otp_store.clear()
    engine.dispose()


def verify_email(email: str) -> None:
    """Simulate the email-OTP verification step required before user creation."""
    otp = email_utils.send_otp_email(email)
    assert email_utils.verify_otp(email, otp)


def get_pending_otp(identifier: str) -> str:
    """Read back the OTP that a /users/token request generated, as a test would
    receive it out-of-band (e.g. via the actual email/SMS)."""
    return email_utils._otp_store[identifier]["otp"]


def create_user(
    client,
    username: str,
    email: str,
    password: str = "Password123!",
    role: str = "worker",
    full_name: str = None,
    site: str = None,
    phone: str = None,
    status: str = "active",
):
    verify_email(email)
    payload = {
        "username": username,
        "email": email,
        "password": password,
        "role": role,
        "status": status,
        "full_name": full_name or username,
    }
    if site:
        payload["site"] = site
    if phone:
        payload["phone"] = phone
    response = client.post("/api/users/", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def login_worker(client, username: str, password: str = "Password123!"):
    """Workers skip OTP and get a token directly."""
    response = client.post("/api/users/token", data={"username": username, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    assert "access_token" in body
    return body["access_token"]


def login_with_otp(client, username: str, password: str = "Password123!"):
    """Non-worker roles require OTP; read the OTP back from the in-memory store."""
    response = client.post("/api/users/token", data={"username": username, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("otp_required") is True
    identifier = body.get("email") or body.get("phone")
    otp = get_pending_otp(identifier)
    verify_response = client.post(
        "/api/users/token/verify-otp", json={"username": username, "otp": otp}
    )
    assert verify_response.status_code == 200, verify_response.text
    return verify_response.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_token(client):
    create_user(client, "admin", "admin@example.com", role="admin")
    return login_with_otp(client, "admin")


@pytest.fixture()
def admin_headers(admin_token):
    return auth_headers(admin_token)


@pytest.fixture()
def worker_token(client):
    create_user(client, "worker1", "worker1@example.com", role="worker")
    return login_worker(client, "worker1")


@pytest.fixture()
def worker_headers(worker_token):
    return auth_headers(worker_token)
