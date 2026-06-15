from sqlalchemy import text
from database import engine

def add_column():
    with engine.connect() as conn:
        try:
            # SQLite does not support DUPLICATE column checks in ALTER directly,
            # so we try to execute the alter and catch errors if column already exists.
            sql = text("ALTER TABLE toolconfig ADD COLUMN is_verified BOOLEAN DEFAULT 0")
            conn.execute(sql)
            # SQLite connection.commit() is needed or handled by transaction context
            print("Successfully added 'is_verified' column to 'toolconfig' table.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("Column 'is_verified' already exists in 'toolconfig'.")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_column()
