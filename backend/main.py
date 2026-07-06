import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables
from .routes import users, tools, inspections, alerts, upload, movements, export, audit, inspectors, toolconfig, dealers
from fastapi.staticfiles import StaticFiles

load_dotenv()

app = FastAPI(title="QR Code Tools Management API")

# Set ALLOWED_ORIGINS in backend/.env (comma-separated) on the live server -
# never hardcode allowed frontend origins in source.
_allowed_origins_env = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://lntqrcode.com,https://qrtool.centralindia.cloudapp.azure.com",
)
origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # NOTE: allow_origin_regex=".*" below currently permits any origin regardless
    # of the allow_origins list above - kept as-is to preserve existing behavior.
    # Remove it if you want ALLOWED_ORIGINS to actually restrict access.
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Run migrations for custom_fields column in dealer table (SQLite fallback)
    from .database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        # Drop unique indexes on email and create non-unique ones
        try:
            conn.execute(text("DROP INDEX IF EXISTS ix_user_email ON user"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_email ON user(email)"))
            conn.execute(text("DROP INDEX IF EXISTS ix_inspector_email ON inspector"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_inspector_email ON inspector(email)"))
            conn.commit()
            print("Migration: Successfully updated user/inspector email indexes to be non-unique.")
        except Exception as e:
            print(f"Migration error updating email indexes: {e}")

        # Correct misspelled site names to TIRUNELVELI (e.g. TIRUNEVELI, thirunelveli)
        try:
            conn.execute(text("UPDATE tool SET current_site = 'TIRUNELVELI' WHERE LOWER(TRIM(current_site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.execute(text("UPDATE tool SET previous_site = 'TIRUNELVELI' WHERE LOWER(TRIM(previous_site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.execute(text("UPDATE tool SET next_site = 'TIRUNELVELI' WHERE LOWER(TRIM(next_site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.execute(text("UPDATE movementhistory SET from_site = 'TIRUNELVELI' WHERE LOWER(TRIM(from_site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.execute(text("UPDATE movementhistory SET to_site = 'TIRUNELVELI' WHERE LOWER(TRIM(to_site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.execute(text("UPDATE alert SET site = 'TIRUNELVELI' WHERE LOWER(TRIM(site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.execute(text("UPDATE auditlog SET site = 'TIRUNELVELI' WHERE LOWER(TRIM(site)) IN ('tiruneveli', 'thirunelveli')"))
            conn.commit()
            print("Migration: Successfully updated misspelled site names to TIRUNELVELI.")
        except Exception as e:
            print(f"Migration error updating site names: {e}")
        try:
            conn.execute(text("SELECT custom_fields FROM tool LIMIT 1"))
        except Exception:
            try:
                # SQLite ALTER TABLE support
                conn.execute(text("ALTER TABLE tool ADD COLUMN custom_fields TEXT"))
                conn.commit()
                print("Migration: Successfully added 'custom_fields' column to 'tool' table.")
            except Exception as e:
                print(f"Migration error adding 'custom_fields' column to 'tool' table: {e}")

        try:
            conn.execute(text("SELECT custom_fields FROM dealer LIMIT 1"))
        except Exception:
            try:
                # SQLite ALTER TABLE support
                conn.execute(text("ALTER TABLE dealer ADD COLUMN custom_fields TEXT"))
                conn.commit()
                print("Migration: Successfully added 'custom_fields' column to 'dealer' table.")
            except Exception as e:
                print(f"Migration error adding 'custom_fields' column: {e}")
        
        try:
            conn.execute(text("SELECT options FROM dealercustomfield LIMIT 1"))
        except Exception:
            try:
                # SQLite ALTER TABLE support
                conn.execute(text("ALTER TABLE dealercustomfield ADD COLUMN options TEXT"))
                conn.commit()
                print("Migration: Successfully added 'options' column to 'dealercustomfield' table.")
            except Exception as e:
                print(f"Migration error adding 'options' column to 'dealercustomfield' table: {e}")

        try:
            conn.execute(text("SELECT products_services FROM dealer LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE dealer ADD COLUMN products_services TEXT"))
                conn.commit()
                print("Migration: Successfully added 'products_services' column to 'dealer' table.")
            except Exception as e:
                print(f"Migration error adding 'products_services' column: {e}")

        try:
            conn.execute(text("SELECT status FROM dealer LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE dealer ADD COLUMN status VARCHAR DEFAULT 'active'"))
                conn.commit()
                print("Migration: Successfully added 'status' column to 'dealer' table.")
            except Exception as e:
                print(f"Migration error adding 'status' column: {e}")

        try:
            conn.execute(text("SELECT pending_return_date FROM tool LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE tool ADD COLUMN pending_return_date DATETIME"))
                conn.commit()
                print("Migration: Successfully added 'pending_return_date' column to 'tool' table.")
            except Exception as e:
                print(f"Migration error adding 'pending_return_date' column: {e}")

        try:
            conn.execute(text("SELECT pending_reason FROM tool LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE tool ADD COLUMN pending_reason TEXT"))
                conn.commit()
                print("Migration: Successfully added 'pending_reason' column to 'tool' table.")
            except Exception as e:
                print(f"Migration error adding 'pending_reason' column: {e}")

# Mount uploads directory to serve files
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(users.router, prefix="/api")
app.include_router(tools.router, prefix="/api")
app.include_router(inspections.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(movements.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(inspectors.router, prefix="/api")
app.include_router(toolconfig.router, prefix="/api")
app.include_router(dealers.router, prefix="/api")

@app.get("/system/ip")
def get_local_ip():
    import socket
    try:
        # Connect to an external server (doesn't actually send data) to get the interface IP used for routing
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return {"ip": local_ip}
    except Exception:
        return {"ip": "localhost"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the QR Code Tools Management System API"}
