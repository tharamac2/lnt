from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
from ..database import get_session
from ..models import Inspection, InspectionCreate, InspectionRead, InspectionReadWithTool, User, Tool
from ..auth import get_current_user

router = APIRouter(prefix="/inspections", tags=["inspections"])

@router.post("/", response_model=InspectionRead)
def create_inspection(inspection: InspectionCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Create inspection dictionary from input, excluding defaults if needed, 
    # but specifically handle inspector_id which comes from current_user
    inspection_data = inspection.dict(exclude_unset=True)
    inspection_data['inspector_id'] = current_user.id
    
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
    
    session.commit()
    session.refresh(db_inspection)
    return db_inspection

@router.get("/tool/{tool_id}", response_model=List[InspectionRead])
def read_inspections_by_tool(tool_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    statement = select(Inspection).where(Inspection.tool_id == tool_id)
    inspections = session.exec(statement).all()
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
