from sqlmodel import Session, select
from .database import engine, create_db_and_tables
from .models import User, Tool, Inspection

def list_all_data():
    try:
        with Session(engine) as session:
            print("\n--- Users ---")
            users = session.exec(select(User)).all()
            if not users:
                print("No users found.")
            for user in users:
                print(f"ID: {user.id}, Username: {user.username}, Role: {user.role}")

            print("\n--- Tools ---")
            tools = session.exec(select(Tool)).all()
            if not tools:
                print("No tools found.")
            for tool in tools:
                print(f"ID: {tool.id}, Description: {tool.description}, QR: {tool.qr_code}")

            print("\n--- Inspections ---")
            inspections = session.exec(select(Inspection)).all()
            if not inspections:
                print("No inspections found.")
            for insp in inspections:
                print(f"ID: {insp.id}, ToolID: {insp.tool_id}, Result: {insp.result}")

    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("Make sure your .env file is correct and MySQL is running.")

if __name__ == "__main__":
    list_all_data()
