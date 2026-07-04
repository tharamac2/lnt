
from sqlmodel import Session, delete
from backend.database import engine
from backend.models import Tool, Inspection, MovementHistory, Alert

def reset_tools_data():
    with Session(engine) as session:
        # Delete dependent data first
        print("Deleting Inspections...")
        session.exec(delete(Inspection))
        
        print("Deleting Movement History...")
        session.exec(delete(MovementHistory))
        
        print("Deleting Alerts...")
        session.exec(delete(Alert))
        
        # Delete Tools
        print("Deleting Tools...")
        session.exec(delete(Tool))
        
        session.commit()
        print("All tool data has been reset successfully.")

if __name__ == "__main__":
    reset_tools_data()
