from sqlmodel import Session, select
from .database import engine
from .models import User
from .auth import verify_password, get_password_hash

def debug_login(username, password):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            print(f"User '{username}' not found!")
            return

        print(f"Found user: {user.username}")
        print(f"Stored Hash: {user.hashed_password}")
        
        try:
            is_valid = verify_password(password, user.hashed_password)
            print(f"Password '{password}' valid? {is_valid}")
        except Exception as e:
            print(f"Verification failed with error: {e}")

        # Attempt to re-hash and update if needed
        new_hash = get_password_hash(password)
        print(f"New Hash for '{password}': {new_hash}")
        
        # Uncomment to reset password
        user.hashed_password = new_hash
        session.add(user)
        session.commit()
        print("Password reset to ensure compatibility.")

if __name__ == "__main__":
    debug_login("admin", "password123")
