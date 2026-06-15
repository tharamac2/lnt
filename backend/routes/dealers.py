from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from sqlmodel import Session, select
import pandas as pd
import io
import json
from ..database import get_session
from ..models import (
    Dealer, DealerCreate, DealerRead, User,
    DealerCustomField, DealerCustomFieldCreate, DealerCustomFieldRead, DealerCustomFieldUpdate
)
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

# --- Custom Fields Management Endpoints ---

@router.get("/custom-fields", response_model=List[DealerCustomFieldRead])
def read_custom_fields(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(DealerCustomField).order_by(DealerCustomField.name.asc())
    return session.exec(stmt).all()

@router.post("/custom-fields", response_model=DealerCustomFieldRead)
def create_custom_field(
    payload: DealerCustomFieldCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage custom fields")
    
    payload.name = payload.name.strip()
    if not payload.name:
        raise HTTPException(status_code=400, detail="Field name cannot be empty")
        
    if payload.field_type not in ("text", "number", "file", "radio", "checkbox"):
        raise HTTPException(status_code=400, detail="Invalid field type. Choose text, number, file, radio, or checkbox.")

    # Check unique name (case-insensitive)
    stmt = select(DealerCustomField)
    existing_fields = session.exec(stmt).all()
    if any(f.name.lower() == payload.name.lower() for f in existing_fields):
        raise HTTPException(status_code=400, detail="Custom field name already exists")

    db_field = DealerCustomField.from_orm(payload)
    session.add(db_field)
    session.commit()
    session.refresh(db_field)

    log_action(
        session, current_user, "create", "DealerCustomField", db_field.id,
        f"Created custom field definition '{db_field.name}' ({db_field.field_type})",
        site=current_user.site,
    )
    session.commit()
    return db_field

@router.put("/custom-fields/{field_id}", response_model=DealerCustomFieldRead)
def update_custom_field(
    field_id: int,
    payload: DealerCustomFieldUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage custom fields")

    db_field = session.get(DealerCustomField, field_id)
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")

    update_data = payload.dict(exclude_unset=True)
    if "name" in update_data:
        name = update_data["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="Field name cannot be empty")
        # Check unique if name changed
        if name.lower() != db_field.name.lower():
            stmt = select(DealerCustomField)
            existing_fields = session.exec(stmt).all()
            if any(f.name.lower() == name.lower() for f in existing_fields):
                raise HTTPException(status_code=400, detail="Custom field name already exists")
        db_field.name = name

    if "field_type" in update_data:
        field_type = update_data["field_type"]
        if field_type not in ("text", "number", "file", "radio", "checkbox"):
            raise HTTPException(status_code=400, detail="Invalid field type. Choose text, number, file, radio, or checkbox.")
        db_field.field_type = field_type

    if "is_required" in update_data:
        db_field.is_required = update_data["is_required"]

    if "options" in update_data:
        db_field.options = update_data["options"]

    session.add(db_field)
    session.commit()
    session.refresh(db_field)

    log_action(
        session, current_user, "update", "DealerCustomField", db_field.id,
        f"Updated custom field definition '{db_field.name}'",
        site=current_user.site,
    )
    session.commit()
    return db_field

@router.delete("/custom-fields/{field_id}")
def delete_custom_field(
    field_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage custom fields")

    db_field = session.get(DealerCustomField, field_id)
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")

    session.delete(db_field)
    session.commit()

    log_action(
        session, current_user, "delete", "DealerCustomField", field_id,
        f"Deleted custom field definition '{db_field.name}'",
        site=current_user.site,
    )
    session.commit()
    return {"message": "Custom field definition deleted successfully"}


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

    # Fetch all custom field definitions to map from Excel
    custom_field_defs = session.exec(select(DealerCustomField)).all()

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

            # Parse custom fields from excel row
            custom_vals = {}
            for fdef in custom_field_defs:
                # Find matching column
                f_name_norm = fdef.name.strip().lower().replace(' ', '_')
                matched_val = None
                for col in df.columns:
                    if col == f_name_norm or col.replace('_', ' ') == fdef.name.lower():
                        matched_val = row.get(col)
                        break
                if matched_val is not None:
                    # Clean and format value
                    matched_val = str(matched_val).strip()
                    if matched_val and matched_val.lower() != 'none' and matched_val.lower() != 'nan':
                        custom_vals[fdef.name] = matched_val

            custom_fields_str = json.dumps(custom_vals) if custom_vals else None

            db_dealer = Dealer(
                category=category,
                name=name,
                company_name=company_name,
                dealer_code=dealer_code,
                email=email,
                contact_number=contact_number,
                address=address,
                gst_number=gst_number,
                custom_fields=custom_fields_str
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
