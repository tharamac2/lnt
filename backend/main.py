from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables
from .routes import users, tools, inspections, alerts, upload, movements, export, audit, inspectors, toolconfig, dealers
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="QR Code Tools Management API")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://lntqrcode.com"
    "https://qrtool.centralindia.cloudapp.azure.com",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

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
