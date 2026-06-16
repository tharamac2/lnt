from backend.database import engine
from sqlalchemy import text

def run_migration():
    print("Starting site spelling correction migration...")
    with engine.connect() as conn:
        # Update tool table
        res1 = conn.execute(text("UPDATE tool SET current_site = 'TIRUNELVELI' WHERE LOWER(TRIM(current_site)) IN ('tiruneveli', 'thirunelveli')"))
        res2 = conn.execute(text("UPDATE tool SET previous_site = 'TIRUNELVELI' WHERE LOWER(TRIM(previous_site)) IN ('tiruneveli', 'thirunelveli')"))
        res3 = conn.execute(text("UPDATE tool SET next_site = 'TIRUNELVELI' WHERE LOWER(TRIM(next_site)) IN ('tiruneveli', 'thirunelveli')"))
        
        # Update movementhistory table
        res4 = conn.execute(text("UPDATE movementhistory SET from_site = 'TIRUNELVELI' WHERE LOWER(TRIM(from_site)) IN ('tiruneveli', 'thirunelveli')"))
        res5 = conn.execute(text("UPDATE movementhistory SET to_site = 'TIRUNELVELI' WHERE LOWER(TRIM(to_site)) IN ('tiruneveli', 'thirunelveli')"))
        
        # Update alert table
        res6 = conn.execute(text("UPDATE alert SET site = 'TIRUNELVELI' WHERE LOWER(TRIM(site)) IN ('tiruneveli', 'thirunelveli')"))
        
        # Update auditlog table
        res7 = conn.execute(text("UPDATE auditlog SET site = 'TIRUNELVELI' WHERE LOWER(TRIM(site)) IN ('tiruneveli', 'thirunelveli')"))
        
        conn.commit()
        print("Site spelling correction migration completed successfully!")

if __name__ == "__main__":
    run_migration()
