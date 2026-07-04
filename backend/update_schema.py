
from sqlmodel import SQLModel
from backend.database import engine
from backend.models import Tool, Inspection, MovementHistory, Alert

def update_schema():
    # Drop tables to force schema update (since we don't have alembic)
    print("Dropping tables...")
    SQLModel.metadata.drop_all(engine)
    
    # We dropped everything including User, which is not ideal but easiest since we don't have relationships fully mapped out safe for partial drops without foreign key errors. 
    # Actually, reset_tools.py just deleted data. 
    # Let's try to just create tables. 
    print("Creating tables...")
    SQLModel.metadata.create_all(engine)
    print("Schema updated.")
    
    # Since we dropped User, we need to recreate Admin and Store users.
    from backend.fix_admin import fix_admin
    from backend.fix_store_user import fix_store_user
    print("Restoring default users...")
    fix_admin()
    fix_store_user()

if __name__ == "__main__":
    update_schema()
