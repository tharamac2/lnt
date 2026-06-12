from sqlmodel import Session, select
from .database import engine, create_db_and_tables
from .models import User, Tool, Inspection
from .auth import get_password_hash
from datetime import datetime

def seed_data():
    create_db_and_tables()
    with Session(engine) as session:
        # Create Admin User
        if not session.exec(select(User).where(User.username == "admin")).first():
            desc = "System Admin" # unused variable to match pattern
            admin_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("password123"),
                role="admin",
                full_name="System Admin",
                status="active"
            )
            session.add(admin_user)

        # Create Inspector
        if not session.exec(select(User).where(User.username == "inspector")).first():
            inspector = User(
                username="inspector",
                email="inspector@example.com",
                hashed_password=get_password_hash("password123"),
                role="inspector",
                full_name="Inspector Gadget",
                status="active"
            )
            session.add(inspector)
            
        # Create Store Manager
        if not session.exec(select(User).where(User.username == "store")).first():
            store = User(
                username="store",
                email="store@example.com",
                hashed_password=get_password_hash("password123"),
                role="store",
                full_name="Store Manager",
                status="active"
            )
            session.add(store)

        # Create Management
        if not session.exec(select(User).where(User.username == "management")).first():
            mgt = User(
                username="management",
                email="management@example.com",
                hashed_password=get_password_hash("password123"),
                role="management",
                full_name="Big Boss",
                status="active"
            )
            session.add(mgt)

        # Create Worker
        if not session.exec(select(User).where(User.username == "worker")).first():
            worker = User(
                username="worker",
                email="worker@example.com",
                hashed_password=get_password_hash("password123"),
                role="worker",
                full_name="Hard Worker",
                status="active"
            )
            session.add(worker)
        
        # Create Sample Tool
        if not session.exec(select(Tool).where(Tool.qr_code == "TOOL-SEED-001")).first():
            tool = Tool(
                description="Sample Chain Hoist",
                make="Yale",
                capacity="5 Tonnes",
                safe_working_load="5000 kg",
                qr_code="TOOL-SEED-001",
                status="usable",
                date_of_supply=datetime.now()
            )
            session.add(tool)

        session.commit()
        print("Database populated with initial data!")
        print("Users created: admin, inspector, store, management, worker")
        print("Password for all: password123")
        print("Tool: TOOL-SEED-001")

if __name__ == "__main__":
    seed_data()
