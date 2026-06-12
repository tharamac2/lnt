
from sqlmodel import Session, select
from backend.database import engine
from backend.models import User
from backend.auth import get_password_hash

def fix_store_user():
    with Session(engine) as session:
        username = "store"
        password = "Admin@1234"
        
        statement = select(User).where(User.username == username)
        user = session.exec(statement).first()
        
        pwd_hash = get_password_hash(password)
        
        if user:
            print(f"Updating '{username}' password...")
            user.hashed_password = pwd_hash
            session.add(user)
        else:
            print(f"Creating '{username}' user...")
            user = User(
                username=username,
                email="store@example.com",
                full_name="Store Manager",
                role="store",
                hashed_password=pwd_hash,
                status="active",
                site="Main Store"
            )
            session.add(user)
        
        session.commit()
        print(f"User fixed. Username: '{username}', Password: '{password}'")

if __name__ == "__main__":
    fix_store_user()
