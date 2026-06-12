from sqlmodel import create_engine, Session, SQLModel

# DATABASE CONNECTION STRING
# XAMPP Default: user='root', password='' (empty)
DATABASE_URL = "mysql+pymysql://root:@localhost:3306/qr_tools_db"

engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
