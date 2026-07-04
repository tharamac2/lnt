from sqlmodel import Session, select
from backend.database import engine
from backend.models import User
from backend.auth import get_password_hash

def fix_all_users():
    users_to_fix = [
        {"username": "admin", "role": "admin", "email": "admin@example.com"},
        {"username": "inspector", "role": "inspector", "email": "inspector@example.com"},
        {"username": "worker", "role": "worker", "email": "worker@example.com"},
        {"username": "store", "role": "store", "email": "store@example.com"},
        {"username": "management", "role": "management", "email": "management@example.com"},
    ]
    
    pwd_hash = get_password_hash("Admin@1234")
    
    with Session(engine) as session:
        for user_info in users_to_fix:
            statement = select(User).where(User.username == user_info["username"])
            user = session.exec(statement).first()
            
            if user:
                print(f"Updating password for '{user_info['username']}'...")
                user.hashed_password = pwd_hash
                user.role = user_info["role"] # Ensure role is correct
                session.add(user)
            else:
                print(f"Creating user '{user_info['username']}'...")
                # Check email conflict
                email_stmt = select(User).where(User.email == user_info["email"])
                email_conflict = session.exec(email_stmt).first()
                if email_conflict:
                    print(f"  Removing conflict for email {user_info['email']}")
                    session.delete(email_conflict)
                    session.commit()
                
                new_user = User(
                    username=user_info["username"],
                    email=user_info["email"],
                    full_name=user_info["username"].capitalize(),
                    role=user_info["role"],
                    hashed_password=pwd_hash,
                    status="active"
                )
                session.add(new_user)
        
        session.commit()
        print("\n=== CREDENTIALS UPDATED ===")
        print("All passwords set to: 'Admin@1234'")
        print("---------------------------")
        for u in users_to_fix:
            print(f"Role: {u['role'].ljust(10)} | Username: {u['username']}")

if __name__ == "__main__":
    fix_all_users()
