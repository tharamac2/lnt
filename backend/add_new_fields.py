import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import create_engine, text
from backend.database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE tool ADD COLUMN metal_type VARCHAR(255) NOT NULL DEFAULT '';"))
        print("Added metal_type")
    except Exception as e:
        print(f"Error adding metal_type: {e}")
        
    try:
        conn.execute(text("ALTER TABLE tool ADD COLUMN tool_variant VARCHAR(255) NOT NULL DEFAULT '';"))
        print("Added tool_variant")
    except Exception as e:
        print(f"Error adding tool_variant: {e}")

    try:
        conn.execute(text("ALTER TABLE tool ADD COLUMN item_code VARCHAR(255);"))
        print("Added item_code")
    except Exception as e:
        print(f"Error adding item_code: {e}")
