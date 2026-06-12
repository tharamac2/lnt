from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    full_name: Optional[str] = None
    role: str = "worker" # admin, store, inspector, management, worker, data_entry
    site: Optional[str] = None
    phone: Optional[str] = None
    status: str = "active"

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

class UserCreate(UserBase):
    password: str

class UserUpdate(SQLModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    site: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None

class UserRead(UserBase):
    id: int

class ToolBase(SQLModel):
    description: str
    make: str
    capacity: str
    safe_working_load: str
    tool_type: str = Field(default="Erection Tools") # Erection Tools, Stringing Tools
    metal_type: str
    tool_variant: str
    item_code: Optional[str] = None
    purchaser_name: Optional[str] = None
    purchaser_contact: Optional[str] = None
    supplier_code: Optional[str] = None # Added for custom ID generation
    test_certificate: Optional[str] = None # Path to uploaded file
    date_of_supply: Optional[datetime] = None
    last_inspection_date: Optional[datetime] = None
    inspection_result: str = "usable" # usable, not-usable
    usability_percentage: Optional[float] = None
    validity_period: Optional[int] = None
    subcontractor_name: Optional[str] = None
    subcontractor_code: Optional[str] = None
    subcontractor_mobile: Optional[str] = None
    remarks: Optional[str] = None
    previous_site: Optional[str] = None
    current_site: Optional[str] = None
    next_site: Optional[str] = None
    job_code: Optional[str] = None
    job_description: Optional[str] = None
    qr_code: str = Field(index=True, unique=True)
    status: str = "usable" # usable, scrap
    expiry_date: Optional[datetime] = None
    debit_to: Optional[str] = None
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Tool(ToolBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inspections: List["Inspection"] = Relationship(back_populates="tool")
    movements: List["MovementHistory"] = Relationship(back_populates="tool")
    creator: Optional["User"] = Relationship()

class ToolCreate(ToolBase):
    pass

class ToolRead(ToolBase):
    id: int

class ToolReadWithCreator(ToolRead):
    creator: Optional[UserRead] = None

class ToolUpdate(SQLModel):
    description: Optional[str] = None
    make: Optional[str] = None
    capacity: Optional[str] = None
    safe_working_load: Optional[str] = None
    tool_type: Optional[str] = None
    metal_type: Optional[str] = None
    tool_variant: Optional[str] = None
    item_code: Optional[str] = None
    current_site: Optional[str] = None
    status: Optional[str] = None
    subcontractor_name: Optional[str] = None
    subcontractor_code: Optional[str] = None
    subcontractor_mobile: Optional[str] = None
    job_code: Optional[str] = None
    job_description: Optional[str] = None
    remarks: Optional[str] = None
    previous_site: Optional[str] = None
    next_site: Optional[str] = None
    expiry_date: Optional[datetime] = None
    validity_period: Optional[int] = None
    date_of_supply: Optional[datetime] = None
    debit_to: Optional[str] = None

class InspectionBase(SQLModel):
    tool_id: int = Field(foreign_key="tool.id")
    date: datetime = Field(default_factory=datetime.now)
    result: str # pass, conditional, fail
    usability_percentage: Optional[float] = None
    remarks: Optional[str] = None
    photos: Optional[str] = None # Comma separated URLs or JSON string
    inspector_id: int = Field(foreign_key="user.id")

class Inspection(InspectionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tool: Optional[Tool] = Relationship(back_populates="inspections")
    inspector: Optional[User] = Relationship()

class InspectionCreate(InspectionBase):
    inspector_id: Optional[int] = None

class InspectionRead(InspectionBase):
    id: int

class InspectionReadWithTool(InspectionRead):
    tool: Optional[ToolRead] = None
    inspector: Optional[UserRead] = None

class AlertBase(SQLModel):
    type: str # new-tool, expired, maintenance-due
    severity: str # info, warning, critical
    title: str
    message: str
    tool_id: Optional[int] = Field(default=None, foreign_key="tool.id")
    site: Optional[str] = None
    date: datetime = Field(default_factory=datetime.now)
    is_read: bool = False
    is_resolved: bool = False

class Alert(AlertBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tool: Optional[Tool] = Relationship()

class AlertCreate(AlertBase):
    pass

class AlertRead(AlertBase):
    id: int
    tool: Optional[ToolRead] = None

class MovementHistoryBase(SQLModel):
    tool_id: int = Field(foreign_key="tool.id")
    from_site: Optional[str] = None
    to_site: Optional[str] = None # Current site
    timestamp: datetime = Field(default_factory=datetime.now)
    remarks: Optional[str] = None
    user_id: Optional[int] = Field(default=None, foreign_key="user.id") # Who performed the action

class MovementHistory(MovementHistoryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tool: Optional[Tool] = Relationship(back_populates="movements")
    user: Optional[User] = Relationship()

class MovementHistoryRead(MovementHistoryBase):
    id: int
    user: Optional[UserRead] = None
    tool: Optional[ToolRead] = None
