from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlmodel import Session, select
from ..database import get_session
from ..models import Tool, ToolCreate, ToolRead, ToolUpdate, User
from ..auth import get_current_user
from ..audit import log_action

router = APIRouter(prefix="/tools", tags=["tools"])

def resequence_unprinted_tools(session: Session, deleted_qr_code: str):
    """
    Resequence all active unprinted tools in the database that have a serial number
    greater than the deleted QR code's suffix, skipping any printed serial numbers.
    """
    if not deleted_qr_code or len(deleted_qr_code) < 4:
        return
        
    try:
        deleted_suffix = deleted_qr_code[-4:]
        if not deleted_suffix.isdigit():
            return
        deleted_serial = int(deleted_suffix)
        
        # 1. Fetch all printed serial numbers in the database
        printed_tools = session.exec(select(Tool).where(Tool.is_printed == True)).all()
        printed_serials = set()
        for pt in printed_tools:
            if pt.qr_code and len(pt.qr_code) >= 4:
                pt_suffix = pt.qr_code[-4:]
                if pt_suffix.isdigit():
                    printed_serials.add(int(pt_suffix))
                    
        # 2. Fetch all active unprinted tools to resequence
        unprinted_tools = session.exec(select(Tool).where(Tool.is_printed == False, Tool.is_deleted == False)).all()
        to_resequence = []
        for ut in unprinted_tools:
            if ut.qr_code and len(ut.qr_code) >= 4:
                ut_suffix = ut.qr_code[-4:]
                if ut_suffix.isdigit():
                    ut_serial = int(ut_suffix)
                    if ut_serial > deleted_serial:
                        ut_prefix = ut.qr_code[:-4]
                        to_resequence.append((ut_serial, ut_prefix, ut))
                        
        # 3. Sort ascending by current serial
        to_resequence.sort(key=lambda x: x[0])
        
        # 4. Assign new serials skipping printed ones
        current_serial = deleted_serial
        for ut_serial, ut_prefix, ut in to_resequence:
            while current_serial in printed_serials:
                current_serial += 1
            
            # Update the tool QR code if changed
            if current_serial != ut_serial:
                ut.qr_code = f"{ut_prefix}{current_serial:04d}"
                session.add(ut)
                
            current_serial += 1
            
        session.flush()
    except Exception as e:
        print(f"Error in resequence_unprinted_tools: {e}")

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
    query = select(Tool).where(Tool.is_deleted == False)
    
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

from pydantic import BaseModel
class MarkPrintedRequest(BaseModel):
    tool_ids: List[int]

@router.post("/mark-printed")
def mark_tools_printed(payload: MarkPrintedRequest, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    tools = session.exec(select(Tool).where(Tool.id.in_(payload.tool_ids))).all()
    for tool in tools:
        tool.is_printed = True
        session.add(tool)
    session.commit()
    return {"ok": True, "count": len(tools)}

@router.get("/deleted-stats")
def get_deleted_stats(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Returns the list of deleted tools that were printed
    query = select(Tool).where(Tool.is_deleted == True, Tool.is_printed == True)
    if current_user.role == "data_entry" and current_user.site:
        query = query.where(Tool.current_site == current_user.site)
    deleted_tools = session.exec(query).all()
    return {
        "count": len(deleted_tools),
        "tools": deleted_tools
    }

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

    is_printed = tool.is_printed
    deleted_qr_code = tool.qr_code
    deleted_created_at = tool.created_at

    if is_printed:
        # Soft delete
        tool.is_deleted = True
        session.add(tool)
    else:
        # Hard delete
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

        session.delete(tool)
        
        # Resequence unprinted tools database-wide to prevent gaps
        resequence_unprinted_tools(session, deleted_qr_code)

    session.flush()

    del_alert = Alert(
        type="tool-deleted",
        severity="warning",
        title="Tool Deleted",
        message=f"Tool {tool.description} ({deleted_qr_code}) has been deleted from inventory.",
        tool_id=None,
        site=tool.current_site,
    )
    session.add(del_alert)

    log_action(
        session, current_user, "delete", "Tool", tool_id,
        f"Deleted tool {tool.description} ({deleted_qr_code})",
        site=tool.current_site,
    )

    session.commit()
    return {"ok": True}

@router.post("/{tool_id}/restore")
def restore_tool(tool_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can restore deleted tools.")
        
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
        
    if not tool.is_deleted:
        raise HTTPException(status_code=400, detail="Tool is not deleted")
        
    tool.is_deleted = False
    session.add(tool)
    
    # Create an Alert to log the restore action
    from ..models import Alert
    restore_alert = Alert(
        type="tool-restored",
        severity="info",
        title="Tool Restored",
        message=f"Tool {tool.description} ({tool.qr_code}) has been restored to inventory.",
        tool_id=tool.id,
        site=tool.current_site,
    )
    session.add(restore_alert)
    
    session.commit()
    return {"ok": True, "tool": tool}

@router.get("/qr/{qr_code}", response_model=ToolRead)
def read_tool_by_qr(qr_code: str, session: Session = Depends(get_session)):
    statement = select(Tool).where(Tool.qr_code == qr_code)
    tool = session.exec(statement).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool
