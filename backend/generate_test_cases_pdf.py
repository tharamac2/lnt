"""One-off script: generates the Test Case Document PDF for the QR Code Tools
Management System, covering Backend/API (automated, pytest), Frontend/UI
(manual), and Database test cases, branded with the L&T logo.

Run with: python backend/generate_test_cases_pdf.py
"""
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, NextPageTemplate,
    Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(BASE_DIR, "src", "assets", "lt-logo.png")
OUTPUT_PATH = os.path.join(BASE_DIR, "QR_Tool_Management_System_Test_Cases_Report.pdf")

NAVY = colors.HexColor("#1E3A8A")
SLATE = colors.HexColor("#334155")
LIGHT_GREY = colors.HexColor("#F3F4F6")
GREEN = colors.HexColor("#15803D")
AMBER = colors.HexColor("#B45309")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleNavy", parent=styles["Title"], textColor=NAVY, fontSize=23, leading=27, alignment=TA_CENTER)
subtitle_style = ParagraphStyle("SubtitleNavy", parent=styles["Heading2"], textColor=SLATE, fontSize=13, leading=17, alignment=TA_CENTER, fontName="Helvetica")
section_style = ParagraphStyle("SectionNavy", parent=styles["Heading1"], textColor=WHITE, fontSize=14, leading=18, spaceAfter=10, backColor=NAVY, borderPadding=(6, 8, 6, 8))
heading_style = ParagraphStyle("HeadingNavy", parent=styles["Heading2"], textColor=NAVY, fontSize=12, leading=16, spaceBefore=12, spaceAfter=6)
normal_style = ParagraphStyle("BodyText", parent=styles["Normal"], fontSize=9.5, leading=14)
cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontSize=8, leading=10.5)
cell_bold_style = ParagraphStyle("CellTextBold", parent=cell_style, fontName="Helvetica-Bold", textColor=NAVY)
header_cell_style = ParagraphStyle("HeaderCellText", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER)
status_pass_style = ParagraphStyle("StatusPass", parent=cell_style, fontName="Helvetica-Bold", textColor=GREEN)
status_pending_style = ParagraphStyle("StatusPending", parent=cell_style, fontName="Helvetica-Bold", textColor=AMBER)
toc_style = ParagraphStyle("TocText", parent=styles["Normal"], fontSize=11, leading=20, textColor=SLATE)


def status_cell(text):
    if "Pass" in text:
        return Paragraph(text, status_pass_style)
    return Paragraph(text, status_pending_style)


# ---------------------------------------------------------------------------
# Header / footer drawn identically on every page
# ---------------------------------------------------------------------------
def draw_header_footer(canvas, doc):
    canvas.saveState()
    if os.path.isfile(LOGO_PATH):
        canvas.drawImage(
            LOGO_PATH, MARGIN, PAGE_H - MARGIN + 4,
            width=26 * mm, height=9 * mm, preserveAspectRatio=True, mask='auto',
        )
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(SLATE)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 8, "QR Code Tools Management System")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 1, "Test Case Document")
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(1)
    canvas.line(MARGIN, PAGE_H - MARGIN - 2, PAGE_W - MARGIN, PAGE_H - MARGIN - 2)

    canvas.line(MARGIN, MARGIN - 8, PAGE_W - MARGIN, MARGIN - 8)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN, MARGIN - 18, "Larsen & Toubro Limited, Construction")
    canvas.drawCentredString(PAGE_W / 2, MARGIN - 18, "Internal Use Only")
    canvas.drawRightString(PAGE_W - MARGIN, MARGIN - 18, f"Page {doc.page}")
    canvas.restoreState()


def draw_cover(canvas, doc):
    canvas.saveState()
    if os.path.isfile(LOGO_PATH):
        canvas.drawImage(
            LOGO_PATH, (PAGE_W - 60 * mm) / 2, PAGE_H - 70 * mm,
            width=60 * mm, height=22 * mm, preserveAspectRatio=True, mask='auto',
        )
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, MARGIN - 8, PAGE_W - MARGIN, MARGIN - 8)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE)
    canvas.drawCentredString(PAGE_W / 2, MARGIN - 18, "Larsen & Toubro Limited, Construction")
    canvas.restoreState()


