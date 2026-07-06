"""One-off script: generates a formal Test Case Report PDF covering the
backend/API, database, and frontend of the QR Tool Management System.

Run with: python backend/generate_test_cases_report_pdf.py
"""
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(BASE_DIR, "src", "assets", "lt-logo.png")
OUTPUT_PATH = os.path.join(BASE_DIR, "QR_Tool_Management_System_Test_Cases_Report.pdf")

NAVY = colors.HexColor("#1E3A8A")
LIGHT_GREY = colors.HexColor("#F3F4F6")
GREEN = colors.HexColor("#15803D")
AMBER = colors.HexColor("#B45309")

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleNavy", parent=styles["Title"], textColor=NAVY)
heading_style = ParagraphStyle("HeadingNavy", parent=styles["Heading2"], textColor=NAVY, spaceBefore=14, spaceAfter=6)
sub_heading_style = ParagraphStyle("SubHeadingNavy", parent=styles["Heading3"], textColor=NAVY, spaceBefore=10, spaceAfter=4)
normal_style = ParagraphStyle("BodyText", parent=styles["Normal"], leading=14)
cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontSize=8, leading=10.5)
header_cell_style = ParagraphStyle("HeaderCellText", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=colors.whitesmoke, fontName="Helvetica-Bold")


def status_style(color):
    return ParagraphStyle("Status", parent=cell_style, textColor=color, fontName="Helvetica-Bold")


PASSED = Paragraph("Passed", status_style(GREEN))
CONFIRMED = Paragraph("Confirmed", status_style(GREEN))
PENDING = Paragraph("Pending Exec.", status_style(colors.HexColor("#334155")))
GAP = Paragraph("Known Gap", status_style(AMBER))


# ---------------------------------------------------------------------------
# 1. Backend / API automated test cases (pytest, backend/tests/) - 52 tests,
#    all passing at time of writing. (id, test case, expected result)
# ---------------------------------------------------------------------------

AUTH_TESTS = [
    ("AUTH-01", "Create user without a verified email", "Rejected with 400 - email has not been verified"),
    ("AUTH-02", "Create user after email OTP is verified", "User created successfully (200), password hash never returned"),
    ("AUTH-03", "Create user with a username already registered", "Rejected with 400 - username already registered"),
    ("AUTH-04", "Create user with a phone number already registered to another account", "Rejected with 400 - mobile number already registered"),
    ("AUTH-05", "Login as a Worker-role user", "Access token returned directly, no OTP step required"),
    ("AUTH-06", "Login as a non-Worker role (e.g. Store)", "Response has otp_required=true with the masked destination email"),
    ("AUTH-07", "Complete the OTP flow for a non-Worker role", "Correct OTP exchanges for a valid access token"),
    ("AUTH-08", "Submit an incorrect OTP code", "Rejected with 400 - invalid or expired verification code"),
    ("AUTH-09", "Login with an incorrect password", "Rejected with 401 Unauthorized"),
    ("AUTH-10", "Login with an unknown username", "Rejected with 401 Unauthorized"),
    ("AUTH-11", "Login to a deactivated (status=inactive) account", "Rejected with 403 - account deactivated"),
    ("AUTH-12", "Login using the registered email instead of username", "Login succeeds identically to username login"),
]

USER_TESTS = [
    ("USR-01", "List users with no auth token", "Rejected with 401 Unauthorized"),
    ("USR-02", "List users with a valid token", "200 OK, returns a list of users"),
    ("USR-03", "GET /users/me", "Returns the authenticated user's own profile"),
    ("USR-04", "User updates their own profile", "200 OK, field changes are persisted"),
    ("USR-05", "Non-admin user updates a different user's profile", "Rejected with 403 Forbidden"),
    ("USR-06", "Admin updates another user's profile", "200 OK, field changes are persisted"),
    ("USR-07", "Update a user ID that does not exist", "404 Not Found"),
    ("USR-08", "Attempt to delete a user (any role, any user ID)", "Rejected with 400 - deletion is permanently disabled in favor of the disable toggle"),
    ("USR-09", "Admin disables a user via PATCH status=inactive", "200 OK; that user is subsequently blocked from logging in (403)"),
    ("USR-10", "Attempt to delete a user ID that does not exist", "Rejected with 400 - same as any other delete attempt"),
]

