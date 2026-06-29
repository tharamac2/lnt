from sqlmodel import Session, SQLModel, create_engine, text
from backend.database import engine, DATABASE_URL
from backend.models import User, Tool, Inspection, Alert
from backend.auth import get_password_hash

def reset_database():
    print("Resetting database...")
    
    # Drop all tables
    SQLModel.metadata.drop_all(engine)
    print("All tables dropped.")

    # Create all tables
    SQLModel.metadata.create_all(engine)
    print("All tables recreated.")

    # Seed default admin user
    with Session(engine) as session:
        admin_user = User(
            username="admin",
            email="tharamac2@gmail.com",
            phone="9123585284",
            full_name="System Admin",
            role="admin",
            hashed_password=get_password_hash("Admin@1234"),
            status="active"
        )
        session.add(admin_user)
        session.commit()
        print("Default admin user created: admin / Admin@1234 (email: tharamac2@gmail.com, phone: 9123585284)")

if __name__ == "__main__":
    reset_database()