def make_table(rows, col_widths, header=True):
    data = []
    for r_idx, row in enumerate(rows):
        if header and r_idx == 0:
            data.append([Paragraph(c, header_cell_style) for c in row])
        else:
            cells = []
            for c_idx, c in enumerate(row):
                if c_idx == 0:
                    cells.append(Paragraph(c, cell_bold_style))
                elif c_idx == len(row) - 1:
                    cells.append(status_cell(c))
                else:
                    cells.append(Paragraph(c, cell_style))
            data.append(cells)
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1 if header else 0), (-1, -1), [colors.white, LIGHT_GREY]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]
    if header:
        style.append(('BACKGROUND', (0, 0), (-1, 0), NAVY))
    t.setStyle(TableStyle(style))
    return t


# ---------------------------------------------------------------------------
# Test case data
# Columns: TC ID | Test Case | Steps | Expected Result | Status
# ---------------------------------------------------------------------------
API_COL_WIDTHS = [18 * mm, 40 * mm, 52 * mm, 42 * mm, 14 * mm]

AUTH_CASES = [
    ("TC-AUTH-01", "Reject user creation before email verification", "POST /api/users/ with an email that has not completed OTP verification", "400 - 'Email address has not been verified'", "Passed"),
    ("TC-AUTH-02", "Create user after email OTP verification", "Verify email OTP, then POST /api/users/", "200 - user object returned, hashed_password not exposed", "Passed"),
    ("TC-AUTH-03", "Reject duplicate username", "Create user 'bob'; create another user with username 'bob'", "400 - 'Username already registered'", "Passed"),
    ("TC-AUTH-04", "Reject duplicate phone number", "Create user with phone 9000000001; create another with the same phone", "400 - 'Mobile number already registered'", "Passed"),
    ("TC-AUTH-05", "Worker role logs in without OTP", "POST /api/users/token for a 'worker' account", "200 - access_token issued immediately", "Passed"),
    ("TC-AUTH-06", "Non-worker role login requires OTP", "POST /api/users/token for a 'store' account", "200 - otp_required=true, target email returned", "Passed"),
    ("TC-AUTH-07", "Full OTP login flow succeeds", "Request OTP, then submit the correct code to /verify-otp", "200 - access_token issued", "Passed"),
    ("TC-AUTH-08", "Reject an incorrect OTP", "Submit a wrong 6-digit code to /verify-otp", "400 - 'Invalid or expired verification code'", "Passed"),
    ("TC-AUTH-09", "Reject login with wrong password", "POST /api/users/token with an incorrect password", "401 Unauthorized", "Passed"),
    ("TC-AUTH-10", "Reject login for unknown username", "POST /api/users/token for a username that does not exist", "401 Unauthorized", "Passed"),
    ("TC-AUTH-11", "Reject login for a deactivated account", "Set user status='inactive'; attempt login", "403 - 'account is deactivated'", "Passed"),
    ("TC-AUTH-12", "Login using email address as the username field", "POST /api/users/token using the account's email", "200 - access_token issued", "Passed"),
]

USERS_CASES = [
    ("TC-USR-01", "Reject unauthenticated access to user list", "GET /api/users/ with no Authorization header", "401 Unauthorized", "Passed"),
    ("TC-USR-02", "List users with a valid token", "GET /api/users/ with a valid bearer token", "200 - array of users", "Passed"),
    ("TC-USR-03", "Fetch the current user's own profile", "GET /api/users/me", "200 - profile matches logged-in user", "Passed"),
    ("TC-USR-04", "User can update their own profile", "PATCH /api/users/{own_id} with a new full_name", "200 - full_name updated", "Passed"),
    ("TC-USR-05", "Non-admin cannot update another user", "PATCH /api/users/{other_id} as a non-admin", "403 Forbidden", "Passed"),
    ("TC-USR-06", "Admin can update any user", "PATCH /api/users/{other_id} as admin", "200 - target user updated", "Passed"),
    ("TC-USR-07", "Update a non-existent user", "PATCH /api/users/999999", "404 - 'User not found'", "Passed"),
    ("TC-USR-08", "Non-admin cannot delete a user", "DELETE /api/users/{id} as a non-admin", "403 Forbidden", "Passed"),
    ("TC-USR-09", "Admin can delete a user", "DELETE /api/users/{id} as admin", "204, user no longer present in list", "Passed"),
    ("TC-USR-10", "Delete a non-existent user", "DELETE /api/users/999999", "404 - 'User not found'", "Passed"),
]

