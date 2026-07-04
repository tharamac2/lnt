from sqlmodel import Session, create_engine, text

# Database URL
sqlite_url = "mysql+pymysql://root:@localhost/qr_tools_db"
engine = create_engine(sqlite_url)

def add_debit_to_column():
    with Session(engine) as session:
        try:
            # Check if column exists
            session.exec(text("SELECT debit_to FROM tool LIMIT 1"))
            print("Column 'debit_to' already exists.")
        except Exception:
            print("Adding 'debit_to' column...")
            try:
                session.exec(text("ALTER TABLE tool ADD COLUMN debit_to VARCHAR(255) NULL"))
                session.commit()
                print("Successfully added 'debit_to' column.")
            except Exception as e:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_debit_to_column()
