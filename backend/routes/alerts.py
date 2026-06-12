from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from ..database import get_session
from datetime import datetime, timedelta
from ..models import Alert, AlertCreate, AlertRead, User, Tool
from ..auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])

from sqlalchemy.orm import joinedload

@router.get("/", response_model=List[AlertRead])
def read_alerts(
    skip: int = 0, 
    limit: int = 50, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    import math
    now = datetime.now()
    
    # 1. Scan active tools for expiry thresholds (90, 60, 30, 15, 5 days, expired)
    tools = session.exec(select(Tool).where(Tool.is_deleted == False, Tool.status == "usable")).all()
    for tool in tools:
        if not tool.expiry_date:
            continue
            
        # Use ceiling calculation to match frontend and avoid premature expiration (e.g. 18 hours left = 1 day left, not 0)
        delta = tool.expiry_date - now
        days_left = math.ceil(delta.total_seconds() / 86400)
        
        alert_type = None
        severity = "warning"
        title = ""
        message = ""
        
        # Determine the most urgent threshold reached
        if days_left <= 0:
            alert_type = "expired"
            severity = "critical"
            title = "Tool Expired"
            message = f"Tool {tool.description} ({tool.qr_code}) expired on {tool.expiry_date.date()}."
        elif days_left <= 5:
            alert_type = "expiry-5"
            severity = "critical"
            title = "Tool Expiring in 5 Days"
            message = f"Tool {tool.description} ({tool.qr_code}) will expire in 5 days (on {tool.expiry_date.date()})."
        elif days_left <= 15:
            alert_type = "expiry-15"
            severity = "warning"
            title = "Tool Expiring in 15 Days"
            message = f"Tool {tool.description} ({tool.qr_code}) will expire in 15 days (on {tool.expiry_date.date()})."
        elif days_left <= 30:
            alert_type = "expiry-30"
            severity = "warning"
            title = "Tool Expiring in 30 Days"
            message = f"Tool {tool.description} ({tool.qr_code}) will expire in 30 days (on {tool.expiry_date.date()})."
        elif days_left <= 60:
            alert_type = "expiry-60"
            severity = "warning"
            title = "Tool Expiring in 60 Days"
            message = f"Tool {tool.description} ({tool.qr_code}) will expire in 60 days (on {tool.expiry_date.date()})."
        elif days_left <= 90:
            alert_type = "expiry-90"
            severity = "warning"
            title = "Tool Expiring in 90 Days"
            message = f"Tool {tool.description} ({tool.qr_code}) will expire in 90 days (on {tool.expiry_date.date()})."
            
        if alert_type:
            # Check if this alert type already exists for this tool in DB
            existing = session.exec(
                select(Alert).where(Alert.tool_id == tool.id, Alert.type == alert_type)
            ).first()
            
            if not existing:
                new_alert = Alert(
                    type=alert_type,
                    severity=severity,
                    title=title,
                    message=message,
                    tool_id=tool.id,
                    site=tool.current_site,
                    date=datetime.now(),
                    is_read=False,
                    is_resolved=False
                )
                session.add(new_alert)
                
    # 2. Check for scrapped tools and make sure we have a "scrap" alert for them in the DB
    scrapped_tools = session.exec(select(Tool).where(Tool.status == "scrap")).all()
    for tool in scrapped_tools:
        # Check if "scrap" alert already exists for this tool in DB
        existing_scrap = session.exec(
            select(Alert).where(Alert.tool_id == tool.id, Alert.type == "scrap")
        ).first()
        
        if not existing_scrap:
            new_alert = Alert(
                type="scrap",
                severity="critical",
                title="Tool Scrapped",
                message=f"Tool {tool.description} ({tool.qr_code}) is marked as SCRAP.",
                tool_id=tool.id,
                site=tool.current_site,
                date=tool.last_inspection_date or datetime.now(),
                is_read=False,
                is_resolved=False
            )
            session.add(new_alert)
            
    session.commit()
    
    # 3. Query all persistent alerts from DB (with joined load of tools to ensure details are populated)
    statement = select(Alert).options(joinedload(Alert.tool)).order_by(Alert.date.desc()).offset(skip).limit(limit)
    db_alerts = session.exec(statement).all()
    return db_alerts

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
