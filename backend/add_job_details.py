from sqlmodel import Session, text
from backend.database import engine

def add_job_details_columns():
    with Session(engine) as session:
        # Check if columns exist
        try:
            session.exec(text("SELECT job_code FROM tool LIMIT 1"))
            print("Column 'job_code' already exists.")
        except Exception:
            print("Adding 'job_code' column...")
            session.exec(text("ALTER TABLE tool ADD COLUMN job_code VARCHAR(255)"))
            session.commit()
            print("Added 'job_code' column.")

        try:
            session.exec(text("SELECT job_description FROM tool LIMIT 1"))
            print("Column 'job_description' already exists.")
        except Exception:
            print("Adding 'job_description' column...")
            session.exec(text("ALTER TABLE tool ADD COLUMN job_description TEXT"))
            session.commit()
            print("Added 'job_description' column.")

if __name__ == "__main__":
    add_job_details_columns()