TOOLS_CASES = [
    ("TC-TOOL-01", "Create a tool", "POST /api/tools/ with valid tool data", "200 - tool created, status='usable'", "Passed"),
    ("TC-TOOL-02", "Reject unauthenticated tool creation", "POST /api/tools/ with no token", "401 Unauthorized", "Passed"),
    ("TC-TOOL-03", "Reject duplicate QR code", "POST /api/tools/ twice with the same qr_code", "Non-2xx response (schema-level unique violation)", "Passed"),
    ("TC-TOOL-04", "Fetch a non-existent tool", "GET /api/tools/999999", "404 - 'Tool not found'", "Passed"),
    ("TC-TOOL-05", "Fetch a tool by ID", "GET /api/tools/{id}", "200 - correct tool returned", "Passed"),
    ("TC-TOOL-06", "Deleted tools excluded from listing", "Delete a tool, then GET /api/tools/", "Deleted tool ID absent from results", "Passed"),
    ("TC-TOOL-07", "Search tools by description", "GET /api/tools/?search=Unique", "Matching tool(s) returned", "Passed"),
    ("TC-TOOL-08", "Site change logs movement history", "PATCH /api/tools/{id} with a new current_site", "200; GET /api/movements/{id} shows the from/to record", "Passed"),
    ("TC-TOOL-09", "Update a non-existent tool", "PATCH /api/tools/999999", "404 - 'Tool not found'", "Passed"),
    ("TC-TOOL-10", "Unprinted tool is hard-deleted", "DELETE /api/tools/{id} for a tool with is_printed=false", "200; subsequent GET returns 404", "Passed"),
    ("TC-TOOL-11", "Printed tool is soft-deleted and restorable", "Mark printed, delete, then admin restores it", "Tool hidden after delete, visible again after restore", "Passed"),
    ("TC-TOOL-12", "Restore requires admin role", "POST /api/tools/{id}/restore as a non-admin", "403 Forbidden", "Passed"),
    ("TC-TOOL-13", "Look up a tool by its full QR code", "GET /api/tools/qr/{full_code}", "200 - matching tool returned", "Passed"),
    ("TC-TOOL-14", "Look up a tool by the last 4 digits of its QR code", "GET /api/tools/qr/{4-digit-suffix}", "200 - matching tool returned", "Passed"),
    ("TC-TOOL-15", "QR lookup for an unknown code", "GET /api/tools/qr/DOES-NOT-EXIST", "404 - 'Tool not found'", "Passed"),
]

INSPECTIONS_CASES = [
    ("TC-INSP-01", "Reject unauthenticated inspection submission", "POST /api/inspections/ with no token", "401 Unauthorized", "Passed"),
    ("TC-INSP-02", "Passing inspection marks tool usable", "Submit result='usable'", "Tool status='usable', inspection_result='usable'", "Passed"),
    ("TC-INSP-03", "Failing inspection marks tool scrap", "Submit result='fail'", "Tool status='scrap', inspection_result='not-usable'", "Passed"),
    ("TC-INSP-04", "Repair result marks tool under repair", "Submit result='repair'", "Tool status='under-repair'", "Passed"),
    ("TC-INSP-05", "Low usability raises a critical alert", "Submit usability_percentage=50", "An alert of type 'low-usability' is created for the tool", "Passed"),
    ("TC-INSP-06", "High usability does not raise an alert", "Submit usability_percentage=95", "No 'low-usability' alert is created", "Passed"),
    ("TC-INSP-07", "Unverified inspector cannot submit inspections", "Log in as an 'inspector' with no verified employee profile", "403 - profile must be verified first", "Passed"),
]

