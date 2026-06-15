from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from backend.main import app
from backend.database import get_session
from backend.models import User, Dealer, AuditLog, DealerCustomField
import os
import json

# Use local test database
sqlite_file_name = "test_dealers.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override
client = TestClient(app)

def test_dealers_flow():
    if os.path.exists(sqlite_file_name):
        os.remove(sqlite_file_name)

    create_db_and_tables()
    
    # 1. Create Admin User
    print("Creating admin user...")
    from backend import email_utils
    from datetime import datetime, timedelta
    email_utils._otp_store["admindealer@example.com"] = {
        "otp": "123456",
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "verified": True
    }
    response = client.post(
        "/api/users/",
        json={
            "username": "admin_dealer_test",
            "email": "admindealer@example.com",
            "password": "testpassword123",
            "role": "admin",
            "status": "active"
        }
    )
    assert response.status_code == 200, f"Failed to create user: {response.text}"

    # 2. Login
    print("Logging in to get access token...")
    response = client.post(
        "/api/users/token",
        data={"username": "admin_dealer_test", "password": "testpassword123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2b. Create Store User and test access
    print("Creating store user...")
    email_utils._otp_store["storedealer@example.com"] = {
        "otp": "123456",
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "verified": True
    }
    response = client.post(
        "/api/users/",
        json={
            "username": "store_dealer_test",
            "email": "storedealer@example.com",
            "password": "storepassword123",
            "role": "store",
            "status": "active"
        }
    )
    assert response.status_code == 200, f"Failed to create store user: {response.text}"

    print("Logging in as store user...")
    response = client.post(
        "/api/users/token",
        data={"username": "store_dealer_test", "password": "storepassword123"}
    )
    assert response.status_code == 200, f"Store login failed: {response.text}"
    store_token = response.json()["access_token"]
    store_headers = {"Authorization": f"Bearer {store_token}"}

    # Quick authorization check for store user
    response = client.get("/api/dealers/", headers=store_headers)
    assert response.status_code == 200, "Store user should be authorized to read dealers"
    
    response = client.get("/api/dealers/custom-fields", headers=store_headers)
    assert response.status_code == 200, "Store user should be authorized to read custom fields"

    test_field = {
        "name": "Store Custom Field Test",
        "field_type": "text",
        "is_required": False
    }
    response = client.post("/api/dealers/custom-fields", json=test_field, headers=store_headers)
    assert response.status_code == 200, f"Store user should be authorized to create custom fields: {response.text}"
    store_field_id = response.json()["id"]

    # Delete custom field as store
    response = client.delete(f"/api/dealers/custom-fields/{store_field_id}", headers=store_headers)
    assert response.status_code == 200, "Store user should be authorized to delete custom fields"
    print("Store user permissions validation passed successfully")

    # 3. Create Custom Fields
    print("\nTesting Custom Fields Configuration CRUD...")
    
    # Text Field
    field1_data = {
        "name": "Trade License",
        "field_type": "text",
        "is_required": True
    }
    response = client.post("/api/dealers/custom-fields", json=field1_data, headers=headers)
    assert response.status_code == 200, f"Failed to create custom field: {response.text}"
    cf1 = response.json()
    assert cf1["name"] == "Trade License"
    assert cf1["field_type"] == "text"
    assert cf1["is_required"] is True

    # File Upload Field
    field2_data = {
        "name": "GST Certificate PDF",
        "field_type": "file",
        "is_required": False
    }
    response = client.post("/api/dealers/custom-fields", json=field2_data, headers=headers)
    assert response.status_code == 200, f"Failed to create custom field: {response.text}"
    cf2 = response.json()

    # Radio Field
    field3_data = {
        "name": "Vendor Grade",
        "field_type": "radio",
        "is_required": True,
        "options": "Grade A, Grade B, Grade C"
    }
    response = client.post("/api/dealers/custom-fields", json=field3_data, headers=headers)
    assert response.status_code == 200
    cf3 = response.json()
    assert cf3["options"] == "Grade A, Grade B, Grade C"

    # Checkbox Field
    field4_data = {
        "name": "Active Status Check",
        "field_type": "checkbox",
        "is_required": False
    }
    response = client.post("/api/dealers/custom-fields", json=field4_data, headers=headers)
    assert response.status_code == 200

    # Checkboxes Field
    field5_data = {
        "name": "Accepted Payment Methods",
        "field_type": "checkboxes",
        "is_required": False,
        "options": "Cash, Bank Transfer, Credit Card"
    }
    response = client.post("/api/dealers/custom-fields", json=field5_data, headers=headers)
    assert response.status_code == 200
    cf5 = response.json()
    assert cf5["options"] == "Cash, Bank Transfer, Credit Card"

    # Test Duplicate Custom Field Name (Case-insensitive check)
    dup_field_data = {
        "name": "  trade license  ",
        "field_type": "number",
        "is_required": False
    }
    response = client.post("/api/dealers/custom-fields", json=dup_field_data, headers=headers)
    assert response.status_code == 400
    assert "Custom field name already exists" in response.json()["detail"]
    print("Duplicate custom field validation passed (correctly blocked duplicate name)")

    # Test List Custom Fields
    response = client.get("/api/dealers/custom-fields", headers=headers)
    assert response.status_code == 200
    fields_list = response.json()
    assert len(fields_list) == 5, f"Expected 5 fields, got {len(fields_list)}"
    print("Listing custom fields passed")

    # Test Update Custom Field
    update_data = {
        "name": "Trade License Code",
        "field_type": "text",
        "is_required": False
    }
    response = client.put(f"/api/dealers/custom-fields/{cf1['id']}", json=update_data, headers=headers)
    assert response.status_code == 200
    updated_cf = response.json()
    assert updated_cf["name"] == "Trade License Code"
    assert updated_cf["is_required"] is False
    print("Updating custom field passed")

    # 4. Create Dealers manually (including custom fields)
    print("\nTesting manual dealer registration with custom fields...")
    
    # Sub Contractor
    custom_vals = {
        "Trade License Code": "LIC-999-XYZ",
        "GST Certificate PDF": "/api/uploads/test_cert.pdf"
    }
    subcon_data = {
        "category": "sub_contractor",
        "name": "John Doe Subcon",
        "company_name": "Doe Construction Ltd",
        "dealer_code": "SUBCON-001",
        "email": "john.doe@doecon.com",
        "contact_number": "+1234567890",
        "address": "123 Main St, Builder Town",
        "gst_number": "29AAAAA1111A1Z1",
        "custom_fields": json.dumps(custom_vals)
    }
    response = client.post("/api/dealers/", json=subcon_data, headers=headers)
    assert response.status_code == 200, f"Failed to create contractor: {response.text}"
    subcon = response.json()
    assert subcon["dealer_code"] == "SUBCON-001"
    assert subcon["category"] == "sub_contractor"
    assert subcon["custom_fields"] is not None
    loaded_custom = json.loads(subcon["custom_fields"])
    assert loaded_custom["Trade License Code"] == "LIC-999-XYZ"
    print("Registered Sub Contractor with Custom Fields: SUBCON-001")

    # Supplier
    supplier_data = {
        "category": "supplier",
        "name": "Jane Cement Supplier",
        "company_name": "Cement Supply Corp",
        "dealer_code": "SUPPLIER-002",
        "email": "jane@cementsupply.com",
        "contact_number": "+1234567891",
        "address": "456 Bulk Ave, Supply City",
        "gst_number": "29BBBBB2222B2Z2",
        "custom_fields": None
    }
    response = client.post("/api/dealers/", json=supplier_data, headers=headers)
    assert response.status_code == 200, f"Failed to create supplier: {response.text}"
    supplier = response.json()
    assert supplier["dealer_code"] == "SUPPLIER-002"
    print("Registered Supplier: SUPPLIER-002")

    # Scrap Dealer
    scrap_data = {
        "category": "scrap_dealer",
        "name": "Bob Metal Scrap",
        "company_name": "Bob's Recycling",
        "dealer_code": "SCRAP-003",
        "email": "bob@bobsrecycling.com",
        "contact_number": "+1234567892",
        "address": "789 Dump Rd, Scrap Town",
        "gst_number": "29CCCCC3333C3Z3",
        "custom_fields": None
    }
    response = client.post("/api/dealers/", json=scrap_data, headers=headers)
    assert response.status_code == 200
    print("Registered Scrap Dealer: SCRAP-003")

    # 5. Check uniqueness constraint on dealer_code
    print("\nTesting duplicate Dealer Code validation...")
    duplicate_data = {
        "category": "supplier",
        "name": "Duplicate Supplier",
        "company_name": "Duplicate Co",
        "dealer_code": "SUBCON-001",  # Same as subcon_data
        "email": "duplicate@dup.com"
    }
    response = client.post("/api/dealers/", json=duplicate_data, headers=headers)
    assert response.status_code == 400, "Should have failed with status 400 for duplicate dealer code"
    assert "Dealer Code already exists" in response.json()["detail"]
    print("Duplicate validation passed successfully (correctly rejected)")

    # 6. List and Filter by Category
    print("\nTesting list filtering by category...")
    
    # List all
    response = client.get("/api/dealers/", headers=headers)
    assert response.status_code == 200
    all_dealers = response.json()
    assert len(all_dealers) == 3, f"Expected 3 dealers, got {len(all_dealers)}"
    print(f"Listed all dealers: got {len(all_dealers)} records")

    # Filter to sub_contractor
    response = client.get("/api/dealers/?category=sub_contractor", headers=headers)
    assert response.status_code == 200
    filtered = response.json()
    assert len(filtered) == 1
    assert filtered[0]["dealer_code"] == "SUBCON-001"
    print("Filter by sub_contractor passed")

    # 7. Delete Custom Field Template
    print("\nTesting custom field template deletion...")
    response = client.delete(f"/api/dealers/custom-fields/{cf2['id']}", headers=headers)
    assert response.status_code == 200
    
    response = client.get("/api/dealers/custom-fields", headers=headers)
    assert response.status_code == 200
    remaining_fields = response.json()
    assert len(remaining_fields) == 4
    assert not any(f["id"] == cf2["id"] for f in remaining_fields)
    print("Delete custom field template passed")

    # 8. Verify Dealer Deletion
    print("\nTesting dealer deletion...")
    delete_id = subcon["id"]
    response = client.delete(f"/api/dealers/{delete_id}", headers=headers)
    assert response.status_code == 200
    print(f"Deleted sub contractor with ID: {delete_id}")

    # Check that deleted dealer is not returned
    response = client.get("/api/dealers/", headers=headers)
    assert response.status_code == 200
    current_dealers = response.json()
    assert len(current_dealers) == 2, f"Expected 2 remaining dealers, got {len(current_dealers)}"
    assert not any(d["id"] == delete_id for d in current_dealers)
    print("Deletion verification passed")

    # 9. Check Audit Logs
    print("\nChecking Audit Logs for dealer and custom field actions...")
    with Session(engine) as session:
        logs = session.exec(select(AuditLog).where(AuditLog.entity_type == "Dealer")).all()
        actions = [log.action for log in logs]
        print(f"Audit log actions recorded for 'Dealer': {actions}")
        assert "create" in actions
        assert "delete" in actions
        
        # Verify custom field logs
        cf_logs = session.exec(select(AuditLog).where(AuditLog.entity_type == "DealerCustomField")).all()
        cf_actions = [log.action for log in cf_logs]
        print(f"Audit log actions recorded for 'DealerCustomField': {cf_actions}")
        assert "create" in cf_actions
        assert "update" in cf_actions
        assert "delete" in cf_actions
        print("Audit logging validation passed successfully")

    # Clean up test database
    engine.dispose()
    if os.path.exists(sqlite_file_name):
        os.remove(sqlite_file_name)
    print("\nAll dealers API and custom fields tests passed successfully!")

if __name__ == "__main__":
    test_dealers_flow()
