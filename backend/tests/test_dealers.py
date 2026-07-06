from .conftest import create_user, login_with_otp, login_worker, auth_headers


def make_dealer_payload(dealer_code="DLR-0001", **overrides):
    payload = {
        "category": "supplier",
        "name": "John Doe",
        "company_name": "Acme Supplies",
        "dealer_code": dealer_code,
    }
    payload.update(overrides)
    return payload


def store_headers(client):
    create_user(client, "store_user", "store_user@example.com", role="store")
    token = login_with_otp(client, "store_user")
    return auth_headers(token)


def test_create_dealer_requires_authentication(client):
    response = client.post("/api/dealers/", json=make_dealer_payload())
    assert response.status_code == 401


def test_create_dealer_forbidden_for_worker_role(client, worker_headers):
    response = client.post("/api/dealers/", json=make_dealer_payload(), headers=worker_headers)
    assert response.status_code == 403


def test_create_dealer_allowed_for_store_role(client):
    headers = store_headers(client)
    response = client.post("/api/dealers/", json=make_dealer_payload("DLR-0002"), headers=headers)
    assert response.status_code == 200
    assert response.json()["dealer_code"] == "DLR-0002"


def test_create_dealer_allowed_for_admin(client, admin_headers):
    response = client.post(
        "/api/dealers/", json=make_dealer_payload("DLR-0003"), headers=admin_headers
    )
    assert response.status_code == 200


def test_create_dealer_invalid_category_rejected(client, admin_headers):
    response = client.post(
        "/api/dealers/",
        json=make_dealer_payload("DLR-0004", category="not-a-real-category"),
        headers=admin_headers,
    )
    assert response.status_code == 400


def test_create_dealer_duplicate_code_rejected(client, admin_headers):
    client.post("/api/dealers/", json=make_dealer_payload("DLR-DUP"), headers=admin_headers)
    response = client.post(
        "/api/dealers/", json=make_dealer_payload("DLR-DUP"), headers=admin_headers
    )
    assert response.status_code == 400
    assert "already exists" in response.text


def test_dealer_code_is_normalized_to_uppercase(client, admin_headers):
    response = client.post(
        "/api/dealers/", json=make_dealer_payload("dlr-lower"), headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["dealer_code"] == "DLR-LOWER"


def test_list_dealers_filters_by_category(client, admin_headers):
    client.post(
        "/api/dealers/",
        json=make_dealer_payload("DLR-SUP", category="supplier"),
        headers=admin_headers,
    )
    client.post(
        "/api/dealers/",
        json=make_dealer_payload(
            "DLR-SUB", category="sub_contractor", name="Sub Co", company_name="SubCo"
        ),
        headers=admin_headers,
    )

    response = client.get("/api/dealers/?category=supplier", headers=admin_headers)
    assert response.status_code == 200
    categories = {d["category"] for d in response.json()}
    assert categories == {"supplier"}
