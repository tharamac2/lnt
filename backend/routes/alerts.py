from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from ..database import get_session
from datetime import datetime, timedelta
from ..models import Alert, AlertCreate, AlertRead, User, Tool
from ..auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("/", response_model=List[AlertRead])
def read_alerts(
    skip: int = 0, 
    limit: int = 50, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch persistent alerts from DB
    statement = select(Alert).order_by(Alert.date.desc()).offset(skip).limit(limit)
    db_alerts = session.exec(statement).all()
    
    # 2. Generate dynamic alerts for Expiry
    now = datetime.now()
    thirty_days_later = now + timedelta(days=30)
    
    # A. Expired Tools (Critical)
    expired_tools = session.exec(
        select(Tool).where(
            Tool.expiry_date < now,
            Tool.status == "usable" # Only warn if still marked usable
        )
    ).all()
    
    dynamic_alerts = []
    
    for tool in expired_tools:
        alert = AlertRead(
            id=-(tool.id * 1000 + 1), # distinct negative ID
            type="expired",
            severity="critical",
            title="Tool Expired",
            message=f"Tool {tool.description} ({tool.qr_code}) expired on {tool.expiry_date.date() if tool.expiry_date else 'Unknown'}",
            tool_id=tool.id,
            site=tool.current_site,
            date=tool.expiry_date or now,
            is_read=False,
            is_resolved=False,
            tool=tool
        )
        dynamic_alerts.append(alert)
        
    # B. Expiring Soon (Warning)
    expiring_tools = session.exec(
        select(Tool).where(
            Tool.expiry_date >= now,
            Tool.expiry_date <= thirty_days_later,
            Tool.status == "usable"
        )
    ).all()
    
    for tool in expiring_tools:
        alert = AlertRead(
            id=-(tool.id * 1000 + 2), # distinct negative ID
            type="expiring_soon",
            severity="warning",
            title="Tool Expiring Soon",
            message=f"Tool {tool.description} ({tool.qr_code}) will expire on {tool.expiry_date.date() if tool.expiry_date else 'Unknown'}",
            tool_id=tool.id,
            site=tool.current_site,
            date=tool.expiry_date or now,
            is_read=False,
            is_resolved=False,
            tool=tool
        )
        dynamic_alerts.append(alert)
    
    # C. Scrapped Tools (Critical)
    scrapped_tools = session.exec(
        select(Tool).where(Tool.status == "scrap")
    ).all()

    for tool in scrapped_tools:
        alert = AlertRead(
            id=-(tool.id * 1000 + 3), # distinct negative ID
            type="scrap",
            severity="critical",
            title="Tool Scrapped",
            message=f"Tool {tool.description} ({tool.qr_code}) is marked as SCRAP.",
            tool_id=tool.id,
            site=tool.current_site,
            date=tool.last_inspection_date or now, # Use inspection date or now
            is_read=False,
            is_resolved=False,
            tool=tool
        )
        dynamic_alerts.append(alert)
    
    # Combine dynamic first (high priority) + db alerts
    return dynamic_alerts + list(db_alerts)

@router.post("/", response_model=AlertRead)
def create_alert(
    alert: AlertCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_alert = Alert.from_orm(alert)
    session.add(db_alert)
    session.commit()
    session.refresh(db_alert)
    return db_alert

@router.post("/{alert_id}/read", response_model=AlertRead)
def mark_alert_read(
    alert_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert

@router.post("/{alert_id}/resolve", response_model=AlertRead)
def resolve_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert
