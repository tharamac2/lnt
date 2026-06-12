from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import shutil
import os
import uuid
import io
import re
import pandas as pd
from datetime import datetime
from pathlib import Path
import qrcode
import zipfile
from PIL import Image, ImageDraw, ImageFont
from sqlmodel import Session, select
from ..database import get_session
from ..models import Tool, User, Alert
from ..auth import get_current_user
router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "uploads"
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

@router.post("/certificate")
async def upload_certificate(file: UploadFile = File(...)):
    ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PDF, JPG, PNG")
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Return URL (relative path)
    return {"url": f"/api/uploads/{unique_filename}"}

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPG, PNG, GIF")
    
    unique_filename = f"img_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"url": f"/api/uploads/{unique_filename}"}

def generate_qr_code(description, metal_type, tool_variant, capacity, date_of_supply, purchaser_name, max_id, index):
    name_part = ""
    if description:
        words = str(description).strip().split()[:2]
        initials = "".join([w[0].upper() for w in words])
        name_part = re.sub(r'[^A-Z0-9]', 'X', initials).ljust(2, 'X')

    metal_part = ""
    if metal_type:
        metal_part = str(metal_type).strip()[0].upper()

    variant_part = "000"
    if tool_variant:
        words = [w for w in str(tool_variant).strip().split() if w]
        letters = "".join([w[0].upper() for w in words[:3]])
        variant_part = letters.rjust(3, '0')

    capacity_part = ""
    if capacity:
        capacity_part = re.sub(r'[^0-9]', '', str(capacity))

    date_part = ""
    if date_of_supply:
        try:
            dt = pd.to_datetime(date_of_supply)
            date_part = dt.strftime("%m%y")
        except:
            pass

    supplier_part = ""
    if purchaser_name:
        words = str(purchaser_name).strip().split()[:2]
        initials = "".join([w[0].upper() for w in words])
        supplier_part = re.sub(r'[^A-Z0-9]', 'X', initials).ljust(2, 'X')

    serial_part = str(max_id + 1 + index).zfill(4)

    return f"{name_part}{metal_part}{variant_part}{capacity_part}{date_part}{supplier_part}{serial_part}"

