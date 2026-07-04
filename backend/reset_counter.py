import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import create_engine, text
from backend.database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    try:
        # First, clear any existing foreign key checks so we can truncate
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        conn.execute(text("TRUNCATE TABLE movementhistory;"))
        conn.execute(text("TRUNCATE TABLE inspection;"))
        conn.execute(text("TRUNCATE TABLE alert;"))
        conn.execute(text("TRUNCATE TABLE tool;"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        print("Successfully reset tools and AUTO_INCREMENT counter to 1.")
    except Exception as e:
        print(f"Error resetting: {e}")
