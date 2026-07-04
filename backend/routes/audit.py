from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlmodel import Session, select
from ..database import get_session
from ..models import AuditLog, AuditLogRead, User
from ..auth import get_current_user

router = APIRouter(prefix="/audit-logs", tags=["audit"])

@router.get("/", response_model=List[AuditLogRead])
def read_audit_logs(
    offset: int = 0,
    limit: int = 5000,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[int] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view audit logs")

    statement = select(AuditLog).order_by(AuditLog.timestamp.desc())
    if action:
        statement = statement.where(AuditLog.action == action)
    if entity_type:
        statement = statement.where(AuditLog.entity_type == entity_type)
    if user_id:
        statement = statement.where(AuditLog.user_id == user_id)
    if search:
        statement = statement.where(
            AuditLog.description.contains(search) | AuditLog.username.contains(search)
        )

    statement = statement.offset(offset).limit(limit)
    return session.exec(statement).all()