DEALERS_CASES = [
    ("TC-DLR-01", "Reject unauthenticated dealer creation", "POST /api/dealers/ with no token", "401 Unauthorized", "Passed"),
    ("TC-DLR-02", "Worker role cannot create a dealer", "POST /api/dealers/ as a 'worker'", "403 Forbidden", "Passed"),
    ("TC-DLR-03", "Store role can create a dealer", "POST /api/dealers/ as a 'store' user", "200 - dealer created", "Passed"),
    ("TC-DLR-04", "Admin can create a dealer", "POST /api/dealers/ as admin", "200 - dealer created", "Passed"),
    ("TC-DLR-05", "Reject an invalid dealer category", "POST /api/dealers/ with category='not-a-real-category'", "400 - invalid category message", "Passed"),
    ("TC-DLR-06", "Reject a duplicate dealer code", "Create two dealers with the same dealer_code", "400 - 'Dealer Code already exists'", "Passed"),
    ("TC-DLR-07", "Dealer code is normalized to uppercase", "Create a dealer with a lowercase dealer_code", "Stored/returned dealer_code is upper-case", "Passed"),
    ("TC-DLR-08", "Dealer list can be filtered by category", "GET /api/dealers/?category=supplier", "Only 'supplier' dealers returned", "Passed"),
]

# ---------------------------------------------------------------------------
# Frontend / UI test cases (manual - one login-to-outcome flow per feature)
# ---------------------------------------------------------------------------
UI_COL_WIDTHS = [18 * mm, 36 * mm, 60 * mm, 40 * mm, 12 * mm]

UI_LOGIN_CASES = [
    ("TC-UI-01", "Login screen loads", "Open the app while logged out", "Login form is displayed with username/password fields", "Pending"),
    ("TC-UI-02", "Successful login redirects by role", "Log in with valid credentials for each role", "User lands on that role's designated home route", "Pending"),
    ("TC-UI-03", "Invalid credentials show an error", "Submit a wrong password", "Inline error message is shown; user stays on Login", "Pending"),
    ("TC-UI-04", "Session persists across refresh", "Log in, then reload the browser tab", "User remains logged in without re-entering credentials", "Pending"),
    ("TC-UI-05", "Logout clears the session", "Click Logout from the sidebar", "User is returned to the Login screen; token cleared", "Pending"),
]

UI_ADMIN_CASES = [
    ("TC-UI-06", "Add a new tool via Tool Master", "Admin fills General/Purchase info and saves", "Tool is created with an auto-generated QR code, status='usable'", "Pending"),
    ("TC-UI-07", "Edit an existing tool", "Admin opens a tool and changes a field", "Change is saved and reflected in the Tool Master list", "Pending"),
    ("TC-UI-08", "Bulk import tools from Excel", "Admin uploads a formatted .xlsx file", "Tools are created in bulk; an info alert is raised", "Pending"),
    ("TC-UI-09", "Create a user in User Management", "Admin fills the new-user form and submits", "User appears in the list with the assigned role", "Pending"),
    ("TC-UI-10", "View the Audit Log", "Admin opens Audit Log", "Chronological list of create/update/delete/login actions is shown", "Pending"),
    ("TC-UI-11", "Manage Tool Config master list", "Admin adds/edits a tool-name + item-code entry", "New entry is available for auto-suggestion in Tool Master", "Pending"),
    ("TC-UI-12", "View Tool History timeline", "Admin opens Tool History for a tool", "Full lifecycle (creation, movements, inspections) is shown in order", "Pending"),
    ("TC-UI-13", "Adjust preferences in Settings", "Admin changes a setting and saves", "Setting is persisted and applied", "Pending"),
]

