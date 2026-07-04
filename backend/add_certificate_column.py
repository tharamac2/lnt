from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

DATABASE_URL = "mysql+pymysql://root:@localhost:3306/qr_tools_db"
engine = create_engine(DATABASE_URL)

def add_column():
    with engine.connect() as conn:
        try:
            sql = text("ALTER TABLE tool ADD COLUMN test_certificate VARCHAR(255)")
            conn.execute(sql)
            print("Successfully added 'test_certificate' column to 'tool' table.")
        except OperationalError as e:
            if "Duplicate column" in str(e):
                print("Column 'test_certificate' already exists.")
            else:
                print(f"Error adding column: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    add_column()
