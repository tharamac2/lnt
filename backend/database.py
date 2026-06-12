from sqlmodel import create_engine, Session, SQLModel

# Use SQLite instead of MySQL for local testing
DATABASE_URL = "sqlite:///./qr_tools_db.db"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
