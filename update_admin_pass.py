from sqlmodel import Session, select
from backend.database import engine
from backend.models import User
from backend.auth import get_password_hash

with Session(engine) as session:
    admin = session.exec(select(User).where(User.username == 'admin')).first()
    if admin:
        admin.hashed_password = get_password_hash('Admin@1234')
        session.add(admin)
        session.commit()
        print("Admin password successfully updated to Admin@1234")
    else:
        print("Admin user not found!")
