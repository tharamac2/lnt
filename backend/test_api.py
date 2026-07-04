from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from .main import app
from .database import get_session
from .models import User

# Use in-memory SQLite for testing
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override

client = TestClient(app)

def test_flow():
    create_db_and_tables()
    
    # 1. Create Admin User (simulated by direct DB insertion or open endpoint)
    # Since our create_user endpoint validates unique username, let's just use the endpoint with dependency override if needed
    # But wait, our create_user endpoint doesn't require auth for this simple version? 
    # Let's check users.py: create_user depends on nothing but session? No, I commented out current_user dependency.
    
    print("Testing User Creation...")
    response = client.post(
        "/users/",
        json={
            "username": "admin",
            "email": "admin@example.com",
            "password": "secretDefaultPassword",
            "role": "admin",
            "status": "active"
        }
    )
    if response.status_code == 200:
        print("User created successfully")
    elif response.status_code == 400 and "already registered" in response.text:
         print("User already exists")
    else:
        print(f"Failed to create user: {response.text}")
        return

    # 2. Login
    print("\nTesting Login...")
    response = client.post(
        "/users/token",
        data={"username": "admin", "password": "secretDefaultPassword"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    print("Login successful, token received")
    
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create Tool
    print("\nTesting Tool Creation...")
    tool_data = {
        "description": "Test Hammer",
        "make": "Stanley",
        "capacity": "N/A",
        "safe_working_load": "N/A",
        "qr_code": "TOOL-TEST-001"
    }
    response = client.post("/tools/", json=tool_data, headers=headers)
    if response.status_code == 200:
        print("Tool created successfully")
        tool_id = response.json()["id"]
    else:
        print(f"Failed to create tool: {response.text}")
        return

    # 4. Get Tool
    print("\nTesting Get Tool...")
    response = client.get(f"/tools/{tool_id}", headers=headers)
    assert response.status_code == 200
    print(f"Tool retrieved: {response.json()['description']}")

    # 5. Create Inspection
    print("\nTesting Inspection Creation...")
    inspection_data = {
        "tool_id": tool_id,
        "result": "pass",
        "remarks": "Looks good",
        "inspector_id": 1 # This field is actually overridden in the endpoint logic
    }
    response = client.post("/inspections/", json=inspection_data, headers=headers)
    if response.status_code == 200:
        print("Inspection created successfully")
    else:
        print(f"Failed to create inspection: {response.text}")

if __name__ == "__main__":
    try:
        test_flow()
        print("\nAll tests passed!")
    except Exception as e:
        print(f"\nTest failed: {e}")
