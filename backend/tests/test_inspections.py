def create_tool(client, headers, qr_code="INSP-QR-0001", **overrides):
    payload = {
        "description": "Test Sling",
        "make": "Acme",
        "capacity": "N/A",
        "safe_working_load": "N/A",
        "metal_type": "Steel",
        "tool_variant": "Standard",
        "qr_code": qr_code,
    }
    payload.update(overrides)
    response = client.post("/api/tools/", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_create_inspection_requires_authentication(client):
    response = client.post("/api/inspections/", json={"tool_id": 1, "result": "usable"})
    assert response.status_code == 401


def test_passing_inspection_marks_tool_usable(client, worker_headers):
    tool = create_tool(client, worker_headers, "INSP-QR-0001")
    response = client.post(
        "/api/inspections/",
        json={"tool_id": tool["id"], "result": "usable", "remarks": "Looks fine"},
        headers=worker_headers,
    )
    assert response.status_code == 200

    updated_tool = client.get(f"/api/tools/{tool['id']}", headers=worker_headers).json()
    assert updated_tool["status"] == "usable"
    assert updated_tool["inspection_result"] == "usable"


def test_failing_inspection_marks_tool_scrap(client, worker_headers):
    tool = create_tool(client, worker_headers, "INSP-QR-0002")
    response = client.post(
        "/api/inspections/",
        json={"tool_id": tool["id"], "result": "fail", "remarks": "Broken"},
        headers=worker_headers,
    )
    assert response.status_code == 200

    updated_tool = client.get(f"/api/tools/{tool['id']}", headers=worker_headers).json()
    assert updated_tool["status"] == "scrap"
    assert updated_tool["inspection_result"] == "not-usable"


def test_repair_result_marks_tool_under_repair(client, worker_headers):
    tool = create_tool(client, worker_headers, "INSP-QR-0003")
    response = client.post(
        "/api/inspections/",
        json={"tool_id": tool["id"], "result": "repair"},
        headers=worker_headers,
    )
    assert response.status_code == 200

    updated_tool = client.get(f"/api/tools/{tool['id']}", headers=worker_headers).json()
    assert updated_tool["status"] == "under-repair"


def test_low_usability_inspection_creates_critical_alert(client, worker_headers):
    tool = create_tool(client, worker_headers, "INSP-QR-0004")
    response = client.post(
        "/api/inspections/",
        json={"tool_id": tool["id"], "result": "usable", "usability_percentage": 50},
        headers=worker_headers,
    )
    assert response.status_code == 200

    alerts = client.get("/api/alerts/", headers=worker_headers).json()
    assert any(a["type"] == "low-usability" and a["tool_id"] == tool["id"] for a in alerts)


def test_high_usability_inspection_does_not_create_low_usability_alert(client, worker_headers):
    tool = create_tool(client, worker_headers, "INSP-QR-0005")
    client.post(
        "/api/inspections/",
        json={"tool_id": tool["id"], "result": "usable", "usability_percentage": 95},
        headers=worker_headers,
    )

    alerts = client.get("/api/alerts/", headers=worker_headers).json()
    assert not any(
        a["type"] == "low-usability" and a["tool_id"] == tool["id"] for a in alerts
    )


def test_inspector_role_without_verified_employee_profile_is_forbidden(client):
    from .conftest import create_user, login_with_otp, auth_headers

    create_user(client, "inspector_user", "inspector_user@example.com", role="inspector")
    token = login_with_otp(client, "inspector_user")
    headers = auth_headers(token)

    tool = create_tool(client, headers, "INSP-QR-0006")
    response = client.post(
        "/api/inspections/",
        json={"tool_id": tool["id"], "result": "usable"},
        headers=headers,
    )
    assert response.status_code == 403
