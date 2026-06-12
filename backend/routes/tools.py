from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlmodel import Session, select
from ..database import get_session
from ..models import Tool, ToolCreate, ToolRead, ToolUpdate, User
from ..auth import get_current_user
from ..audit import log_action

router = APIRouter(prefix="/tools", tags=["tools"])

@router.post("/", response_model=ToolRead)
def create_tool(tool: ToolCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    db_tool = Tool.from_orm(tool)
    db_tool.created_by_id = current_user.id
    
    # If Data Entry user, enforce their assigned site and validate it exists
    if current_user.role == "data_entry":
        if not current_user.site:
            raise HTTPException(status_code=403, detail="No site assigned to this Data Entry user.")
        
        # Enforce site - data entry users can only add tools to their assigned site
        db_tool.current_site = current_user.site

    session.add(db_tool)
    session.commit()
    session.refresh(db_tool)
    
    # Generate Alert
    from ..models import Alert
    new_alert = Alert(
        type="new-tool",
        severity="info",
        title="New Tool Added",
        message=f"New tool has been added to the inventory: {db_tool.description} ({db_tool.qr_code})",
        tool_id=db_tool.id,
        site=db_tool.current_site,
    )
    session.add(new_alert)

    log_action(
        session, current_user, "create", "Tool", db_tool.id,
        f"Created tool {db_tool.description} ({db_tool.qr_code})",
        site=db_tool.current_site,
    )
    session.commit()

    return db_tool

@router.get("/sites/", response_model=List[str])
def read_sites(session: Session = Depends(get_session)):
    query = select(Tool.current_site).distinct().where(
        Tool.current_site != None,
        Tool.current_site != ""
    )
    return [s for s in session.exec(query).all() if s and s.strip()]

@router.get("/next-id")
def get_next_tool_id(session: Session = Depends(get_session)):
    qr_codes = session.exec(select(Tool.qr_code)).all()
    max_serial = 0
    for qr_code in qr_codes:
        if qr_code and len(qr_code) >= 4:
            suffix = qr_code[-4:]
            if suffix.isdigit():
                max_serial = max(max_serial, int(suffix))
    return {"next_id": max_serial + 1}

@router.get("/", response_model=List[ToolRead])
def read_tools(
    offset: int = 0, 
    limit: int = 10000000, 
    search: Optional[str] = None,
    site: Optional[str] = None,
    created_by: Optional[int] = None,
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    query = select(Tool)
    
    # Filtering for Data Entry role: show only their assigned site
    if current_user.role == "data_entry" and current_user.site:
        query = query.where(Tool.current_site == current_user.site)
    
    if search:
        query = query.where(Tool.description.contains(search) | Tool.qr_code.contains(search))
    if site:
        from sqlalchemy import func
        query = query.where(func.lower(func.trim(Tool.current_site)) == site.strip().lower())
    if created_by:
        query = query.where(Tool.created_by_id == created_by)
    
    tools = session.exec(query.offset(offset).limit(limit)).all()
    return tools

@router.get("/{tool_id}", response_model=ToolRead)
def read_tool(tool_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@router.patch("/{tool_id}", response_model=ToolRead)
def update_tool(tool_id: int, tool_update: ToolUpdate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    db_tool = session.get(Tool, tool_id)
    if not db_tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    old_site = db_tool.current_site
    old_subcontractor = db_tool.subcontractor_name

    tool_data = tool_update.dict(exclude_unset=True)
    for key, value in tool_data.items():
        setattr(db_tool, key, value)

    # Check for site movement and record history
    moved = False
    if "current_site" in tool_data:
        if old_site != tool_data["current_site"]:
            moved = True
            from ..models import MovementHistory
            # Create history record
            history = MovementHistory(
                tool_id=db_tool.id,
                from_site=old_site,
                to_site=db_tool.current_site,
                remarks=tool_data.get("remarks"), # Capture remarks if any from this update
                user_id=current_user.id
            )
            session.add(history)

            log_action(
                session, current_user, "movement", "Tool", db_tool.id,
                f"Moved tool {db_tool.description} ({db_tool.qr_code}) from {old_site or '-'} to {db_tool.current_site or '-'}",
                site=db_tool.current_site,
            )

    # If the site itself didn't change, a sub-contractor issue/return is still a
    # movement out of / into the store and should appear in movement history.
    if not moved and "subcontractor_name" in tool_data:
        new_subcontractor = tool_data["subcontractor_name"]
        from ..models import MovementHistory
        if new_subcontractor and new_subcontractor != old_subcontractor:
            history = MovementHistory(
                tool_id=db_tool.id,
                from_site=old_site,
                to_site=f"Sub-Contractor: {new_subcontractor}",
                remarks=tool_data.get("remarks"),
                user_id=current_user.id
            )
            session.add(history)
            log_action(
                session, current_user, "movement", "Tool", db_tool.id,
                f"Issued tool {db_tool.description} ({db_tool.qr_code}) to Sub-Contractor {new_subcontractor}",
                site=db_tool.current_site,
            )
        elif old_subcontractor and not new_subcontractor:
            history = MovementHistory(
                tool_id=db_tool.id,
                from_site=f"Sub-Contractor: {old_subcontractor}",
                to_site=db_tool.current_site,
                remarks=tool_data.get("remarks"),
                user_id=current_user.id
            )
            session.add(history)
            log_action(
                session, current_user, "movement", "Tool", db_tool.id,
                f"Returned tool {db_tool.description} ({db_tool.qr_code}) from Sub-Contractor {old_subcontractor}",
                site=db_tool.current_site,
            )

    session.add(db_tool)
    session.commit()
    session.refresh(db_tool)

    # Generate Info Alert for Update
    from ..models import Alert
    update_alert = Alert(
        type="tool-update",
        severity="info",
        title="Tool Updated",
        message=f"Tool details updated for {db_tool.description} ({db_tool.qr_code}).",
        tool_id=db_tool.id,
        site=db_tool.current_site,
    )
    session.add(update_alert)

    changed_fields = ", ".join(k for k in tool_data.keys() if k != "current_site") or "site"
    if not moved or len(tool_data) > 1:
        log_action(
            session, current_user, "update", "Tool", db_tool.id,
            f"Updated tool {db_tool.description} ({db_tool.qr_code}) - fields: {changed_fields}",
            site=db_tool.current_site,
        )
    session.commit()
    
    return db_tool

@router.delete("/{tool_id}")
def delete_tool(tool_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    from ..models import Alert, Inspection, MovementHistory
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    # Nullify tool_id on existing alerts so they are preserved as history
    existing_alerts = session.exec(select(Alert).where(Alert.tool_id == tool_id)).all()
    for alert in existing_alerts:
        alert.tool_id = None
        session.add(alert)

    # Delete related inspections and movement history
    inspections = session.exec(select(Inspection).where(Inspection.tool_id == tool_id)).all()
    for ins in inspections:
        session.delete(ins)

    movements = session.exec(select(MovementHistory).where(MovementHistory.tool_id == tool_id)).all()
    for mov in movements:
        session.delete(mov)

    session.flush()

    del_alert = Alert(
        type="tool-deleted",
        severity="warning",
        title="Tool Deleted",
        message=f"Tool {tool.description} ({tool.qr_code}) has been deleted from inventory.",
        tool_id=None,
        site=tool.current_site,
    )
    session.add(del_alert)

    log_action(
        session, current_user, "delete", "Tool", tool_id,
        f"Deleted tool {tool.description} ({tool.qr_code})",
        site=tool.current_site,
    )

    session.delete(tool)
    session.commit()
    return {"ok": True}

@router.get("/qr/{qr_code}", response_model=ToolRead)
def read_tool_by_qr(qr_code: str, session: Session = Depends(get_session)):
    statement = select(Tool).where(Tool.qr_code == qr_code)
    tool = session.exec(statement).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool
