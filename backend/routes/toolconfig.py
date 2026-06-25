from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from sqlmodel import Session, select
import pandas as pd
import io
from ..database import get_session
from ..models import ToolConfig, ToolConfigCreate, ToolConfigRead, ToolConfigUpdate, User, Tool, Alert, Inspection, MovementHistory
from ..auth import get_current_user
from ..audit import log_action
from pydantic import BaseModel
from .tools import resequence_unprinted_tools

router = APIRouter(prefix="/toolconfig", tags=["toolconfig"])

class VerifyPayload(BaseModel):
    ids: List[int]

class ToolInConfig(BaseModel):
    id: int
    qr_code: str
    is_printed: bool
    current_site: Optional[str] = None
    status: str

class ToolConfigReadWithTools(BaseModel):
    id: int
    tool_name: str
    item_code: str
    is_verified: bool
    tools: List[ToolInConfig] = []
    has_printed_tools: bool = False

@router.get("/", response_model=List[ToolConfigReadWithTools])
def read_tool_configs(
    verified_only: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Auto-create a stub config (blank item code, pending) for any tool name
    # that exists in Tool Master but has no Tool Config entry yet, so every
    # tool name is visible here and can have its item code filled in.
    existing_names = set(session.exec(select(ToolConfig.tool_name)).all())
    distinct_tool_names = session.exec(
        select(Tool.description).where(Tool.is_deleted == False).distinct()
    ).all()
    missing_names = [name for name in distinct_tool_names if name and name not in existing_names]
    if missing_names:
        for name in missing_names:
            session.add(ToolConfig(tool_name=name, item_code="", is_verified=False))
        session.commit()

    statement = select(ToolConfig)
    if verified_only:
        statement = statement.where(ToolConfig.is_verified == True)
    statement = statement.order_by(ToolConfig.tool_name.asc())
    configs = session.exec(statement).all()

    result = []
    for cfg in configs:
        # Fetch active tools for this configuration
        stmt = select(Tool).where(Tool.description == cfg.tool_name, Tool.is_deleted == False)
        tools = session.exec(stmt).all()
        
        tools_list = [
            ToolInConfig(
                id=t.id,
                qr_code=t.qr_code,
                is_printed=t.is_printed,
                current_site=t.current_site,
                status=t.status
            )
            for t in tools
        ]
        
        has_printed = any(t.is_printed for t in tools)
        
        result.append(
            ToolConfigReadWithTools(
                id=cfg.id,
                tool_name=cfg.tool_name,
                item_code=cfg.item_code,
                is_verified=cfg.is_verified,
                tools=tools_list,
                has_printed_tools=has_printed
            )
        )
    return result

@router.post("/", response_model=ToolConfigRead)
def create_tool_config(
    payload: ToolConfigCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to configure tools")

    stmt = select(ToolConfig).where(ToolConfig.tool_name == payload.tool_name)
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tool Name already configured")

    db_config = ToolConfig(**payload.dict())
    db_config.is_verified = False  # Default to False (Pending verification)
    session.add(db_config)
    session.commit()
    session.refresh(db_config)

    log_action(
        session, current_user, "create", "ToolConfig", db_config.id,
        f"Configured tool '{db_config.tool_name}' with item code '{db_config.item_code}' (pending verification)",
        site=current_user.site,
    )
    session.commit()

    return db_config

@router.put("/{config_id}", response_model=ToolConfigRead)
def update_tool_config(
    config_id: int,
    payload: ToolConfigUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to configure tools")

    db_config = session.get(ToolConfig, config_id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Tool configuration not found")

    update_data = payload.dict(exclude_unset=True)
    item_code_changed = "item_code" in update_data and update_data["item_code"] != db_config.item_code
    old_tool_name = db_config.tool_name

    if "item_code" in update_data:
        db_config.item_code = update_data["item_code"]
    if "tool_name" in update_data:
        db_config.tool_name = update_data["tool_name"]

    if item_code_changed:
        db_config.is_verified = False  # Re-verification required after item code change

    session.add(db_config)
    session.commit()
    session.refresh(db_config)

    # Keep matching Tool Master records in sync with this config's item code
    if item_code_changed and db_config.item_code:
        matching_tools = session.exec(select(Tool).where(Tool.description == old_tool_name)).all()
        for t in matching_tools:
            t.item_code = db_config.item_code
            session.add(t)
        if matching_tools:
            session.commit()

    log_action(
        session, current_user, "update", "ToolConfig", db_config.id,
        f"Updated tool config '{db_config.tool_name}' item code to '{db_config.item_code}'",
        site=current_user.site,
    )
    session.commit()

    return db_config

@router.post("/verify")
def verify_tool_configs(
    payload: VerifyPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to verify tools")

    updated_count = 0
    for config_id in payload.ids:
        db_config = session.get(ToolConfig, config_id)
        if db_config:
            db_config.is_verified = True
            session.add(db_config)
            updated_count += 1

    if updated_count > 0:
        session.commit()
        log_action(
            session, current_user, "update", "ToolConfig", None,
            f"Verified {updated_count} tool configurations",
            site=current_user.site,
        )
        session.commit()

    return {"message": f"Successfully verified {updated_count} tool configurations"}

@router.post("/bulk-import")
async def bulk_import_tool_configs(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to configure tools")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported.")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")

    df.columns = df.columns.astype(str).str.strip().str.lower().str.replace(' ', '_')

    # Find columns mapping
    tool_col = None
    for col in df.columns:
        if col in ('tool_name', 'toolname', 'description', 'tool_description', 'name'):
            tool_col = col
            break
    code_col = None
    for col in df.columns:
        if col in ('item_code', 'itemcode', 'code'):
            code_col = col
            break

    if not tool_col or not code_col:
        raise HTTPException(
            status_code=400,
            detail="Column mapping failed. Ensure the Excel has columns for 'Tool Name' (or Description) and 'Item Code'."
        )

    success_count = 0
    duplicate_count = 0
    for idx, row in df.iterrows():
        tool_val = row.get(tool_col)
        code_val = row.get(code_col)
        if pd.isna(tool_val) or pd.isna(code_val):
            continue

        tool_name = str(tool_val).strip().upper()
        item_code = str(code_val).strip().upper()

        if not tool_name or not item_code:
            continue

        # Check if mapping already exists
        stmt = select(ToolConfig).where(ToolConfig.tool_name == tool_name)
        existing = session.exec(stmt).first()
        if existing:
            # Update item code and reset verification status to False
            existing.item_code = item_code
            existing.is_verified = False
            session.add(existing)
            duplicate_count += 1
        else:
            new_config = ToolConfig(tool_name=tool_name, item_code=item_code, is_verified=False)
            session.add(new_config)
            success_count += 1

        # Keep matching Tool Master records in sync with this item code
        matching_tools = session.exec(select(Tool).where(Tool.description == tool_name)).all()
        for t in matching_tools:
            t.item_code = item_code
            session.add(t)

    session.commit()

    log_action(
        session, current_user, "create", "ToolConfig", None,
        f"Bulk imported tool configs: {success_count} new, {duplicate_count} updated (pending verification)",
        site=current_user.site,
    )
    session.commit()

    return {
        "message": f"Successfully processed Excel: {success_count} new entries created, {duplicate_count} existing entries updated. All are pending verification.",
        "imported": success_count + duplicate_count
    }

@router.delete("/{config_id}")
def delete_tool_config(
    config_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete tool configurations")

    db_config = session.get(ToolConfig, config_id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Tool configuration not found")

    # Check if there are any active printed tools matching this config
    stmt_printed = select(Tool).where(
        Tool.description == db_config.tool_name, 
        Tool.is_deleted == False, 
        Tool.is_printed == True
    )
    printed_tools = session.exec(stmt_printed).all()
    if printed_tools:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete configuration: matching tools have already been printed."
        )

    # 1. Cascade delete all tools with this description in Tool Master
    stmt = select(Tool).where(Tool.description == db_config.tool_name, Tool.is_deleted == False)
    matching_tools = session.exec(stmt).all()
    deleted_tools_count = len(matching_tools)
    hard_deleted_qr_codes = []
    for t in matching_tools:
        if t.is_printed:
            # Soft delete
            t.is_deleted = True
            session.add(t)
            log_action(
                session, current_user, "delete", "Tool", t.id,
                f"Soft-deleted tool {t.description} ({t.qr_code}) due to config deletion cascade",
                site=t.current_site,
            )
        else:
            # Hard delete
            # Nullify alerts
            existing_alerts = session.exec(select(Alert).where(Alert.tool_id == t.id)).all()
            for alert in existing_alerts:
                alert.tool_id = None
                session.add(alert)

            # Delete inspections
            inspections = session.exec(select(Inspection).where(Inspection.tool_id == t.id)).all()
            for ins in inspections:
                session.delete(ins)

            # Delete movements
            movements = session.exec(select(MovementHistory).where(MovementHistory.tool_id == t.id)).all()
            for mov in movements:
                session.delete(mov)

            # Delete tool
            hard_deleted_qr_codes.append(t.qr_code)
            session.delete(t)
            log_action(
                session, current_user, "delete", "Tool", t.id,
                f"Hard-deleted unprinted tool {t.description} ({t.qr_code}) due to config deletion cascade",
                site=t.current_site,
            )

    # 2. Resequence unprinted tools database-wide once after all hard deletions are processed
    if hard_deleted_qr_codes:
        min_qr_code = None
        min_serial = None
        for qr in hard_deleted_qr_codes:
            if qr and len(qr) >= 4:
                suffix = qr[-4:]
                if suffix.isdigit():
                    serial = int(suffix)
                    if min_serial is None or serial < min_serial:
                        min_serial = serial
                        min_qr_code = qr
        if min_qr_code:
            resequence_unprinted_tools(session, min_qr_code)

    # 3. Delete the configuration entry
    session.delete(db_config)
    session.commit()

    log_action(
        session, current_user, "delete", "ToolConfig", config_id,
        f"Deleted tool config '{db_config.tool_name}' and cascaded deletion to {deleted_tools_count} matching tools",
        site=current_user.site,
    )
    session.commit()

    return {
        "message": "Tool configuration deleted successfully",
        "cascaded_deleted_tools": deleted_tools_count
    }
