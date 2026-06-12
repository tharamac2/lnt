import sqlite3
import os

db_path = "tools_management.db"

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    # Try looking in current dir if running from root
    if os.path.exists("database.db"):
        db_path = "database.db"

print(f"Migrating database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Print all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables found:", tables)

    # Check if column exists
    cursor.execute("PRAGMA table_info(user)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "phone" in columns:
        print("Column 'phone' already exists in 'user' table.")
    else:
        print("Adding 'phone' column to 'user' table...")
        cursor.execute("ALTER TABLE user ADD COLUMN phone VARCHAR")
        conn.commit()
        print("Migration successful.")
        
    conn.close()
except Exception as e:
    print(f"Error during migration: {e}")
