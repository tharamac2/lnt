from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import List
from sqlmodel import Session, select
from ..database import get_session
from ..models import User, UserCreate, UserRead, UserUpdate, Inspector
from ..auth import get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from ..audit import log_action
from .. import email_utils
from datetime import timedelta

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    statement = select(User).where(User.username == form_data.username)
    user = session.exec(statement).first()
    if user and verify_password(form_data.password, user.hashed_password):
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is deactivated. Please contact an administrator.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
        )

        log_action(
            session, user, "login", "User", user.id,
            f"{user.full_name or user.username} logged in",
            site=user.site,
        )
        session.commit()

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "full_name": user.full_name,
            "site": user.site
        }

    # Fall back to Inspection Employee accounts (separate table, same login page)
    statement = select(Inspector).where(Inspector.email == form_data.username)
    inspector = session.exec(statement).first()
    if inspector and verify_password(form_data.password, inspector.hashed_password):
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": inspector.email, "role": "inspection_employee", "type": "inspector"},
            expires_delta=access_token_expires,
        )

        site = inspector.creator.site if inspector.creator else None
        log_action(
            session, inspector, "login", "Inspector", inspector.id,
            f"{inspector.name} logged in",
            site=site,
        )
        session.commit()

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": "inspection_employee",
            "full_name": inspector.name,
            "site": site,
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No users found",
        headers={"WWW-Authenticate": "Bearer"},
    )

class EmailRequest(BaseModel):
    email: EmailStr

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

@router.post("/send-otp")
def send_email_otp(payload: EmailRequest, session: Session = Depends(get_session)):
    existing_user = session.exec(select(User).where(User.email == payload.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        email_utils.send_otp_email(payload.email)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please check the address and try again.")

    return {"message": "Verification code sent"}

@router.post("/verify-otp")
def verify_email_otp(payload: OTPVerifyRequest):
    if not email_utils.verify_otp(payload.email, payload.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    return {"message": "Email verified"}

@router.post("/", response_model=UserRead)
def create_user(user: UserCreate, session: Session = Depends(get_session)): # Removed current_user dependency for initial setup ease, typically admin only
    # Check if user exists
    statement = select(User).where(User.username == user.username)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    if not email_utils.is_email_verified(user.email):
        raise HTTPException(status_code=400, detail="Email address has not been verified")
    email_utils.clear_verification(user.email)

    hashed_password = get_password_hash(user.password)
    # Exclude password, unpack the rest, and add hashed_password explicitly
    user_data = user.dict(exclude={"password"})
    db_user = User(**user_data, hashed_password=hashed_password)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    # Generate Info Alert
    from ..models import Alert
    # Alert doesn't have user_id field for target, just generic info
    new_user_alert = Alert(
        type="new-user",
        severity="info",
        title="New User Created",
        message=f"New user created: {db_user.full_name} ({db_user.role})",
        tool_id=None,
        site=db_user.site,
    )
    session.add(new_user_alert)

    log_action(
        session, db_user, "create", "User", db_user.id,
        f"User account created: {db_user.full_name or db_user.username} ({db_user.role})",
        site=db_user.site,
    )
    session.commit()
    
    return db_user

@router.get("/stores")
def get_stores(session: Session = Depends(get_session)):
    """Return distinct site names from all Store Manager users."""
    statement = select(User.site).where(User.role == "store").where(User.site != None).where(User.site != "")
    results = session.exec(statement).all()
    # Deduplicate while preserving order
    seen = set()
    stores = []
    for site in results:
        if site and site not in seen:
            seen.add(site)
            stores.append(site)
    return {"stores": stores}

@router.get("/", response_model=List[UserRead])
def read_users(offset: int = 0, limit: int = 100, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    users = session.exec(select(User).offset(offset).limit(limit)).all()
    return users

@router.get("/me")
async def read_users_me(current_user = Depends(get_current_user)):
    if isinstance(current_user, Inspector):
        return {
            "id": current_user.id,
            "username": current_user.email,
            "email": current_user.email,
            "full_name": current_user.name,
            "role": "inspection_employee",
            "site": current_user.creator.site if current_user.creator else None,
            "phone": current_user.contact_number,
            "status": current_user.status,
        }
    return UserRead(**current_user.dict(exclude={"hashed_password"}))

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
        
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log_action(
        session, current_user, "delete", "User", user_id,
        f"Deleted user {user.full_name or user.username} ({user.role})",
        site=user.site,
    )

    session.delete(user)
    session.commit()
    return None

@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, user_update: UserUpdate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")
        
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_data = user_update.dict(exclude_unset=True)
    
    # If email is updated but username is not, sync them (assuming username=email convention)
    if "email" in user_data and "username" not in user_data:
        user_data["username"] = user_data["email"]

    if "password" in user_data and user_data["password"]:
        hashed_password = get_password_hash(user_data["password"])
        user_data["hashed_password"] = hashed_password
        del user_data["password"]
    elif "password" in user_data:
        del user_data["password"] # Remove empty password if present
        
    for key, value in user_data.items():
        setattr(db_user, key, value)

    changed_fields = ", ".join(
        "password" if k in ("password", "hashed_password") else k for k in user_data.keys()
    ) or "-"
    log_action(
        session, current_user, "update", "User", user_id,
        f"Updated user {db_user.full_name or db_user.username} - fields: {changed_fields}",
        site=db_user.site,
    )

    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user
