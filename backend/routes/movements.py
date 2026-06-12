from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from ..database import get_session
from ..models import MovementHistory, MovementHistoryRead, User, Tool
from ..auth import get_current_user

router = APIRouter(prefix="/movements", tags=["movements"])

@router.get("/{tool_id}", response_model=List[MovementHistoryRead])
def read_movement_history(tool_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    statement = select(MovementHistory).where(MovementHistory.tool_id == tool_id).order_by(MovementHistory.timestamp.desc())
    history = session.exec(statement).all()
    return history

@router.get("/", response_model=List[MovementHistoryRead])
def read_recent_movements(
    offset: int = 0,
    limit: int = 20,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    statement = select(MovementHistory).options(joinedload(MovementHistory.tool), joinedload(MovementHistory.user)).order_by(MovementHistory.timestamp.desc()).offset(offset).limit(limit)
    history = session.exec(statement).all()
    return history
