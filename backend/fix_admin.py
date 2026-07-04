from sqlmodel import Session, select
from backend.database import engine
from backend.models import User
from backend.auth import get_password_hash

def fix_admin():
    with Session(engine) as session:
        # 1. Find and delete 'Madhavan' if exists
        statement = select(User).where(User.username == "Madhavan")
        old_user = session.exec(statement).first()
        if old_user:
            print(f"Deleting old user: {old_user.username}")
            session.delete(old_user)
            session.commit()
        
        # 2. Ensure 'admin' exists
        statement = select(User).where(User.username == "admin")
        admin_user = session.exec(statement).first()
        
        pwd_hash = get_password_hash("Admin@1234")
        
        if admin_user:
            print("Updating 'admin' password...")
            admin_user.hashed_password = pwd_hash
            session.add(admin_user)
        else:
            print("Creating 'admin' user...")
            # Check if email is taken by someone else (unlikely if we deleted Madhavan, but safe check)
            statement = select(User).where(User.email == "admin@example.com")
            email_conflict = session.exec(statement).first()
            if email_conflict:
                print(f"Email conflict with {email_conflict.username}. Deleting conflicting user...")
                session.delete(email_conflict)
                session.commit()

            admin_user = User(
                username="admin",
                email="admin@example.com",
                full_name="Admin",
                role="admin",
                hashed_password=pwd_hash,
                status="active"
            )
            session.add(admin_user)
        
        session.commit()
        print("Admin user fixed. Username: 'admin', Password: 'Admin@1234'")

if __name__ == "__main__":
    fix_admin()