DEALER_TESTS = [
    ("DLR-01", "Create a dealer with no auth token", "Rejected with 401 Unauthorized"),
    ("DLR-02", "Worker role creates a dealer", "Rejected with 403 - not authorized to manage dealers"),
    ("DLR-03", "Store role creates a dealer", "200 OK, dealer created"),
    ("DLR-04", "Admin role creates a dealer", "200 OK, dealer created"),
    ("DLR-05", "Create a dealer with an invalid category", "Rejected with 400 - invalid dealer category"),
    ("DLR-06", "Create a dealer with a dealer_code that already exists", "Rejected with 400 - dealer code already exists"),
    ("DLR-07", "Create a dealer with a lower-case dealer_code", "dealer_code is normalized to upper-case on save"),
    ("DLR-08", "List dealers filtered by category", "Only dealers in the requested category are returned"),
]

INSPECTION_TESTS = [
    ("INSP-01", "Create an inspection with no auth token", "Rejected with 401 Unauthorized"),
    ("INSP-02", "Submit an inspection with result=usable", "Tool status becomes usable, inspection_result=usable"),
    ("INSP-03", "Submit an inspection with result=fail", "Tool status becomes scrap, inspection_result=not-usable"),
    ("INSP-04", "Submit an inspection with result=repair", "Tool status becomes under-repair"),
    ("INSP-05", "Submit an inspection with usability_percentage=50", "A critical low-usability Alert is generated for the tool"),
    ("INSP-06", "Submit an inspection with usability_percentage=95", "No low-usability Alert is generated"),
    ("INSP-07", "Inspector role without a verified employee profile submits an inspection", "Rejected with 403 - profile must be verified first"),
]

TOOL_TESTS = [
    ("TOOL-01", "Create a tool as an authenticated user", "200 OK, tool created with status=usable"),
    ("TOOL-02", "Create a tool with no auth token", "Rejected with 401 Unauthorized"),
    ("TOOL-03", "Create a tool with a QR code that already exists", "Rejected with 400 - a tool with this QR code already exists"),
    ("TOOL-04", "Request a tool by an ID that does not exist", "404 Not Found"),
    ("TOOL-05", "Retrieve a tool by its ID", "200 OK, correct tool data returned"),
    ("TOOL-06", "List tools after deleting one", "Deleted tool is excluded from the default list"),
    ("TOOL-07", "Search tools by description text", "Matching tool(s) are returned"),
    ("TOOL-08", "Change a tool's current_site via PATCH", "A Movement History record (from -> to) is created"),
    ("TOOL-09", "Update a tool ID that does not exist", "404 Not Found"),
    ("TOOL-10", "Delete a tool that was never printed", "Hard delete - the row is fully removed"),
    ("TOOL-11", "Delete a tool that has been marked as printed", "Soft delete (is_deleted=true); admin can restore it afterward"),
    ("TOOL-12", "Non-admin attempts to restore a deleted tool", "Rejected with 403 Forbidden"),
    ("TOOL-13", "Look up a tool by its full QR code", "200 OK, correct tool returned"),
    ("TOOL-14", "Look up a tool by only the last 4 digits of its QR code", "200 OK, correct tool returned"),
    ("TOOL-15", "Look up a QR code that does not exist", "404 Not Found"),
]

BACKEND_SECTIONS = [
    ("Authentication & Registration", AUTH_TESTS),
    ("Users & Access Control", USER_TESTS),
    ("Dealers", DEALER_TESTS),
    ("Inspections", INSPECTION_TESTS),
    ("Tools (Tool Master)", TOOL_TESTS),
]

# ---------------------------------------------------------------------------
# 2. Database-level test cases (constraints / integrity, verified either via
#    the API suite above or by direct schema/code inspection)
# ---------------------------------------------------------------------------