UI_STORE_CASES = [
    ("TC-UI-14", "Scan a tool via QR Scanner (Store View)", "Store user scans/searches a tool", "Tool details load and transaction options are shown", "Pending"),
    ("TC-UI-15", "Despatch (OUT) a tool with Delivery Challan", "Select Despatch, fill sub-contractor/site fields, confirm", "Tool updates (site/status); Delivery Challan preview opens", "Pending"),
    ("TC-UI-16", "Receipt (IN) a tool with Delivery Challan", "Select Receipt, fill relevant fields, confirm", "Tool updates; Delivery Challan preview opens", "Pending"),
    ("TC-UI-17", "Edit and download the Delivery Challan PDF", "Edit challan fields in the preview dialog, click Download", "Live PDF preview updates; final PDF downloads correctly", "Pending"),
    ("TC-UI-18", "Bulk Despatch/Receipt from Store Inventory", "Select multiple tools, choose Despatch or Receipt", "All selected tools update in one batch; single bulk challan opens", "Pending"),
    ("TC-UI-19", "Only usable tools can be transferred", "Attempt to despatch a 'scrap' or 'under-repair' tool", "Action is blocked with a validation message", "Pending"),
    ("TC-UI-20", "View Tools Movement History", "Store user opens Tools Movement History", "Chronological list of past despatch/receipt transactions is shown", "Pending"),
]

UI_INSPECTOR_WORKER_CASES = [
    ("TC-UI-21", "Submit an inspection", "Inspector scans/selects a tool and completes the checklist", "Result recorded; tool status updates accordingly", "Pending"),
    ("TC-UI-22", "View Inspection Results history", "Inspector/Inspection Employee opens Inspection Results", "Past inspection submissions are listed", "Pending"),
    ("TC-UI-23", "Register a new Inspection Employee", "Inspector opens Add Employee and submits the form", "New employee account is created, pending admin verification", "Pending"),
    ("TC-UI-24", "Worker scans a tool via Tool Scan", "Worker enters/scans a QR code", "Tool details are displayed read-only", "Pending"),
    ("TC-UI-25", "Split Tool Matching - correct combination", "Worker scans Part A and Part B of a matching pair", "Green 'Correct Combination' result is shown", "Pending"),
    ("TC-UI-26", "Split Tool Matching - mismatch", "Worker scans two incompatible parts", "Red 'Mismatch' result highlights the differing field", "Pending"),
]

UI_SHARED_CASES = [
    ("TC-UI-27", "Add a Dealer with Custom Fields", "Admin/Store adds a dealer and attaches custom fields", "Dealer is saved with its category, code and custom field values", "Pending"),
    ("TC-UI-28", "Dashboard KPIs render correctly", "Management/Admin opens Dashboard", "KPI counters and trend charts match current tool inventory", "Pending"),
    ("TC-UI-29", "Alerts feed shows severity-tagged items", "Any role opens Alerts", "Critical/Warning/Info alerts are listed with correct severity styling", "Pending"),
    ("TC-UI-30", "Export a Report", "Management/Admin opens Reports and exports one", "Exported file matches the on-screen summary", "Pending"),
    ("TC-UI-31", "Public Tool View via QR scan", "Scan a tool's QR code from outside the app", "Read-only tool details page loads without requiring login", "Pending"),
    ("TC-UI-32", "Responsive layout on mobile viewport", "Load the app at a mobile screen width", "Sidebar collapses to a usable mobile navigation pattern", "Pending"),
]

# ---------------------------------------------------------------------------
# Database test cases
# ---------------------------------------------------------------------------
DB_COL_WIDTHS = [18 * mm, 44 * mm, 66 * mm, 32 * mm]