@router.post("/tools", response_model=dict)
async def upload_tools(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(('.xlsx', '.xls', '.pdf')):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and PDF files are supported.")
    
    contents = await file.read()
    
    if file.filename.endswith(('.xlsx', '.xls')):
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
            
    elif file.filename.endswith('.pdf'):
        try:
            import pdfplumber
            tables = []
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_table()
                    if extracted:
                        tables.extend(extracted)
            if not tables:
                raise HTTPException(status_code=400, detail="No readable tables found in the PDF.")
            
            headers = tables[0]
            df = pd.DataFrame(tables[1:], columns=headers)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading PDF file: {str(e)}")

    df.columns = df.columns.astype(str).str.strip().str.lower().str.replace(' ', '_')
    # Handle common misspellings or alternative headers from the user's Excel sheet
    df.rename(columns={
        'tool_varient': 'tool_variant', 
        'current_site': 'location'
    }, inplace=True)
    
    required_cols = [
        'description', 'make', 'capacity', 'safe_working_load', 'purchaser_name',
        'supplier_code', 'date_of_supply', 'tool_type', 'metal_type', 'tool_variant',
        'purchaser_contact', 'job_code', 'job_description', 'location'
    ]
    
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns in uploaded file: {', '.join(missing)}")

    success_count = 0
    errors = []
    all_tools = session.exec(select(Tool)).all()
    existing_qrs = {t.qr_code for t in all_tools}
    max_id = 0
    for t in all_tools:
        if t.qr_code and t.qr_code[-4:].isdigit():
            max_id = max(max_id, int(t.qr_code[-4:]))
    successfully_imported_tools = []
    
    qr_links = []
    frontend_url = os.environ.get('FRONTEND_URL', 'https://localhost:5173').rstrip('/')
    frontend_url = 'https://lntqrcode.com/'

    for index, row in df.iterrows():
        try:
            row = row.where(pd.notnull(row), None)
            
            description = str(row.get('description', ''))
            make = str(row.get('make', datetime.now().year))
            capacity = str(row.get('capacity', ''))
            swl = str(row.get('safe_working_load', ''))
            purchaser = str(row.get('purchaser_name', ''))
            
            supplier_code = str(row.get('supplier_code', index + 1))
            date_val = row.get('date_of_supply', None)
            
            if pd.notnull(date_val):
                date_of_supply = pd.to_datetime(date_val).to_pydatetime()
            else:
                date_of_supply = datetime.now()
            
            
            metal_type_val = str(row.get('metal_type', 'Steel'))
            tool_variant_val = str(row.get('tool_variant', 'Standard'))
            qr_code = generate_qr_code(description, metal_type_val, tool_variant_val, capacity, date_of_supply, purchaser, max_id, index)
            
            original_qr = qr_code
            counter = 1
            while qr_code in existing_qrs:
                qr_code = f"{original_qr}-{counter}"
                counter += 1
                
            existing_qrs.add(qr_code)
            
            expiry_date = None
            if date_of_supply:
                try:
                    expiry_date = datetime(date_of_supply.year + 3, date_of_supply.month, date_of_supply.day)
                except ValueError: 
                    expiry_date = datetime(date_of_supply.year + 3, date_of_supply.month, 28)
            
            location_val = row.get('location')
            location = str(location_val).strip() if pd.notna(location_val) and str(location_val).strip() else 'Store'

            db_tool = Tool(
                description=description,
                make=make,
                capacity=capacity,
                safe_working_load=swl,
                tool_type=str(row.get('tool_type', 'Erection Tools')),
                metal_type=str(row.get('metal_type', 'Steel')),
                tool_variant=str(row.get('tool_variant', 'Standard')),
                purchaser_name=purchaser,
                purchaser_contact=str(row.get('purchaser_contact', None)) if row.get('purchaser_contact') else None,
                supplier_code=supplier_code,
                job_code=str(row.get('job_code', None)) if row.get('job_code') else None,
                job_description=str(row.get('job_description', None)) if row.get('job_description') else None,
                current_site=location,
                date_of_supply=date_of_supply,
                expiry_date=expiry_date,
                validity_period=3,
                qr_code=qr_code,
                status="usable",
                inspection_result="usable"
            )
            session.add(db_tool)
            successfully_imported_tools.append(db_tool)
            qr_links.append(f"{frontend_url}/view-tool/{qr_code}")
            success_count += 1
        except Exception as e:
            qr_links.append("")
            errors.append(f"Row {index+2}: {str(e)}")

    download_url = None
    excel_download_url = None
    if success_count > 0:
        session.commit()
        
        # Save updated excel file
        if len(qr_links) == len(df):
            df['qr_link'] = qr_links
        
        excel_filename = f"qrcodes_data_{uuid.uuid4().hex[:8]}.xlsx"
        excel_filepath = os.path.join(UPLOAD_DIR, excel_filename)
        df.to_excel(excel_filepath, index=False)
        excel_download_url = f"/api/uploads/{excel_filename}"
        
        # Generate QR Codes ZIP
        zip_filename = f"qrcodes_{uuid.uuid4().hex[:8]}.zip"
        zip_filepath = os.path.join(UPLOAD_DIR, zip_filename)
        
        with zipfile.ZipFile(zip_filepath, 'w') as zipf:
            for tool in successfully_imported_tools:
                full_url = f"{frontend_url}/view-tool/{tool.qr_code}"
                
                qr = qrcode.make(full_url)
                qr_pil = qr.get_image()
                # Create a new image with space for text at bottom
                new_img = Image.new('RGB', (qr.pixel_size, qr.pixel_size + 40), color='white')
                new_img.paste(qr_pil, (0, 0))
                draw = ImageDraw.Draw(new_img)
                try:
                    font = ImageFont.load_default()
                except Exception:
                    font = None
                
                text = tool.qr_code
                # Very basic centering approximation for default font
                text_x = qr.pixel_size // 2 - (len(text) * 3)
                draw.text((max(0, text_x), qr.pixel_size + 10), text, fill="black", font=font)
                
                img_byte_arr = io.BytesIO()
                new_img.save(img_byte_arr, format='PNG')
                zipf.writestr(f"{tool.qr_code}.png", img_byte_arr.getvalue())
        
        download_url = f"/api/uploads/{zip_filename}"
        
        bulk_alert = Alert(
            type="new-tool",
            severity="info",
            title="Bulk Tools Uploaded",
            message=f"{success_count} tools have been mass-uploaded from {file.filename}.",
            site=None
        )
        session.add(bulk_alert)
        session.commit()

    return {
        "success": True,
        "message": f"Successfully imported {success_count} tools.",
        "errors": errors,
        "download_url": download_url,
        "excel_download_url": excel_download_url
    }
