def make_tool_payload(qr_code: str, **overrides) -> dict:
    payload = {
        "description": "Test Hammer",
        "make": "Stanley",
        "capacity": "N/A",
        "safe_working_load": "N/A",
        "metal_type": "Steel",
        "tool_variant": "Standard",
        "qr_code": qr_code,
    }
    payload.update(overrides)
    return payload


def test_create_tool_success(client, worker_headers):
    response = client.post("/api/tools/", json=make_tool_payload("QR-0001"), headers=worker_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["qr_code"] == "QR-0001"
    assert body["status"] == "usable"


def test_create_tool_requires_authentication(client):
    response = client.post("/api/tools/", json=make_tool_payload("QR-0002"))
    assert response.status_code == 401


def test_create_tool_duplicate_qr_code_rejected(client, worker_headers):
    client.post("/api/tools/", json=make_tool_payload("QR-DUP"), headers=worker_headers)
    response = client.post("/api/tools/", json=make_tool_payload("QR-DUP"), headers=worker_headers)
    assert response.status_code == 400
    assert "already exists" in response.text


def test_read_tool_not_found(client, worker_headers):
    response = client.get("/api/tools/999999", headers=worker_headers)
    assert response.status_code == 404


def test_read_tool_by_id(client, worker_headers):
    created = client.post(
        "/api/tools/", json=make_tool_payload("QR-0003"), headers=worker_headers
    ).json()
    response = client.get(f"/api/tools/{created['id']}", headers=worker_headers)
    assert response.status_code == 200
    assert response.json()["qr_code"] == "QR-0003"


def test_list_tools_excludes_deleted(client, worker_headers):
    created = client.post(
        "/api/tools/", json=make_tool_payload("QR-0004"), headers=worker_headers
    ).json()
    client.delete(f"/api/tools/{created['id']}", headers=worker_headers)
    response = client.get("/api/tools/", headers=worker_headers)
    ids = [t["id"] for t in response.json()]
    assert created["id"] not in ids


def test_search_tools_by_description(client, worker_headers):
    client.post(
        "/api/tools/",
        json=make_tool_payload("QR-0005", description="Unique Widget"),
        headers=worker_headers,
    )
    response = client.get("/api/tools/?search=Unique", headers=worker_headers)
    assert response.status_code == 200
    assert any(t["description"] == "Unique Widget" for t in response.json())


def test_update_tool_site_creates_movement_history(client, worker_headers):
    created = client.post(
        "/api/tools/",
        json=make_tool_payload("QR-0006", current_site="SiteA"),
        headers=worker_headers,
    ).json()

    response = client.patch(
        f"/api/tools/{created['id']}",
        json={"current_site": "SiteB"},
        headers=worker_headers,
    )
    assert response.status_code == 200
    assert response.json()["current_site"] == "SiteB"

    history = client.get(f"/api/movements/{created['id']}", headers=worker_headers)
    assert history.status_code == 200
    moves = history.json()
    assert any(m["from_site"] == "SiteA" and m["to_site"] == "SiteB" for m in moves)


def test_update_nonexistent_tool_returns_404(client, worker_headers):
    response = client.patch(
        "/api/tools/999999", json={"description": "Ghost"}, headers=worker_headers
    )
    assert response.status_code == 404


def test_delete_unprinted_tool_is_hard_deleted(client, worker_headers):
    created = client.post(
        "/api/tools/", json=make_tool_payload("QR-0007"), headers=worker_headers
    ).json()
    response = client.delete(f"/api/tools/{created['id']}", headers=worker_headers)
    assert response.status_code == 200

    read_response = client.get(f"/api/tools/{created['id']}", headers=worker_headers)
    assert read_response.status_code == 404


def test_delete_printed_tool_is_soft_deleted_and_restorable(client, worker_headers, admin_headers):
    created = client.post(
        "/api/tools/", json=make_tool_payload("QR-0008"), headers=worker_headers
    ).json()
    client.post(
        "/api/tools/mark-printed", json={"tool_ids": [created["id"]]}, headers=worker_headers
    )

    delete_response = client.delete(f"/api/tools/{created['id']}", headers=worker_headers)
    assert delete_response.status_code == 200

    # Soft-deleted tools disappear from the default list...
    list_response = client.get("/api/tools/", headers=worker_headers)
    ids = [t["id"] for t in list_response.json()]
    assert created["id"] not in ids

    # ...but the row still exists and can be restored by an admin
    restore_response = client.post(f"/api/tools/{created['id']}/restore", headers=admin_headers)
    assert restore_response.status_code == 200

    list_after_restore = client.get("/api/tools/", headers=worker_headers)
    ids_after = [t["id"] for t in list_after_restore.json()]
    assert created["id"] in ids_after


def test_restore_tool_requires_admin(client, worker_headers):
    created = client.post(
        "/api/tools/", json=make_tool_payload("QR-0009"), headers=worker_headers
    ).json()
    client.post(
        "/api/tools/mark-printed", json={"tool_ids": [created["id"]]}, headers=worker_headers
    )
    client.delete(f"/api/tools/{created['id']}", headers=worker_headers)

    response = client.post(f"/api/tools/{created['id']}/restore", headers=worker_headers)
    assert response.status_code == 403


def test_read_tool_by_full_qr_code(client, worker_headers):
    client.post("/api/tools/", json=make_tool_payload("QR-0010"), headers=worker_headers)
    response = client.get("/api/tools/qr/QR-0010")
    assert response.status_code == 200
    assert response.json()["qr_code"] == "QR-0010"


def test_read_tool_by_qr_last_four_digits(client, worker_headers):
    client.post("/api/tools/", json=make_tool_payload("ABCD0099"), headers=worker_headers)
    response = client.get("/api/tools/qr/0099")
    assert response.status_code == 200
    assert response.json()["qr_code"] == "ABCD0099"


def test_read_tool_by_qr_not_found(client):
    response = client.get("/api/tools/qr/DOES-NOT-EXIST")
    assert response.status_code == 404
