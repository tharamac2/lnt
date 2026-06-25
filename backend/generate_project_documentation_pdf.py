"""One-off script: generates the Project Documentation, User Flow and
Information Architecture PDF for the QR Code Tools Management System,
branded with the L&T logo.

Run with: python backend/generate_project_documentation_pdf.py
"""
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, NextPageTemplate,
    Table, TableStyle, Paragraph, Spacer, Image, PageBreak, ListFlowable, ListItem,
    KeepTogether,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(BASE_DIR, "src", "assets", "lt-logo.png")
OUTPUT_PATH = os.path.join(BASE_DIR, "QR_Tool_Management_System_Project_Documentation.pdf")

NAVY = colors.HexColor("#1E3A8A")
SLATE = colors.HexColor("#334155")
LIGHT_GREY = colors.HexColor("#F3F4F6")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleNavy", parent=styles["Title"], textColor=NAVY, fontSize=24, leading=28, alignment=TA_CENTER)
subtitle_style = ParagraphStyle("SubtitleNavy", parent=styles["Heading2"], textColor=SLATE, fontSize=13, leading=17, alignment=TA_CENTER, fontName="Helvetica")
section_style = ParagraphStyle("SectionNavy", parent=styles["Heading1"], textColor=WHITE, fontSize=14, leading=18, spaceAfter=10, backColor=NAVY, borderPadding=(6, 8, 6, 8))
heading_style = ParagraphStyle("HeadingNavy", parent=styles["Heading2"], textColor=NAVY, fontSize=12.5, leading=16, spaceBefore=14, spaceAfter=6)
sub_heading_style = ParagraphStyle("SubHeadingNavy", parent=styles["Heading3"], textColor=NAVY, fontSize=10.5, leading=14, spaceBefore=10, spaceAfter=4)
normal_style = ParagraphStyle("BodyText", parent=styles["Normal"], fontSize=9.5, leading=14)
bullet_style = ParagraphStyle("BulletText", parent=normal_style, leftIndent=0, spaceAfter=3)
cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontSize=8.5, leading=11.5)
cell_bold_style = ParagraphStyle("CellTextBold", parent=cell_style, fontName="Helvetica-Bold", textColor=NAVY)
header_cell_style = ParagraphStyle("HeaderCellText", parent=styles["Normal"], fontSize=9, leading=12, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER)
toc_style = ParagraphStyle("TocText", parent=styles["Normal"], fontSize=11, leading=20, textColor=SLATE)