DB_CASES = [
    ("TC-DB-01", "user table has company_name / gst_number columns expected by the User model", "Verified present; added via ALTER TABLE during this engagement", "Passed"),
    ("TC-DB-02", "user.email and inspector.email indexes are non-unique", "Verified - migration in main.py drops the unique index and recreates it as non-unique, allowing shared emails across accounts", "Passed"),
    ("TC-DB-03", "dealer.dealer_code enforces uniqueness at the application layer", "Verified via TC-DLR-06 (duplicate code rejected with 400)", "Passed"),
    ("TC-DB-04", "tool.qr_code is declared unique", "Verified - duplicate insert fails (surfaced as a non-2xx response; see TC-TOOL-03)", "Passed"),
    ("TC-DB-05", "Misspelled site names are normalized to TIRUNEVELI on startup", "Verified present in main.py startup migration (UPDATE ... WHERE LOWER(TRIM(site)) IN ('tiruneveli','thirunelveli'))", "Passed"),
    ("TC-DB-06", "tool, dealer, dealercustomfield custom_fields / options columns exist", "Verified present via startup ALTER TABLE ... ADD COLUMN guards", "Passed"),
    ("TC-DB-07", "Foreign key constraints exist in the production MySQL schema (tool.created_by_id, inspection.tool_id, etc.)", "Verified present in the MySQL schema dump; NOT enforced in the SQLite test suite (SQLite FK pragma is off by default), so a bad foreign key currently succeeds only under the automated test DB, not production", "Passed / Gap noted"),
    ("TC-DB-08", "Audit log retention cleanup removes entries older than 30 days", "Implemented in audit.py (cleanup_old_audit_logs); not exercised by an automated test", "Pending"),
    ("TC-DB-09", "DATABASE_URL is now read from backend/.env with a safe fallback", "Verified - backend restarts correctly with the .env value and without it", "Passed"),
]


