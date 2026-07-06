from .conftest import create_user, login_worker, auth_headers


def test_read_users_requires_authentication(client):
    response = client.get("/api/users/")
    assert response.status_code == 401


def test_read_users_with_valid_token(client, worker_headers):
    response = client.get("/api/users/", headers=worker_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_read_me_returns_current_user(client, worker_headers):
    response = client.get("/api/users/me", headers=worker_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "worker1"


def test_update_own_profile_allowed(client):
    user = create_user(client, "self_update", "self_update@example.com", role="worker")
    token = login_worker(client, "self_update")
    headers = auth_headers(token)
    response = client.patch(
        f"/api/users/{user['id']}", json={"full_name": "New Name"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "New Name"


def test_update_other_user_forbidden_for_non_admin(client):
    user_a = create_user(client, "user_a", "user_a@example.com", role="worker")
    create_user(client, "user_b", "user_b@example.com", role="worker")
    token_b = login_worker(client, "user_b")
    response = client.patch(
        f"/api/users/{user_a['id']}",
        json={"full_name": "Hacked"},
        headers=auth_headers(token_b),
    )
    assert response.status_code == 403


def test_admin_can_update_other_user(client, admin_headers):
    user = create_user(client, "target_user", "target_user@example.com", role="worker")
    response = client.patch(
        f"/api/users/{user['id']}",
        json={"full_name": "Updated By Admin"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated By Admin"


def test_update_nonexistent_user_returns_404(client, admin_headers):
    response = client.patch(
        "/api/users/999999", json={"full_name": "Ghost"}, headers=admin_headers
    )
    assert response.status_code == 404


def test_delete_user_is_permanently_disabled(client, admin_headers):
    """User deletion was intentionally removed in favor of the disable toggle
    (PATCH status=inactive) - the endpoint now always rejects with 400,
    regardless of caller role or whether the target user exists."""
    target = create_user(client, "not_deletable", "not_deletable@example.com", role="worker")
    response = client.delete(f"/api/users/{target['id']}", headers=admin_headers)
    assert response.status_code == 400
    assert "cannot be deleted" in response.text


def test_delete_user_rejected_even_for_nonexistent_id(client, admin_headers):
    response = client.delete("/api/users/999999", headers=admin_headers)
    assert response.status_code == 400


def test_admin_disables_user_via_status_toggle(client, admin_headers):
    """The supported way to deactivate a user is PATCH status=inactive, which
    then blocks that user from logging in (see test_auth.py)."""
    target = create_user(client, "toggle_me", "toggle_me@example.com", role="worker")
    response = client.patch(
        f"/api/users/{target['id']}", json={"status": "inactive"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "inactive"

    login_response = client.post(
        "/api/users/token", data={"username": "toggle_me", "password": "Password123!"}
    )
    assert login_response.status_code == 403
