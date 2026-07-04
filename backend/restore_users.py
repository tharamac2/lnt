from sqlmodel import Session, select
from backend.database import engine
from backend.models import User
from backend.auth import get_password_hash

def restore_users():
    with Session(engine) as session:
        # Default password for everyone
        pwd_hash = get_password_hash("Admin@1234")
        
        users_to_ensure = [
            {"username": "admin", "role": "admin", "email": "admin@example.com"},
            {"username": "inspector", "role": "inspector", "email": "inspector@example.com"},
            {"username": "store", "role": "store", "email": "store@example.com"},
            {"username": "management", "role": "management", "email": "management@example.com"}
        ]
        
        print("Restoring/Resetting Users with password 'Admin@1234'...")
        
        for u_data in users_to_ensure:
            # Check if user exists by username OR email (to be safe)
            statement = select(User).where(User.username == u_data["username"])
            user = session.exec(statement).first()
            
            if not user:
                # Try finding by email just in case
                statement = select(User).where(User.email == u_data["email"])
                user = session.exec(statement).first()

            if user:
                print(f"Updating existing user: {user.username}")
                user.hashed_password = pwd_hash
                user.role = u_data["role"]
                # user.email = u_data["email"] # Optional: standardize emails?
                session.add(user)
            else:
                print(f"Creating missing user: {u_data['username']}")
                new_user = User(
                    username=u_data["username"],
                    email=u_data["email"],
                    full_name=u_data["username"].capitalize(),
                    role=u_data["role"],
                    hashed_password=pwd_hash,
                    status="active"
                )
                session.add(new_user)
        
        session.commit()
        print("\nAll 4 users are ready.")
        print("Password for all: Admin@1234")

if __name__ == "__main__":
    restore_users()
