from sqlmodel import Session, select, delete
from backend.database import engine
from backend.models import User, Tool, Inspection, Alert, MovementHistory

def clear_data():
    print("Connecting to the database...")
    with Session(engine) as session:
        # Delete dependent tables first
        print("Deleting Alerts...")
        session.exec(delete(Alert))
        
        print("Deleting Inspections...")
        session.exec(delete(Inspection))
        
        print("Deleting Movement Histories...")
        session.exec(delete(MovementHistory))
        
        # Delete tools
        print("Deleting Tools...")
        session.exec(delete(Tool))
        
        # Delete non-admin users
        print("Deleting non-admin users...")
        statement = delete(User).where(User.role != "admin")
        session.exec(statement)
        
        session.commit()
        print("Database cleared successfully. Only admin users remain.")

if __name__ == "__main__":
    clear_data()