DB_TESTS = [
    ("DB-01", "user.username has a unique constraint", "Duplicate usernames are rejected (see AUTH-03)", PASSED),
    ("DB-02", "tool.qr_code has a unique index", "Duplicate QR codes are rejected with a clean 400 before hitting the DB constraint (see TOOL-03)", PASSED),
    ("DB-03", "dealer.dealer_code has a unique constraint", "Duplicate dealer codes are rejected (see DLR-06)", PASSED),
    ("DB-04", "Passwords are never stored or returned as plaintext", "hashed_password (bcrypt) is excluded from every API response model", PASSED),
    ("DB-05", "inspection.tool_id / inspection.inspector_id are foreign keys", "Production MySQL schema enforces FK constraints to tool.id / user.id", CONFIRMED),
    ("DB-06", "tool.created_by_id is a foreign key to user.id", "Automatically populated from the authenticated user on create", PASSED),
    ("DB-07", "Soft-delete (is_deleted) hides printed tools without losing data", "Row and history are preserved; tool disappears from active views (see TOOL-11)", PASSED),
    ("DB-08", "Hard-deleting an unprinted tool cascades correctly", "Its Inspection/MovementHistory rows are deleted; related Alert rows have tool_id nulled instead of being deleted", CONFIRMED),
    ("DB-09", "Audit log 30-day retention purge", "AuditLog entries older than 30 days are deleted every time a new action is logged", CONFIRMED),
    ("DB-10", "Live MySQL schema (qr_tools_db) matches the SQLModel schema", "All 11 tables match, including company_name/gst_number columns added to `user` during this engagement", CONFIRMED),
]

# ---------------------------------------------------------------------------
# 3. Frontend test cases (manual/functional - no automated frontend harness
#    is configured in this project yet, see Known Gaps)
# ---------------------------------------------------------------------------

FE_LOGIN = [
    ("FE-LOGIN-01", "Select the “Worker” role card", "Logs in immediately as a guest, no credentials form shown, navigates to /worker"),
    ("FE-LOGIN-02", "Submit valid credentials for an OTP-required role (e.g. Store)", "Transitions to the OTP-verification screen showing the masked email/phone"),
    ("FE-LOGIN-03", "Enter the correct OTP", "Login completes and routes to that role's landing page (Store -> /store-view)"),
    ("FE-LOGIN-04", "Log in with valid credentials under the wrong role card (e.g. a Store user selects Admin)", "Rejected client-side with “Invalid username or password”"),
    ("FE-LOGIN-05", "An Admin account logs in through any role portal", "Login succeeds regardless of the selected role card (admin bypass)"),
    ("FE-LOGIN-06", "Upload a QR code image on the login screen before logging in", "Scanned code carries through to the destination page after login"),
    ("FE-LOGIN-07", "Attempt login while the backend is unreachable", "Distinct network/server error message, not the generic invalid-credentials message"),
]

FE_DASH = [
    ("FE-DASH-01", "Load the Dashboard", "Stat cards (Total, Usable, Scrap, Under Repair, Pending, Expiring, Overdue) reflect current inventory"),
    ("FE-DASH-02", "Click the “Deleted (Printed)” stat card", "Opens a modal listing soft-deleted tools"),
    ("FE-DASH-03", "View Dashboard as a non-admin role", "“Filter Creator”/“Filter Store” dropdowns and the Restore action are hidden"),
    ("FE-DASH-04", "Admin restores a tool from the Deleted Tools modal", "Tool reappears in the active inventory afterward"),
    ("FE-DASH-05", "Load Dashboard with unread expiry alerts pending", "Alert modal auto-opens; “Acknowledge All” marks them read"),
    ("FE-DASH-06", "Apply a filter, then Export PDF/Excel", "Exported report reflects the filtered data set, not the full inventory"),
]