# ---------------------------------------------------------------------------
# Header / footer drawn identically on every page for consistent alignment
# ---------------------------------------------------------------------------
def draw_header_footer(canvas, doc):
    canvas.saveState()

    # Header rule + logo + running title
    if os.path.isfile(LOGO_PATH):
        canvas.drawImage(
            LOGO_PATH, MARGIN, PAGE_H - MARGIN + 4,
            width=26 * mm, height=9 * mm, preserveAspectRatio=True, mask='auto',
        )
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(SLATE)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 8, "QR Code Tools Management System")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 1, "Project Documentation, User Flow & Information Architecture")
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(1)
    canvas.line(MARGIN, PAGE_H - MARGIN - 2, PAGE_W - MARGIN, PAGE_H - MARGIN - 2)

    # Footer rule + page number + company
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
    elements.append(Paragraph("Project Documentation, User Flow &amp; Information Architecture", subtitle_style))
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(f"Prepared on: {datetime.now().strftime('%d %B %Y')}", ParagraphStyle("CoverMeta", parent=normal_style, alignment=TA_CENTER)))
    elements.append(Paragraph("Larsen &amp; Toubro Limited, Construction", ParagraphStyle("CoverMeta2", parent=normal_style, alignment=TA_CENTER, textColor=NAVY, fontName="Helvetica-Bold")))
    elements.append(NextPageTemplate("Body"))
    elements.append(PageBreak())

    # ================= TABLE OF CONTENTS =================
    elements.append(Paragraph("Table of Contents", section_style))
    toc_items = [
        "1.  Project Overview",
        "2.  System Architecture",
        "3.  User Roles &amp; Access Control",
        "4.  Information Architecture (Site Map)",
        "5.  Navigation Structure by Role",
        "6.  User Flows",
        "7.  Core Data Model",
        "8.  Delivery Challan Workflow",
        "9.  Backend API Map",
        "10. Setup &amp; Installation",
    ]
    elements.append(ListFlowable(
        [ListItem(Paragraph(item, toc_style), leftIndent=0, value="") for item in toc_items],
        bulletType="bullet", start="", leftIndent=10,
    ))
    elements.append(PageBreak())

    # ================= 1. PROJECT OVERVIEW =================
    elements.append(Paragraph("1. Project Overview", section_style))
    elements.append(Paragraph(
        "The QR Code Tools Management System is a web-based application used to manage the full "
        "lifecycle of construction and erection tools across project sites - from purchase and "
        "QR tagging, through despatch/receipt movements between store and sub-contractors, "
        "periodic safety inspections, repair, and final scrap disposal.",
        normal_style,
    ))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Key Objectives", sub_heading_style))
    objectives = [
        "<b>Inventory Management</b> - maintain a master record of every tool with a unique, scannable QR code.",
        "<b>Movement Tracking</b> - record every Despatch (OUT) and Receipt (IN) transaction between store, sites, sub-contractors and scrap dealers.",
        "<b>Delivery Challans</b> - auto-generate an editable, L&amp;T-branded Delivery Challan PDF for every despatch/receipt transaction.",
        "<b>Inspections</b> - track usability percentage, pass/fail results and automatically update tool status.",
        "<b>Safety Alerts</b> - raise critical/warning/info alerts when tool usability drops or key events occur.",
        "<b>Split Tool Matching</b> - verify that two paired tool components are a safe, compatible combination.",
        "<b>Dealers &amp; Custom Fields</b> - maintain sub-contractor / supplier / scrap-dealer masters with configurable custom verification fields.",
        "<b>Audit Trail</b> - log administrative create/update/delete actions for accountability.",
    ]
    elements.append(ListFlowable(
        [ListItem(Paragraph(o, bullet_style)) for o in objectives],
        bulletType="bullet", leftIndent=12,
    ))

    elements.append(PageBreak())

    # ================= 2. SYSTEM ARCHITECTURE =================
    elements.append(Paragraph("2. System Architecture", section_style))
    arch_data = [
        [Paragraph("Layer", header_cell_style), Paragraph("Technology", header_cell_style), Paragraph("Purpose", header_cell_style)],
        [Paragraph("Frontend", cell_bold_style), Paragraph("React 18 + TypeScript (Vite)", cell_style), Paragraph("Single-page application, role-based routing", cell_style)],
        [Paragraph("", cell_style), Paragraph("Tailwind CSS + Shadcn/UI (Radix)", cell_style), Paragraph("Design system &amp; accessible UI primitives", cell_style)],
        [Paragraph("", cell_style), Paragraph("html5-qrcode", cell_style), Paragraph("QR code scanning from camera / uploaded image", cell_style)],
        [Paragraph("", cell_style), Paragraph("jsPDF + jspdf-autotable", cell_style), Paragraph("Client-side generation of the editable Delivery Challan PDF", cell_style)],
        [Paragraph("Backend", cell_bold_style), Paragraph("FastAPI (Python)", cell_style), Paragraph("REST API, request validation, authentication", cell_style)],
        [Paragraph("", cell_style), Paragraph("SQLModel (SQLAlchemy + Pydantic)", cell_style), Paragraph("ORM models shared between DB schema and API schemas", cell_style)],
        [Paragraph("", cell_style), Paragraph("SQLite (local) / MySQL (production)", cell_style), Paragraph("Persistent storage", cell_style)],
        [Paragraph("", cell_style), Paragraph("OAuth2 + JWT, bcrypt (passlib)", cell_style), Paragraph("Authentication &amp; password hashing", cell_style)],
    ]
    arch_table = Table(arch_data, colWidths=[28 * mm, 60 * mm, 78 * mm], repeatRows=1)
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('SPAN', (0, 1), (0, 4)),
        ('SPAN', (0, 5), (0, 8)),
        ('VALIGN', (0, 1), (0, 4), 'MIDDLE'),
        ('VALIGN', (0, 5), (0, 8), 'MIDDLE'),
    ]))
    elements.append(KeepTogether(arch_table))
    elements.append(PageBreak())

    # ================= 3. USER ROLES =================
    elements.append(Paragraph("3. User Roles &amp; Access Control", section_style))
    elements.append(Paragraph(
        "Access is controlled centrally in <font face='Courier'>App.tsx</font>, which renders a "
        "different set of routes depending on the logged-in user's role. The same login screen is "
        "used for every role; the landing page and sidebar menu adapt automatically.",
        normal_style,
    ))
    elements.append(Spacer(1, 6))
    roles_data = [
        [Paragraph("Role", header_cell_style), Paragraph("Landing Page", header_cell_style), Paragraph("Purpose", header_cell_style)],
        [Paragraph("Admin", cell_bold_style), Paragraph("/tool-master", cell_style), Paragraph("Full system access - tool master, users, dealers, audit log, reports, settings.", cell_style)],
        [Paragraph("Management", cell_bold_style), Paragraph("/dashboard", cell_style), Paragraph("Read-oriented oversight - dashboard KPIs, reports, alerts.", cell_style)],
        [Paragraph("Store", cell_bold_style), Paragraph("/store-view", cell_style), Paragraph("Day-to-day store operations - QR scan, inventory, despatch/receipt, dealers.", cell_style)],
        [Paragraph("Inspector", cell_bold_style), Paragraph("/inspector", cell_style), Paragraph("Conducts safety inspections, manages inspection employees.", cell_style)],
        [Paragraph("Inspection Employee", cell_bold_style), Paragraph("/inspector", cell_style), Paragraph("Performs inspections under an Inspector; narrower access.", cell_style)],
        [Paragraph("Worker", cell_bold_style), Paragraph("/worker", cell_style), Paragraph("Scans tools on-site and runs the Split Tool Matching check.", cell_style)],
        [Paragraph("Data Entry", cell_bold_style), Paragraph("/tool-master", cell_style), Paragraph("Restricted Tool Master access for bulk data capture only.", cell_style)],
    ]
    roles_table = Table(roles_data, colWidths=[34 * mm, 32 * mm, 100 * mm], repeatRows=1)
    roles_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(roles_table))
    elements.append(PageBreak())

    # ================= 4. INFORMATION ARCHITECTURE =================
    elements.append(Paragraph("4. Information Architecture (Site Map)", section_style))
    elements.append(Paragraph(
        "The diagram below shows every screen in the application grouped by role, mirroring the "
        "routes defined in the frontend router. A screen reachable by more than one role (e.g. "
        "<font face='Courier'>/dealers</font>) is repeated under each role that can access it.",
        normal_style,
    ))
    elements.append(Spacer(1, 6))

    ia_groups = [
        ("Public", [
            ("/login", "Login Page - single entry point for all roles"),
            ("/view-tool/:qrCode", "Public Tool View - read-only tool details reached by scanning a tool's QR code"),
        ]),
        ("Admin", [
            ("/tool-master", "Tool Master - add / edit / list tools, bulk import"),
            ("/dashboard", "Dashboard - KPI summary, charts"),
            ("/reports", "Reports - exportable management reports"),
            ("/alerts", "Alerts - critical / warning / info alert feed"),
            ("/users", "User Management - create &amp; manage user accounts"),
            ("/audit-log", "Audit Log - history of admin create/update/delete actions"),
            ("/inspection-employees", "Inspection Employees - manage inspector accounts"),
            ("/tool-config", "Tool Config - master list of tool names &amp; item codes"),
            ("/tool-history", "Tool History - full lifecycle timeline per tool"),
            ("/dealers", "Dealers - sub-contractor / supplier / scrap dealer master &amp; custom fields"),
            ("/settings", "Settings - system preferences"),
        ]),
        ("Management", [
            ("/dashboard", "Dashboard - KPI summary, charts"),
            ("/reports", "Reports - exportable management reports"),
            ("/alerts", "Alerts - critical / warning / info alert feed"),
        ]),
        ("Store", [
            ("/store-view", "QR Scanner - scan a tool to perform Despatch (OUT) / Receipt (IN)"),
            ("/store-inventory", "Store Inventory - searchable list of tools at the store, bulk selection"),
            ("/tools-movements", "Tools Movements - bulk Despatch (OUT) / Receipt (IN) transactions"),
            ("/tools-movement-history", "Tools Movement History - log of past movements"),
            ("/inspection-employees", "Inspection Employees - view inspector roster"),
            ("/dealers", "Dealers - sub-contractor / supplier / scrap dealer master"),
        ]),
        ("Inspector", [
            ("/inspector/profile", "Profile - inspector's own profile"),
            ("/inspector", "Inspection - scan/select a tool and submit a checklist"),
            ("/inspector/results", "Inspection Results - history of submitted inspections"),
            ("/inspector/add-employee", "Add Employee - register an Inspection Employee"),
        ]),
        ("Inspection Employee", [
            ("/inspector", "Inspection - scan/select a tool and submit a checklist"),
            ("/inspector/results", "Inspection Results - history of submitted inspections"),
        ]),
        ("Worker", [
            ("/worker", "Tool Scan - look up a tool by QR code"),
            ("/split-tool", "Split Tool Check - verify Part A / Part B compatibility"),
        ]),
        ("Data Entry", [
            ("/tool-master", "Tool Master - restricted to adding/editing tool records"),
        ]),
    ]

    for group_name, items in ia_groups:
        rows = [[Paragraph(path, ParagraphStyle("Mono", parent=cell_style, fontName="Courier", fontSize=7.8, textColor=NAVY)), Paragraph(desc, cell_style)] for path, desc in items]
        t = Table(rows, colWidths=[50 * mm, 116 * mm])
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, LIGHT_GREY]),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(KeepTogether([Paragraph(group_name, sub_heading_style), t]))
        elements.append(Spacer(1, 6))

    elements.append(PageBreak())

    # ================= 5. NAVIGATION STRUCTURE =================
    elements.append(Paragraph("5. Navigation Structure by Role", section_style))
    elements.append(Paragraph(
        "Inside the application shell (<font face='Courier'>Layout.tsx</font>), a persistent sidebar "
        "lists the menu items available to the signed-in role. The hierarchy below reflects the order "
        "items appear in the sidebar.",
        normal_style,
    ))
    nav_tree = [
        ("Admin", ["Dashboard", "Tool Master", "Tool Config", "Tool History", "Dealers (Add Dealers)", "Reports", "Alerts", "User Management", "Audit Log", "Inspection Employees", "Settings"]),
        ("Management", ["Dashboard", "Reports", "Alerts"]),
        ("Store", ["QR Scanner (Store View)", "Store Inventory", "Tools Movements", "Tools Movement History", "Inspection Employees", "Dealers"]),
        ("Inspector", ["Profile", "Inspection", "Inspection Results", "Add Employee"]),
        ("Inspection Employee", ["Inspection", "Inspection Results"]),
        ("Worker", ["Tool Scan", "Split Tool Check"]),
        ("Data Entry", ["Tool Master"]),
    ]
    for role, menu in nav_tree:
        elements.append(Paragraph(role, sub_heading_style))
        elements.append(Paragraph(" &rarr; ".join(menu), normal_style))
        elements.append(Spacer(1, 4))

    elements.append(PageBreak())

    # ================= 6. USER FLOWS =================
    elements.append(Paragraph("6. User Flows", section_style))

    flows = [
        ("6.1 Login &amp; Session", [
            "User opens the app; a splash screen is shown briefly while an existing session token (if any) is validated.",
            "User enters username/password on the Login Page.",
            "On success, the backend issues a JWT; the frontend stores it and fetches the user's profile (role, site).",
            "The user is redirected to the role-specific landing route (see Section 3) and the sidebar renders that role's menu.",
        ]),
        ("6.2 Admin - Add a New Tool", [
            "Admin opens Tool Master and clicks Add Tool.",
            "Fills General Info (description, make, capacity, SWL, metal type, tool variant), Purchase Info (supplier, date of supply) and optional custom fields.",
            "On save, the backend generates a unique alphanumeric QR code and stores the tool with status = usable.",
            "The new tool appears in the Tool Master list and is immediately scannable by Store/Inspector/Worker roles.",
        ]),
        ("6.3 Store - Despatch (OUT) / Receipt (IN) with Delivery Challan", [
            "Store user opens the QR Scanner (Store View) and scans or searches for a tool.",
            "Selects transaction type: Receipt (IN) - e.g. Sub-Contractor Return, New Product, From Other Site, Found/Recovered; or Despatch (OUT) - e.g. Issue to Sub-Contractor, Transfer to Next Site, Issue to Scrap Dealer.",
            "Fills the relevant fields (sub-contractor name/code/mobile, target site, remarks) and confirms the transaction.",
            "The tool record is updated (site, sub-contractor, status) and a Preview &amp; Edit Delivery Challan dialog opens automatically.",
            "Store user reviews/edits every field on the challan (DC No., dates, codes, E-way Bill No., items, freight, sales tax, copy distribution checkboxes, remarks) while a live PDF preview updates.",
            "Store user clicks Download Delivery Challan to save the finished, L&amp;T-branded PDF.",
        ]),
        ("6.4 Store - Bulk Despatch / Receipt", [
            "Store user selects multiple tools in Store Inventory and chooses Receipt (IN) or Despatch (OUT).",
            "Tools Movements opens pre-loaded with the selection; the same sub-category options and validation rules apply as the single-tool flow (e.g. only usable tools can be transferred, only scrap tools can go to a scrap dealer).",
            "On confirm, every selected tool is updated in one batch and a single bulk Delivery Challan covering all items opens in the same Preview &amp; Edit dialog.",
        ]),
        ("6.5 Inspector - Conduct an Inspection", [
            "Inspector opens Inspection, scans a tool QR code or selects it from the site's tool list.",
            "Completes the checklist: visual damage check, usability percentage, remarks, optional photo upload.",
            "Submits a Pass or Fail result.",
            "A Fail automatically updates the tool's status to Under Repair or Scrap; the result is added to Inspection Results and the tool's history timeline.",
        ]),
        ("6.6 Worker - Split Tool Matching", [
            "Worker scans Part A and Part B of a tool pair on the Split Tool Check screen.",
            "The system compares description, make, capacity, safe working load and current site.",
            "If every field matches, the pair is shown as a Correct Combination (green); otherwise as a Mismatch (red) with the differing field highlighted.",
        ]),
        ("6.7 Admin - Dealers &amp; Custom Fields", [
            "Admin/Store opens Dealers and adds a Sub-Contractor, Supplier or Scrap Dealer with company name, dealer code, contact details and GST number.",
            "Admin defines reusable Custom Fields (text, number, file, radio, checkbox, checkboxes) under Dealer Custom Fields.",
            "During a Despatch/Receipt transaction, Store can attach selected custom fields as a verification checklist, which is recorded in the transaction remarks.",
        ]),
        ("6.8 Management - Monitoring", [
            "Management user opens Dashboard to see KPI counters (Issued, Available, Under Repair, Lost, Damaged tools) and trend charts.",
            "Reviews Alerts for any critical/warning items (e.g. usability below 25%).",
            "Opens Reports to export management summaries for further review.",
        ]),
    ]
    for title, steps in flows:
        flow_block = [
            Paragraph(title, sub_heading_style),
            ListFlowable(
                [ListItem(Paragraph(s, bullet_style)) for s in steps],
                bulletType="1", leftIndent=14, start="1",
            ),
        ]
        elements.append(KeepTogether(flow_block))
        elements.append(Spacer(1, 6))

    elements.append(PageBreak())

    # ================= 7. CORE DATA MODEL =================
    elements.append(Paragraph("7. Core Data Model", section_style))
    elements.append(Paragraph(
        "The backend defines its schema with SQLModel; the same classes serve as both the database "
        "table definition and the API request/response schema. Key entities and their relationships:",
        normal_style,
    ))
    elements.append(Spacer(1, 6))
    model_data = [
        [Paragraph("Entity", header_cell_style), Paragraph("Key Fields", header_cell_style), Paragraph("Relationships", header_cell_style)],
        [Paragraph("User", cell_bold_style), Paragraph("username, email, role, site, hashed_password", cell_style), Paragraph("created_by on Tool / Inspector", cell_style)],
        [Paragraph("Tool", cell_bold_style), Paragraph("description, make, capacity, SWL, qr_code (unique), status, current/next/previous site, subcontractor fields, custom_fields, pending_return_date", cell_style), Paragraph("1..N Inspections, 1..N MovementHistory; created_by &rarr; User", cell_style)],
        [Paragraph("Inspection", cell_bold_style), Paragraph("tool_id, inspector_id, result, usability_percentage, photos", cell_style), Paragraph("belongs to Tool; performed by User / Inspector", cell_style)],
        [Paragraph("MovementHistory", cell_bold_style), Paragraph("tool_id, from_site, to_site, remarks, user_id", cell_style), Paragraph("belongs to Tool; performed by User", cell_style)],
        [Paragraph("Alert", cell_bold_style), Paragraph("type, severity, title, message, tool_id, site, is_read, is_resolved", cell_style), Paragraph("optionally linked to Tool", cell_style)],
        [Paragraph("AuditLog", cell_bold_style), Paragraph("user_id, action, entity_type, entity_id, description", cell_style), Paragraph("references User, generic entity reference", cell_style)],
        [Paragraph("Inspector", cell_bold_style), Paragraph("name, employee_id (unique), designation, department, status", cell_style), Paragraph("created_by &rarr; User; linked from Inspection", cell_style)],
        [Paragraph("Dealer", cell_bold_style), Paragraph("category (sub_contractor / supplier / scrap_dealer), company_name, dealer_code (unique), custom_fields", cell_style), Paragraph("standalone master record", cell_style)],
        [Paragraph("DealerCustomField / ToolCustomField", cell_bold_style), Paragraph("name (unique), field_type, is_required, options", cell_style), Paragraph("schema definitions for dynamic checklist fields", cell_style)],
        [Paragraph("ToolConfig", cell_bold_style), Paragraph("tool_name (unique), item_code, is_verified", cell_style), Paragraph("master list used for tool-name auto-suggestion", cell_style)],
    ]
    model_table = Table(model_data, colWidths=[34 * mm, 88 * mm, 44 * mm], repeatRows=1)
    model_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(model_table))
    elements.append(PageBreak())

    # ================= 8. DELIVERY CHALLAN WORKFLOW =================
    elements.append(Paragraph("8. Delivery Challan Workflow", section_style))
    elements.append(Paragraph(
        "Every Despatch (OUT) or Receipt (IN) transaction - single or bulk - ends with a client-side "
        "generated Delivery Challan, modeled on L&amp;T Construction's standard challan format and "
        "fully editable before download.",
        normal_style,
    ))
    challan_steps = [
        "Transaction is confirmed and the tool record(s) are updated via the API.",
        "A Preview &amp; Edit dialog opens, pre-filled from the transaction (consignee, site code, item list).",
        "User can edit every printed field: DC No., Date, Consignee / Site Code, E-Way Bill No., TRN CD &amp; accounting codes, Items table, Gate Pass / Total, Sales Tax numbers, Vehicle / LR / Freight details, Receipt Details, Remarks, and the Copy Distribution checklist.",
        "The PDF preview (rendered with jsPDF) regenerates automatically a few hundred milliseconds after each edit.",
        "Selected Copy Distribution items are shown in bold red on the printed challan; unselected items are omitted.",
        "Clicking Download Delivery Challan saves the finished PDF, named by transaction type and tool/QR code.",
    ]
    elements.append(ListFlowable(
        [ListItem(Paragraph(s, bullet_style)) for s in challan_steps],
        bulletType="1", leftIndent=14,
    ))

    elements.append(PageBreak())

    # ================= 9. BACKEND API MAP =================
    elements.append(Paragraph("9. Backend API Map", section_style))
    elements.append(Paragraph(
        "All endpoints are served under the <font face='Courier'>/api</font> prefix by FastAPI routers, "
        "one module per domain area:",
        normal_style,
    ))
    elements.append(Spacer(1, 6))
    api_data = [
        [Paragraph("Router", header_cell_style), Paragraph("Domain", header_cell_style), Paragraph("Representative Endpoints", header_cell_style)],
        [Paragraph("users", cell_bold_style), Paragraph("Auth &amp; user accounts", cell_style), Paragraph("POST /api/users/token, GET /api/users/me, GET /api/users/", cell_style)],
        [Paragraph("tools", cell_bold_style), Paragraph("Tool master &amp; lifecycle", cell_style), Paragraph("GET/POST /api/tools/, PATCH /api/tools/{id}, GET /api/tools/qr/{code}", cell_style)],
        [Paragraph("inspections", cell_bold_style), Paragraph("Inspection records", cell_style), Paragraph("POST /api/inspections/, GET /api/inspections/tool/{id}", cell_style)],
        [Paragraph("movements", cell_bold_style), Paragraph("Despatch / Receipt history", cell_style), Paragraph("GET /api/movements/, POST /api/movements/", cell_style)],
        [Paragraph("alerts", cell_bold_style), Paragraph("Safety / system alerts", cell_style), Paragraph("GET /api/alerts/, PATCH /api/alerts/{id}", cell_style)],
        [Paragraph("audit", cell_bold_style), Paragraph("Admin audit trail", cell_style), Paragraph("GET /api/audit/", cell_style)],
        [Paragraph("inspectors", cell_bold_style), Paragraph("Inspector accounts", cell_style), Paragraph("GET/POST /api/inspectors/", cell_style)],
        [Paragraph("dealers", cell_bold_style), Paragraph("Dealer master &amp; custom fields", cell_style), Paragraph("GET/POST /api/dealers/, GET/POST /api/dealers/custom-fields", cell_style)],
        [Paragraph("toolconfig", cell_bold_style), Paragraph("Tool-name auto-suggestion master", cell_style), Paragraph("GET/POST /api/toolconfig/", cell_style)],
        [Paragraph("upload", cell_bold_style), Paragraph("File / certificate uploads", cell_style), Paragraph("POST /api/upload/certificate", cell_style)],
        [Paragraph("export", cell_bold_style), Paragraph("Report exports", cell_style), Paragraph("GET /api/export/...", cell_style)],
    ]
    api_table = Table(api_data, colWidths=[28 * mm, 50 * mm, 88 * mm], repeatRows=1)
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(api_table))
    elements.append(PageBreak())

    # ================= 10. SETUP & INSTALLATION =================
    elements.append(Paragraph("10. Setup &amp; Installation", section_style))
    setup_data = [
        [Paragraph("Step", header_cell_style), Paragraph("Frontend", header_cell_style), Paragraph("Backend", header_cell_style)],
        [Paragraph("Prerequisite", cell_style), Paragraph("Node.js 18+", cell_style), Paragraph("Python 3.10+", cell_style)],
        [Paragraph("Install", cell_style), Paragraph("npm install", cell_style), Paragraph("pip install -r backend/requirements.txt", cell_style)],
        [Paragraph("Run", cell_style), Paragraph("npm run dev  (http://localhost:5173)", cell_style), Paragraph("uvicorn backend.main:app --reload  (http://localhost:8000)", cell_style)],
        [Paragraph("Database", cell_style), Paragraph("-", cell_style), Paragraph("SQLite file by default; MySQL via DATABASE_URL for production", cell_style)],
        [Paragraph("Docs", cell_style), Paragraph("-", cell_style), Paragraph("Interactive API docs at /docs", cell_style)],
    ]
    setup_table = Table(setup_data, colWidths=[26 * mm, 70 * mm, 70 * mm], repeatRows=1)
    setup_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(setup_table))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_doc()
