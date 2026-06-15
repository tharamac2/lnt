from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from sqlmodel import Session, select
import pandas as pd
import io
from ..database import get_session
from ..models import Dealer, DealerCreate, DealerRead, User
from ..auth import get_current_user
from ..audit import log_action

router = APIRouter(prefix="/dealers", tags=["dealers"])

def normalize_category(cat_str: str) -> Optional[str]:
    if not cat_str:
        return None
    cat = str(cat_str).strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    if cat in ("subcontractor", "subcon", "sub"):
        return "sub_contractor"
    elif cat in ("supplier", "sup"):
        return "supplier"
    elif cat in ("scrapdealer", "scrap"):
        return "scrap_dealer"
    return None

@router.get("/", response_model=List[DealerRead])
def read_dealers(
    category: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Dealer)
    if category:
        stmt = stmt.where(Dealer.category == category)
    stmt = stmt.order_by(Dealer.name.asc())
    return session.exec(stmt).all()

@router.post("/", response_model=DealerRead)
def create_dealer(
    payload: DealerCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage dealers")

    payload.dealer_code = payload.dealer_code.strip().upper()
    payload.category = payload.category.strip().lower()

    if not normalize_category(payload.category):
        raise HTTPException(status_code=400, detail="Invalid dealer category. Choose Sub Contractor, Supplier, or Scrap Dealer.")

    # Check unique dealer code
    stmt = select(Dealer).where(Dealer.dealer_code == payload.dealer_code)
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dealer Code already exists")

    db_dealer = Dealer.from_orm(payload)
    session.add(db_dealer)
    session.commit()
    session.refresh(db_dealer)

    log_action(
        session, current_user, "create", "Dealer", db_dealer.id,
        f"Created dealer '{db_dealer.name}' ({db_dealer.dealer_code}) in category '{db_dealer.category}'",
        site=current_user.site,
    )
    session.commit()

    return db_dealer

@router.delete("/{dealer_id}")
def delete_dealer(
    dealer_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage dealers")

    db_dealer = session.get(Dealer, dealer_id)
    if not db_dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")

    session.delete(db_dealer)
    session.commit()

    log_action(
        session, current_user, "delete", "Dealer", dealer_id,
        f"Deleted dealer '{db_dealer.name}' ({db_dealer.dealer_code})",
        site=current_user.site,
    )
    session.commit()

    return {"message": "Dealer deleted successfully"}

@router.post("/bulk-import")
async def bulk_import_dealers(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage dealers")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported.")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")

    # Clean headers
    df.columns = df.columns.astype(str).str.strip().str.lower().str.replace(' ', '_')

    # Mapping header variations
    category_col = None
    for col in df.columns:
        if col in ('category', 'dealer_category', 'type', 'dealer_type'):
            category_col = col
            break

    name_col = None
    for col in df.columns:
        if col in ('name', 'dealer_name', 'full_name'):
            name_col = col
            break

    company_col = None
    for col in df.columns:
        if col in ('company', 'company_name', 'organisation', 'organization'):
            company_col = col
            break

    code_col = None
    for col in df.columns:
        if col in ('dealer_code', 'code', 'id', 'dealer_id'):
            code_col = col
            break

    email_col = None
    for col in df.columns:
        if col in ('email', 'mail_id', 'mail', 'email_address'):
            email_col = col
            break

    phone_col = None
    for col in df.columns:
        if col in ('contact_number', 'phone', 'mobile', 'contact', 'phone_number'):
            phone_col = col
            break

    address_col = None
    for col in df.columns:
        if col in ('address', 'location', 'city'):
            address_col = col
            break

    gst_col = None
    for col in df.columns:
        if col in ('gst_number', 'gst', 'gstin'):
            gst_col = col
            break

    if not category_col or not name_col or not company_col or not code_col:
        raise HTTPException(
            status_code=400,
            detail="Column mapping failed. Excel must have columns for 'Category', 'Name', 'Company Name', and 'Dealer Code'."
        )

    success_count = 0
    skipped_count = 0
    errors = []

    for index, row in df.iterrows():
        try:
            row = row.where(pd.notnull(row), None)
            
            raw_category = str(row.get(category_col) or "").strip()
            category = normalize_category(raw_category)
            if not category:
                errors.append(f"Row {index+2}: Invalid category '{raw_category}'. Choose Sub Contractor, Supplier, or Scrap Dealer.")
                continue

            name = str(row.get(name_col) or "").strip()
            company_name = str(row.get(company_col) or "").strip()
            dealer_code = str(row.get(code_col) or "").strip().upper()

            if not name or not company_name or not dealer_code:
                errors.append(f"Row {index+2}: Missing Name, Company Name, or Dealer Code.")
                continue

            # Optional fields
            email = str(row.get(email_col) or "").strip() if row.get(email_col) else None
            contact_number = str(row.get(phone_col) or "").strip() if row.get(phone_col) else None
            address = str(row.get(address_col) or "").strip() if row.get(address_col) else None
            gst_number = str(row.get(gst_col) or "").strip() if row.get(gst_col) else None

            # Check uniqueness
            stmt = select(Dealer).where(Dealer.dealer_code == dealer_code)
            existing = session.exec(stmt).first()
            if existing:
                skipped_count += 1
                continue

            db_dealer = Dealer(
                category=category,
                name=name,
                company_name=company_name,
                dealer_code=dealer_code,
                email=email,
                contact_number=contact_number,
                address=address,
                gst_number=gst_number
            )
            session.add(db_dealer)
            success_count += 1
        except Exception as e:
            errors.append(f"Row {index+2}: {str(e)}")

    if success_count > 0:
        session.commit()
        log_action(
            session, current_user, "create", "Dealer", None,
            f"Bulk imported {success_count} dealers ({skipped_count} skipped)",
            site=current_user.site,
        )
        session.commit()

    return {
        "message": f"Successfully processed Excel: {success_count} dealers created, {skipped_count} skipped.",
        "imported": success_count,
        "skipped": skipped_count,
        "errors": errors
    }