FE_TM = [
    ("FE-TM-01", "Submit the New Tool form missing a required field (e.g. Capacity)", "Save is blocked; the missing field is highlighted"),
    ("FE-TM-02", "Fill in Name/Metal/Variant/Capacity/Date/Purchaser for a new tool", "The QR/Tool ID preview updates live as each field changes"),
    ("FE-TM-03", "Save a new tool with Inspection Result = “not-usable”", "Tool status is set to “scrap” automatically"),
    ("FE-TM-04", "Upload an existing tool's QR image via “Scan to Autofill”", "Form is populated for editing by looking the tool up via its QR code"),
    ("FE-TM-05", "Admin/Data-Entry runs Bulk Import with an Excel file", "After import, “Zip QR download” and “Excel with QR link” actions appear"),
    ("FE-TM-06", "View the Existing Inventory tab as a non-admin role", "Edit and Delete actions are not visible"),
    ("FE-TM-07", "Click Delete on a tool row", "A native browser confirm dialog appears before the delete request is sent"),
    ("FE-TM-08", "Type in the search box after navigating to page 2 of the inventory", "Pagination resets back to page 1"),
]

FE_STORE = [
    ("FE-STORE-01", "Open Store Inventory as a Store Manager", "Only tools currently at that manager's own site are listed"),
    ("FE-STORE-02", "Open Store Inventory with no tools in “pending” status", "The Pending Returns panel is not shown"),
    ("FE-STORE-03", "Resolve Status -> Extend without entering a reason", "Submission is blocked until a reason and a positive day count are entered"),
    ("FE-STORE-04", "Resolve Status -> Missing", "Tool is permanently marked as missing"),
    ("FE-STORE-05", "Select rows and click “Receipt (IN)”", "Navigates to Tools Movements with the selection carried in route state"),
    ("FE-STORE-06", "Attempt an OUT transaction on a tool that is not “usable”", "Blocked with a toast, except Scrap Disposal (requires status=scrap)"),
    ("FE-STORE-07", "Attempt “Sub-Contractor Return” on a tool with no subcontractor_name recorded", "The option is disabled"),
    ("FE-STORE-08", "Enter a mobile number that is not exactly 10 digits", "Inline validation error is shown; submission is blocked"),
    ("FE-STORE-09", "Complete a successful IN/OUT transaction", "An editable Delivery Challan PDF preview is generated before download"),
]

FE_MOVE = [
    ("FE-MOVE-01", "Navigate to Tools Movements with no bulk selection made", "Empty-state message directs the user back to Store Inventory"),
    ("FE-MOVE-02", "Run a Bulk OUT to a subcontractor/site/store with a mix of tool statuses selected", "Only tools currently “usable” are actually processed"),
    ("FE-MOVE-03", "Submit Bulk OUT for Sub-Contractor Work without a valid 10-digit mobile number", "Submission is blocked with an inline error"),
    ("FE-MOVE-04", "Search Movement History by tool/site/remarks/user", "Results are scoped to the logged-in store's own site and match the search text"),
]

FE_INSP = [
    ("FE-INSP-01", "Open Inspection Results", "Page is read-only - no create/edit controls are present"),
    ("FE-INSP-02", "Search Inspection Results", "Filters across tool description, QR code, result, remarks, and inspector name"),
    ("FE-INSP-03", "Admin clicks “Verify” on a Pending inspection employee", "Badge changes to Verified"),
    ("FE-INSP-04", "Admin clicks “Unverify” on a Verified inspection employee", "Badge reverts to Pending"),
    ("FE-INSP-05", "Click an inspection employee's name", "Opens a dialog listing every tool that employee has inspected"),
]

FE_DEALER = [
    ("FE-DEALER-01", "Switch between Sub-Contractor / Supplier / Scrap-Dealer tabs", "Field labels change and the Products/Services dropdown resets"),
    ("FE-DEALER-02", "Submit Add Dealer without Name, Company Name, or Dealer Code", "Submission is blocked"),
    ("FE-DEALER-03", "Enter a lower-case Dealer Code and submit", "Code is uppercased automatically"),
    ("FE-DEALER-04", "Click Delete on a dealer", "Native confirm dialog appears before the delete request is sent"),
    ("FE-DEALER-05", "View the page as a non-admin (Store) user", "Bulk Import and Custom Fields management are not visible"),
    ("FE-DEALER-06", "Search/paginate one category tab (e.g. Suppliers)", "Other category tabs' search/pagination state is unaffected"),
]

