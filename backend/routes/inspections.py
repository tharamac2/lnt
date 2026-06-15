from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
from ..database import get_session
from ..models import Inspection, InspectionCreate, InspectionRead, InspectionReadWithTool, User, Tool, Inspector
from ..auth import get_current_user
from ..audit import log_action

router = APIRouter(prefix="/inspections", tags=["inspections"])

@router.post("/", response_model=InspectionRead)
def create_inspection(inspection: InspectionCreate, session: Session = Depends(get_session), current_user = Depends(get_current_user)):
    inspector_employee_id_for_record = None
    if isinstance(current_user, Inspector):
        if current_user.status != "verified":
            raise HTTPException(
                status_code=403,
                detail="Your employee profile must be verified by an admin before you can submit inspections.",
            )
        inspector_id_for_record = current_user.created_by_id
        inspector_employee_id_for_record = current_user.id
    elif current_user.role == "inspector":
        verified = session.exec(
            select(Inspector).where(
                Inspector.created_by_id == current_user.id,
                Inspector.status == "verified",
            )
        ).first()
        if not verified:
            raise HTTPException(
                status_code=403,
                detail="Your employee profile must be verified by an admin before you can submit inspections.",
            )
        inspector_id_for_record = current_user.id
    else:
        inspector_id_for_record = current_user.id

    # Create inspection dictionary from input, excluding defaults if needed,
    # but specifically handle inspector_id which comes from current_user
    inspection_data = inspection.dict(exclude_unset=True)
    inspection_data['inspector_id'] = inspector_id_for_record
    inspection_data['inspector_employee_id'] = inspector_employee_id_for_record
    
    # Create the model instance with the injection inspector_id
    db_inspection = Inspection(**inspection_data) 
    
    session.add(db_inspection)
    
    # Update Tool Status and Last Inspection Date
    tool = session.get(Tool, db_inspection.tool_id)
    if tool:
        tool.last_inspection_date = db_inspection.date
        tool.usability_percentage = db_inspection.usability_percentage
        
        # Simple logic: If result is 'not-usable' or 'fail', mark tool as under-repair or scrap
        # Frontend sends 'usable'/'not-usable' for inspectionResult usually, need to check models
        # Inspection model has 'result' field. 
        # Let's assume 'pass'/'fail' or 'usable'/'not-usable'.
        # Based on tool master, it uses 'usable'/'not-usable'.
        
        if db_inspection.result in ["fail", "not-usable", "scrap"]:
            tool.status = "scrap" 
            tool.inspection_result = "not-usable"
        else:
            tool.status = "usable"
            tool.inspection_result = "usable"
            
        session.add(tool)

        # Generate Critical Alert if usability is below 80% (High Wear)
        # Interpreting "crossed above 80%" as "Usage crossed 80%" -> Usability < 20%? 
        # Or sticking to "Warning (<=80%)" context from task list becoming Critical.
        # Let's set it to < 80 for now as 'Critical Usability Level'.
        if db_inspection.usability_percentage is not None and db_inspection.usability_percentage < 80:
             from ..models import Alert
             crit_alert = Alert(
                 type="low-usability",
                 severity="critical",
                 title="Critical Usability Level",
                 message=f"Tool usability has dropped to {db_inspection.usability_percentage}%, which is below the safe threshold of 80%",
                 tool_id=tool.id,
                 site=tool.current_site,
             )
             session.add(crit_alert)

    log_action(
        session, current_user, "create", "Inspection", db_inspection.id,
        f"Inspection recorded for tool #{db_inspection.tool_id} - result: {db_inspection.result}",
        site=tool.current_site if tool else None,
    )

    session.commit()
    session.refresh(db_inspection)
    return db_inspection

@router.get("/tool/{tool_id}", response_model=List[InspectionRead])
def read_inspections_by_tool(tool_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    statement = select(Inspection).where(Inspection.tool_id == tool_id)
    inspections = session.exec(statement).all()
    return inspections

@router.get("/results", response_model=List[InspectionReadWithTool])
def read_inspection_results(
    limit: int = 200,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    if isinstance(current_user, Inspector):
        site = current_user.creator.site if current_user.creator else None
    else:
        site = current_user.site

    statement = select(Inspection).options(joinedload(Inspection.tool), joinedload(Inspection.inspector))
    if site:
        statement = statement.join(Tool).where(Tool.current_site == site)
    statement = statement.order_by(Inspection.date.desc()).limit(limit)
    inspections = session.exec(statement).unique().all()
    return inspections

@router.get("/", response_model=List[InspectionReadWithTool])
def read_recent_inspections(
    offset: int = 0,
    limit: int = 5,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Join with Tool and Inspector to get details
    statement = select(Inspection).options(joinedload(Inspection.tool), joinedload(Inspection.inspector)).order_by(Inspection.date.desc()).offset(offset).limit(limit)
    inspections = session.exec(statement).all()
    return inspections