def build_summary_table():
    rows = [
        ["Area", "Test Cases", "Passed", "Pending"],
        ["Backend / API (automated - pytest)", "52", "52", "0"],
        ["Frontend / UI (manual)", "32", "0", "32"],
        ["Database", "9", "8", "1"],
        ["Total", "93", "60", "33"],
    ]
    data = [[Paragraph(c, header_cell_style) if r == 0 else Paragraph(c, cell_bold_style if i == 0 else cell_style) for i, c in enumerate(row)] for r, row in enumerate(rows)]
    t = Table(data, colWidths=[70 * mm, 30 * mm, 30 * mm, 30 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('BACKGROUND', (0, -1), (-1, -1), LIGHT_GREY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))
    return t


def build_doc():
    doc = BaseDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN + 6 * mm, bottomMargin=MARGIN,
    )
    body_frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    cover_frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="cover")

    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=draw_cover),
        PageTemplate(id="Body", frames=[body_frame], onPage=draw_header_footer),
    ])

    elements = []

    # ================= COVER PAGE =================
    elements.append(Spacer(1, 75 * mm))
    elements.append(Paragraph("QR Code Tools Management System", title_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Test Case Document", subtitle_style))
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(f"Prepared on: {datetime.now().strftime('%d %B %Y')}", ParagraphStyle("CoverMeta", parent=normal_style, alignment=TA_CENTER)))
    elements.append(Paragraph("Larsen &amp; Toubro Limited, Construction", ParagraphStyle("CoverMeta2", parent=normal_style, alignment=TA_CENTER, textColor=NAVY, fontName="Helvetica-Bold")))
    elements.append(NextPageTemplate("Body"))
    elements.append(PageBreak())

    # ================= INTRODUCTION =================
    elements.append(Paragraph("1. Introduction &amp; Scope", section_style))
    elements.append(Paragraph(
        "This document records the test cases prepared for the QR Code Tools Management System, "
        "covering the Backend REST API, the Frontend (React) UI, and the underlying MySQL database. "
        "Backend/API test cases are automated (pytest, FastAPI TestClient, isolated in-memory SQLite "
        "per test) and have all been executed and passed. Frontend/UI test cases are written for manual "
        "execution, since no automated UI test runner (e.g. Vitest/Playwright) is currently configured in "
        "this project. Database test cases record schema and constraint checks verified directly against "
        "the running MySQL instance during this engagement.",
        normal_style,
    ))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Test Environment", heading_style))
    env_rows = [
        ["Component", "Details"],
        ["Backend", "FastAPI + SQLModel, Python 3.14; automated tests run against an isolated in-memory SQLite DB per test"],
        ["Frontend", "React 18 + TypeScript (Vite), served at http://localhost:5173"],
        ["API", "Served under the /api prefix at http://localhost:8000, documented at /docs"],
        ["Database (production)", "MySQL, database qr_tools_db, accessed via SQLModel/PyMySQL"],
        ["Test Runner", "pytest (backend/tests), 52 automated cases"],
    ]
    env_data = [[Paragraph(c, header_cell_style) if r == 0 else (Paragraph(c, cell_bold_style) if i == 0 else Paragraph(c, cell_style)) for i, c in enumerate(row)] for r, row in enumerate(env_rows)]
    env_table = Table(env_data, colWidths=[38 * mm, 122 * mm], repeatRows=1)
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(env_table))
    elements.append(PageBreak())

    # ================= SUMMARY =================
    elements.append(Paragraph("2. Test Execution Summary", section_style))
    elements.append(KeepTogether(build_summary_table()))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "All 52 backend/API test cases are automated and passing (see backend/tests/, run via "
        "<font face='Courier'>python -m pytest backend/tests</font>). Frontend/UI test cases are "
        "documented below for manual QA execution. Database test cases reflect schema state verified "
        "directly against MySQL during this engagement.",
        normal_style,
    ))
    elements.append(PageBreak())

    # ================= BACKEND / API =================
    elements.append(Paragraph("3. Backend / API Test Cases (Automated)", section_style))

    api_sections = [
        ("3.1 Authentication &amp; User Registration", AUTH_CASES),
        ("3.2 User Management", USERS_CASES),
        ("3.3 Tool Master &amp; Lifecycle", TOOLS_CASES),
        ("3.4 Inspections", INSPECTIONS_CASES),
        ("3.5 Dealers", DEALERS_CASES),
    ]
    header_row = ["TC ID", "Test Case", "Steps", "Expected Result", "Status"]
    for title, cases in api_sections:
        elements.append(Paragraph(title, heading_style))
        rows = [header_row] + [list(c) for c in cases]
        elements.append(make_table(rows, API_COL_WIDTHS))
        elements.append(Spacer(1, 8))
    elements.append(PageBreak())

    # ================= FRONTEND / UI =================
    elements.append(Paragraph("4. Frontend / UI Test Cases (Manual)", section_style))
    elements.append(Paragraph(
        "These test cases should be executed manually against the running application at "
        "http://localhost:5173, with the backend running at http://localhost:8000. Status will be "
        "updated to Passed/Failed as each is executed by QA.",
        normal_style,
    ))
    elements.append(Spacer(1, 6))

    ui_sections = [
        ("4.1 Login &amp; Session", UI_LOGIN_CASES),
        ("4.2 Admin - Tool Master, Users, Audit, Config, Settings", UI_ADMIN_CASES),
        ("4.3 Store - Scanning, Despatch/Receipt, Delivery Challan", UI_STORE_CASES),
        ("4.4 Inspector, Inspection Employee &amp; Worker", UI_INSPECTOR_WORKER_CASES),
        ("4.5 Shared - Dealers, Dashboard, Alerts, Reports, Public View, Responsiveness", UI_SHARED_CASES),
    ]
    for title, cases in ui_sections:
        elements.append(Paragraph(title, heading_style))
        rows = [header_row] + [list(c) for c in cases]
        elements.append(make_table(rows, UI_COL_WIDTHS))
        elements.append(Spacer(1, 8))
    elements.append(PageBreak())

    # ================= DATABASE =================
    elements.append(Paragraph("5. Database Test Cases", section_style))
    elements.append(Paragraph(
        "Schema and constraint checks verified directly against the MySQL database (qr_tools_db) and "
        "the SQLModel migrations run at backend startup.",
        normal_style,
    ))
    elements.append(Spacer(1, 6))
    db_header = ["TC ID", "Test Case", "Verification / Notes", "Status"]
    db_rows = [db_header] + [list(c) for c in DB_CASES]
    elements.append(make_table(db_rows, DB_COL_WIDTHS))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_doc()