FE_USERS = [
    ("FE-USERS-01", "Attempt to add a user before verifying the email OTP", "“Add User” is blocked until Send OTP -> Verify succeeds"),
    ("FE-USERS-02", "Change the email after OTP verification succeeded", "Verified flag resets, forcing re-verification before the user can be added"),
    ("FE-USERS-03", "Select Role = Store", "Site field switches to free text for creating a brand-new store location"),
    ("FE-USERS-04", "Select Role = Management", "Site field is hidden (not required)"),
    ("FE-USERS-05", "Enter a phone number that fails the 10-digit format check", "Inline validation error is shown"),
    ("FE-USERS-06", "View the combined user table", "Regular users and Inspection Employees appear together, inspector IDs prefixed “insp-”"),
    ("FE-USERS-07", "Add a new user with Role = Store and a new site name", "New site is immediately available in other Site dropdowns without a page reload"),
]

FE_ALERT = [
    ("FE-ALERT-01", "Open Alerts and switch between Critical/Warning/Info/All tabs", "Unread counts per severity match the tab contents"),
    ("FE-ALERT-02", "Click “Mark as Read” on a single unread alert", "Alert state updates via the read endpoint"),
    ("FE-ALERT-03", "Click “Mark All as Read”", "Every unread alert is marked read via the API (fixed - previously only showed a toast with no API call)"),
    ("FE-ALERT-04", "Search the Audit Log", "Filters across description, username, action, entity_type, and site"),
    ("FE-ALERT-05", "Export PDF/DOC from Audit Log with an empty filtered result set", "Export buttons are disabled; when enabled, they export only the filtered rows"),
]

FE_REPORT = [
    ("FE-REPORT-01", "Combine the global search box with per-column filters, then click “Clear Filters”", "Both the global search and column filters are reset together"),
    ("FE-REPORT-02", "Apply a filter, then Export PDF/CSV", "Export reflects only the filtered result set"),
    ("FE-REPORT-03", "View a tool row that has a test_certificate on file", "A working certificate download link is shown"),
    ("FE-REPORT-04", "Click a tool's description", "Opens a detail card with QR code, supplier info, and site-movement history"),
]

FE_SET = [
    ("FE-SET-01", "Enter an invalid Company Email on the General tab and click Save", "Save is blocked with an inline format error"),
    ("FE-SET-02", "Enter a Phone number on the General tab in an invalid format", "Inline validation error is shown"),
    ("FE-SET-03", "Change General/Notifications/Security settings, save, then refresh the page", "KNOWN GAP: changes revert - there is no backend persistence for these tabs"),
    ("FE-SET-04", "Toggle a role under Dashboard Access Permissions (Security tab)", "Takes effect immediately for that role via localStorage - the one functionally real Settings feature"),
    ("FE-SET-05", "Click “Export Reports” on the Data & Backup tab", "KNOWN GAP: no handler is wired - the button does nothing"),
    ("FE-SET-06", "Click “Create Backup Now”", "Backup PDF is emailed to the registered address; success toast shows that address"),
    ("FE-SET-07", "Delete a Tool Config entry that has already-printed matching tools", "Deletion is blocked with an explanatory message instead of failing silently"),
]

FE_QR = [
    ("FE-QR-01", "Click “Start Camera Scanner”", "Requests camera permission; shows an inline error if denied/unavailable"),
    ("FE-QR-02", "Successfully scan a valid QR code", "Scanner Dialog auto-closes and passes the extracted code (URL prefix stripped if present) to the parent page"),
    ("FE-QR-03", "Point the camera away from any QR code briefly", "Routine “no QR in frame” exceptions are silently ignored, not shown as errors"),
]

FRONTEND_SECTIONS = [
    ("Login & Authentication", FE_LOGIN),
    ("Dashboard", FE_DASH),
    ("Tool Master", FE_TM),
    ("Store Inventory & Store View", FE_STORE),
    ("Tools Movements & Movement History", FE_MOVE),
    ("Inspection Results & Inspection Employees", FE_INSP),
    ("Dealers", FE_DEALER),
    ("Users Management", FE_USERS),
    ("Alerts & Audit Log", FE_ALERT),
    ("Reports", FE_REPORT),
    ("Settings & Tool Config", FE_SET),
    ("QR Scanner", FE_QR),
]

