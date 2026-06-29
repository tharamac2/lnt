from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
from ..database import get_session
from ..models import Inspector, InspectorCreate, InspectorRead, User, Inspection, InspectionReadWithTool
from ..auth import get_current_user, get_password_hash
from ..audit import log_action
from .. import email_utils

router = APIRouter(prefix="/inspectors", tags=["inspectors"])

@router.post("/", response_model=InspectorRead)
def create_inspector(
    payload: InspectorCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    existing = session.exec(select(Inspector).where(Inspector.employee_id == payload.employee_id)).first()
    if existing:
        raise HTTPException(status_code=400, detail="An employee with this Employee ID is already registered")

    if payload.contact_number:
        existing_phone = session.exec(select(Inspector).where(Inspector.contact_number == payload.contact_number)).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="An employee with this contact number is already registered")

    if not email_utils.is_email_verified(payload.email):
        raise HTTPException(status_code=400, detail="Email address has not been verified")
    email_utils.clear_verification(payload.email)

    hashed_password = get_password_hash(payload.password)
    inspector_data = payload.dict(exclude={"password"})
    db_inspector = Inspector(**inspector_data, hashed_password=hashed_password, created_by_id=current_user.id)
    session.add(db_inspector)
    session.commit()
    session.refresh(db_inspector)

    log_action(
        session, current_user, "create", "Inspector", db_inspector.id,
        f"Registered inspection employee {db_inspector.name} ({db_inspector.employee_id}) - pending verification",
        site=current_user.site,
    )
    session.commit()

    if db_inspector.contact_number:
        try:
            email_utils.register_twilio_verified_caller_id(db_inspector.contact_number, db_inspector.name)
        except Exception as e:
            print(f"Failed to register Twilio verified caller ID: {e}")
            
    return db_inspector

@router.get("/")
def read_inspectors(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not isinstance(current_user, User) or current_user.role not in ("admin", "store"):
        raise HTTPException(status_code=403, detail="Not authorized to view employee records")

    statement = select(Inspector).order_by(Inspector.created_at.desc())
    inspectors = session.exec(statement).all()
    results = [
        {
            **InspectorRead.from_orm(inspector).dict(),
            "site": inspector.creator.site if inspector.creator else None,
        }
        for inspector in inspectors
    ]
    if current_user.role == "store":
        results = [r for r in results if r["site"] == current_user.site]
    return results

@router.get("/me", response_model=List[InspectorRead])
def read_my_inspectors(
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user),
):
    if isinstance(current_user, Inspector):
        return [current_user]

    statement = select(Inspector).where(Inspector.created_by_id == current_user.id).order_by(Inspector.created_at.desc())
    return session.exec(statement).all()

@router.get("/{inspector_id}/inspections", response_model=List[InspectionReadWithTool])
def read_inspector_inspections(
    inspector_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not isinstance(current_user, User) or current_user.role not in ("admin", "store"):
        raise HTTPException(status_code=403, detail="Not authorized to view employee inspections")

    inspector = session.get(Inspector, inspector_id)
    if not inspector:
        raise HTTPException(status_code=404, detail="Employee record not found")

    if current_user.role == "store" and (not inspector.creator or inspector.creator.site != current_user.site):
        raise HTTPException(status_code=403, detail="Not authorized to view employee inspections")

    statement = (
        select(Inspection)
        .options(joinedload(Inspection.tool), joinedload(Inspection.inspector))
        .where(Inspection.inspector_employee_id == inspector_id)
        .order_by(Inspection.date.desc())
    )
    return session.exec(statement).unique().all()

@router.patch("/{inspector_id}/verify", response_model=InspectorRead)
def verify_inspector(
    inspector_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "store"):
        raise HTTPException(status_code=403, detail="Not authorized to verify employees")

    inspector = session.get(Inspector, inspector_id)
    if not inspector:
        raise HTTPException(status_code=404, detail="Employee record not found")

    if current_user.role == "store" and (not inspector.creator or inspector.creator.site != current_user.site):
        raise HTTPException(status_code=403, detail="Not authorized to verify employees")

    inspector.status = "verified"
    session.add(inspector)
    log_action(
        session, current_user, "update", "Inspector", inspector.id,
        f"Verified inspection employee {inspector.name} ({inspector.employee_id})",
        site=current_user.site,
    )
    session.commit()
    session.refresh(inspector)
    return inspector

@router.patch("/{inspector_id}/unverify", response_model=InspectorRead)
def unverify_inspector(
    inspector_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "store"):
        raise HTTPException(status_code=403, detail="Not authorized to update employees")

    inspector = session.get(Inspector, inspector_id)
    if not inspector:
        raise HTTPException(status_code=404, detail="Employee record not found")

    if current_user.role == "store" and (not inspector.creator or inspector.creator.site != current_user.site):
        raise HTTPException(status_code=403, detail="Not authorized to update employees")

    inspector.status = "pending"
    session.add(inspector)
    log_action(
        session, current_user, "update", "Inspector", inspector.id,
        f"Set inspection employee {inspector.name} ({inspector.employee_id}) back to pending",
        site=current_user.site,
    )
    session.commit()
    session.refresh(inspector)
    return inspector

@router.delete("/{inspector_id}")
def delete_inspector(
    inspector_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete employee records")

    inspector = session.get(Inspector, inspector_id)
    if not inspector:
        raise HTTPException(status_code=404, detail="Employee record not found")

    log_action(
        session, current_user, "delete", "Inspector", inspector_id,
        f"Deleted inspection employee {inspector.name} ({inspector.employee_id})",
        site=current_user.site,
    )
    session.delete(inspector)
    session.commit()
    return {"ok": True}
