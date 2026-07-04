from sqlmodel import Session, select
from backend.database import engine
from backend.models import User

def rename_admin():
    with Session(engine) as session:
        # Find user Madhavan
        statement = select(User).where(User.username == "Madhavan")
        user = session.exec(statement).first()
        
        if user:
            print("Found user 'Madhavan'. Renaming to 'admin'...")
            user.username = "admin"
            user.full_name = "Admin"
            session.add(user)
            session.commit()
            session.refresh(user)
            print("Successfully renamed to 'admin'.")
        else:
            print("User 'Madhavan' not found. Checking if 'admin' already exists...")
            statement = select(User).where(User.username == "admin")
            admin_user = session.exec(statement).first()
            if admin_user:
                 print("User 'admin' already exists. No action needed.")
            else:
                 print("Neither 'Madhavan' nor 'admin' found. You might need to run restore_users.py")

if __name__ == "__main__":
    rename_admin()
