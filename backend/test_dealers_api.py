from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from backend.main import app
from backend.database import get_session
from backend.models import User, Dealer, AuditLog
import os

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

    # 3. Create Dealers manually
    print("\nTesting manual dealer registration...")
    
    # Sub Contractor
    subcon_data = {
        "category": "sub_contractor",
        "name": "John Doe Subcon",
        "company_name": "Doe Construction Ltd",
        "dealer_code": "SUBCON-001",
        "email": "john.doe@doecon.com",
        "contact_number": "+1234567890",
        "address": "123 Main St, Builder Town",
        "gst_number": "29AAAAA1111A1Z1"
    }
    response = client.post("/api/dealers/", json=subcon_data, headers=headers)
    assert response.status_code == 200, f"Failed to create sub contractor: {response.text}"
    subcon = response.json()
    assert subcon["dealer_code"] == "SUBCON-001"
    assert subcon["category"] == "sub_contractor"
    print("Registered Sub Contractor: SUBCON-001")

    # Supplier
    supplier_data = {
        "category": "supplier",
        "name": "Jane Cement Supplier",
        "company_name": "Cement Supply Corp",
        "dealer_code": "SUPPLIER-002",
        "email": "jane@cementsupply.com",
        "contact_number": "+1234567891",
        "address": "456 Bulk Ave, Supply City",
        "gst_number": "29BBBBB2222B2Z2"
    }
    response = client.post("/api/dealers/", json=supplier_data, headers=headers)
    assert response.status_code == 200, f"Failed to create supplier: {response.text}"
    supplier = response.json()
    assert supplier["dealer_code"] == "SUPPLIER-002"
    assert supplier["category"] == "supplier"
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
        "gst_number": "29CCCCC3333C3Z3"
    }
    response = client.post("/api/dealers/", json=scrap_data, headers=headers)
    assert response.status_code == 200, f"Failed to create scrap dealer: {response.text}"
    scrap = response.json()
    assert scrap["dealer_code"] == "SCRAP-003"
    assert scrap["category"] == "scrap_dealer"
    print("Registered Scrap Dealer: SCRAP-003")

    # 4. Check uniqueness constraint on dealer_code
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

    # 5. List and Filter by Category
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

    # Filter to scrap_dealer
    response = client.get("/api/dealers/?category=scrap_dealer", headers=headers)
    assert response.status_code == 200
    filtered = response.json()
    assert len(filtered) == 1
    assert filtered[0]["dealer_code"] == "SCRAP-003"
    print("Filter by scrap_dealer passed")

    # 6. Verify Deletion
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

    # 7. Check Audit Logs
    print("\nChecking Audit Logs for dealer actions...")
    with Session(engine) as session:
        logs = session.exec(select(AuditLog).where(AuditLog.entity_type == "Dealer")).all()
        # Should have: 3 creations + 1 deletion = 4 log entries?
        # Actually: subcon (create), supplier (create), scrap (create), subcon (delete).
        # Plus any bulk import if any, but we did manual.
        # Let's print out what actions we find.
        actions = [log.action for log in logs]
        print(f"Audit log actions recorded for 'Dealer': {actions}")
        assert "create" in actions
        assert "delete" in actions
        
        # Verify description details
        create_logs = [log for log in logs if log.action == "create"]
        delete_logs = [log for log in logs if log.action == "delete"]
        assert len(create_logs) == 3
        assert len(delete_logs) == 1
        print("Audit logging validation passed successfully")

    # Clean up test database
    engine.dispose()
    if os.path.exists(sqlite_file_name):
        os.remove(sqlite_file_name)
    print("\nAll dealers API tests passed successfully!")

if __name__ == "__main__":
    test_dealers_flow()