KNOWN_GAPS = [
    "No automated frontend test harness (Vitest/React Testing Library or Playwright) is configured yet - "
    "all Frontend test cases in this report are documented for manual execution rather than run in a browser.",
    "Settings General/Notifications/Security tabs do not persist to the backend - only the Dashboard Access "
    "Permissions toggle actually takes effect (FE-SET-03/04).",
    "Settings → Data & Backup → “Export Reports” button has no handler wired (FE-SET-05).",
    "The legacy backend/test_api.py script predates the /api routing prefix used throughout main.py and no "
    "longer runs against the current app; it has been superseded by the backend/tests/ pytest suite.",
]

FIXED_THIS_PASS = [
    "TOOL-03 / DB-02: creating a Tool with a duplicate QR code previously surfaced as an unhandled 500 error; "
    "backend/routes/tools.py now checks for an existing qr_code first and returns a clean 400 Bad Request.",
    "FE-ALERT-03: the Alerts page's “Mark All as Read” button previously only showed a success toast with no "
    "API call; it now calls POST /alerts/{id}/read for every unread alert and updates state from the result.",
    "The Alerts page's dead, never-wired handleResolve function (no button actually triggered it) was removed "
    "as unused code rather than left as a misleading stub.",
]

RECOMMENDATIONS = [
    "Add Vitest + React Testing Library (component/unit level) and/or Playwright (end-to-end) so the Frontend "
    "test cases in this report can run automatically in CI rather than remaining manual.",
    "Either implement or remove the stubbed Settings actions (General/Notifications/Security persistence, "
    "“Export Reports”) so the UI does not imply a persisted change that never happens.",
    "Retire or update backend/test_api.py to match the current /api-prefixed routes, or delete it in favor of "
    "the backend/tests/ suite to avoid confusing future contributors.",
]


