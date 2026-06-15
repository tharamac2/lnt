from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from sqlmodel import Session, select
import pandas as pd
import io
from ..database import get_session
from ..models import ToolConfig, ToolConfigCreate, ToolConfigRead, User, Tool, Alert, Inspection, MovementHistory
from ..auth import get_current_user
from ..audit import log_action
from pydantic import BaseModel
from .tools import resequence_unprinted_tools

router = APIRouter(prefix="/toolconfig", tags=["toolconfig"])

class VerifyPayload(BaseModel):
    ids: List[int]

@router.get("/", response_model=List[ToolConfigRead])
def read_tool_configs(
    verified_only: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = select(ToolConfig)
    if verified_only:
        statement = statement.where(ToolConfig.is_verified == True)
    statement = statement.order_by(ToolConfig.tool_name.asc())
    return session.exec(statement).all()

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
