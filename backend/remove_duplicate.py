from sqlmodel import Session, select
from backend.database import engine
from backend.models import User

def remove_duplicate():
    with Session(engine) as session:
        # Delete user with email 'madhavan@gmail.com' if 'admin@example.com' exists
        statement = select(User).where(User.email == 'madhavan@gmail.com')
        user_to_delete = session.exec(statement).first()
        
        if user_to_delete:
            print(f"Deleting duplicate user: {user_to_delete.username} ({user_to_delete.email})")
            session.delete(user_to_delete)
            session.commit()
            print("Deleted.")
        else:
            print("No duplicate 'madhavan@gmail.com' found.")

if __name__ == "__main__":
    remove_duplicate()