def build_table(rows, col_widths, header):
    data = [[Paragraph(h, header_cell_style) for h in header]]
    for row in rows:
        data.append([cell if isinstance(cell, Paragraph) else Paragraph(str(cell), cell_style) for cell in row])
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GREY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return table


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        rightMargin=36, leftMargin=36, topMargin=40, bottomMargin=40,
    )
    elements = []

    # --- Cover ---
    if os.path.isfile(LOGO_PATH):
        logo = Image(LOGO_PATH, width=2.0 * inch, height=0.8 * inch)
        logo.hAlign = "CENTER"
        elements.append(logo)
        elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("QR Tool Management System", title_style))
    elements.append(Paragraph("Test Case Report", heading_style))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Paragraph(f"Prepared on: {datetime.now().strftime('%d %B %Y')}", normal_style))
    elements.append(Spacer(1, 0.25 * inch))
    elements.append(Paragraph(
        "This report documents the test cases covering the QR Tool Management System's backend API, "
        "database layer, and frontend application. Backend and Database sections were executed as an "
        "automated pytest suite (backend/tests/) against an isolated in-memory database and are reported "
        "with a real Pass/Confirmed status. Frontend sections are documented functional test cases based on "
        "a detailed review of the application's actual behavior; as no automated frontend test harness is "
        "configured in this project yet (see Known Gaps), they are marked Pending Execution rather than Passed. "
        "Two real defects found while writing these test cases were fixed directly in this pass rather than "
        "only being logged - see Section 4, Fixes Applied.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.25 * inch))

    summary_rows = [
        ("Backend / API (automated, pytest)", "52", "All Passed"),
        ("Database (constraints & integrity)", "10", "Passed / Confirmed by inspection"),
        ("Frontend (documented functional cases)", "71", "Pending manual/automated execution"),
        ("Known gaps identified", str(len(KNOWN_GAPS)), "See Known Gaps section"),
        ("Defects fixed this pass", str(len(FIXED_THIS_PASS)), "See Fixes Applied section"),
    ]
    elements.append(Paragraph("Summary", heading_style))
    elements.append(build_table(
        summary_rows,
        col_widths=[3.4 * inch, 0.9 * inch, 2.5 * inch],
        header=["Area", "Test Cases", "Result"],
    ))
    elements.append(PageBreak())

    # --- Backend / API sections ---
    elements.append(Paragraph("1. Backend / API Test Cases (Automated)", heading_style))
    elements.append(Paragraph(
        "Executed via <b>python -m pytest backend/tests</b> against an isolated in-memory SQLite database, "
        "with the app's real dependency-injection wired through a test client. All 52 tests passed.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.1 * inch))
    for title, tests in BACKEND_SECTIONS:
        elements.append(Paragraph(title, sub_heading_style))
        rows = [(tid, desc, expected, PASSED) for tid, desc, expected in tests]
        elements.append(build_table(
            rows,
            col_widths=[0.6 * inch, 2.3 * inch, 3.1 * inch, 0.7 * inch],
            header=["ID", "Test Case", "Expected Result", "Status"],
        ))
        elements.append(Spacer(1, 0.12 * inch))
    elements.append(PageBreak())

    # --- Database section ---
    elements.append(Paragraph("2. Database Test Cases", heading_style))
    elements.append(Paragraph(
        "Constraint and integrity checks against the MySQL/SQLModel schema (qr_tools_db). Items already "
        "exercised by the API suite above are marked Passed; items verified by direct schema or code "
        "inspection (not currently expressed as an isolated automated test) are marked Confirmed.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.1 * inch))
    rows = [(tid, desc, expected, status) for tid, desc, expected, status in DB_TESTS]
    elements.append(build_table(
        rows,
        col_widths=[0.6 * inch, 2.3 * inch, 3.1 * inch, 0.7 * inch],
        header=["ID", "Test Case", "Expected Result", "Status"],
    ))
    elements.append(PageBreak())

    # --- Frontend sections ---
    elements.append(Paragraph("3. Frontend Test Cases", heading_style))
    elements.append(Paragraph(
        "Documented functional test cases derived from a detailed review of each page's actual implemented "
        "behavior. No automated frontend test harness is configured in this project (see Known Gaps), so "
        "these are marked Pending Execution; cases marked Known Gap describe UI actions that do not do what "
        "a user would reasonably expect.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.1 * inch))
    for title, tests in FRONTEND_SECTIONS:
        elements.append(Paragraph(title, sub_heading_style))
        rows = []
        for tid, desc, expected in tests:
            status = GAP if "KNOWN GAP" in expected else PENDING
            rows.append((tid, desc, expected, status))
        elements.append(build_table(
            rows,
            col_widths=[0.75 * inch, 2.35 * inch, 2.9 * inch, 0.7 * inch],
            header=["ID", "Test Case", "Expected Result", "Status"],
        ))
        elements.append(Spacer(1, 0.12 * inch))
    elements.append(PageBreak())

    # --- Fixes Applied, Known Gaps & Recommendations ---
    elements.append(Paragraph("4. Fixes Applied This Pass", heading_style))
    elements.append(Paragraph(
        "Real defects surfaced by writing and running these test cases were fixed directly, then re-verified "
        "by re-running the full automated suite (52/52 passing) before this report was regenerated.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.06 * inch))
    for fix in FIXED_THIS_PASS:
        elements.append(Paragraph(f"• {fix}", normal_style))
        elements.append(Spacer(1, 0.06 * inch))

    elements.append(Spacer(1, 0.15 * inch))
    elements.append(Paragraph("5. Known Gaps", heading_style))
    for gap in KNOWN_GAPS:
        elements.append(Paragraph(f"• {gap}", normal_style))
        elements.append(Spacer(1, 0.06 * inch))

    elements.append(Spacer(1, 0.15 * inch))
    elements.append(Paragraph("6. Recommendations", heading_style))
    for rec in RECOMMENDATIONS:
        elements.append(Paragraph(f"• {rec}", normal_style))
        elements.append(Spacer(1, 0.06 * inch))

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph("QR Tool Management System &middot; L&amp;T Construction", cell_style))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
