from sqlmodel import create_engine, Session, SQLModel

# Connect to the local MySQL database
DATABASE_URL = "mysql+pymysql://root:@localhost/lnt qr code.db"

engine = create_engine(DATABASE_URL, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
