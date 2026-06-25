"""One-off script: generates the end-user User Guide PDF for the QR Code
Tools Management System, branded with the L&T logo. Unlike the technical
Project Documentation PDF, this one is written for the people who actually
use the screens day to day - step-by-step "how to" instructions per role,
plus one end-to-end walkthrough tracing a tool through its whole life.

Run with: python backend/generate_user_guide_pdf.py
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
    Table, TableStyle, Paragraph, Spacer, PageBreak, ListFlowable, ListItem,
    KeepTogether,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(BASE_DIR, "src", "assets", "lt-logo.png")
OUTPUT_PATH = os.path.join(BASE_DIR, "QR_Tool_Management_System_User_Guide.pdf")

NAVY = colors.HexColor("#1E3A8A")
SLATE = colors.HexColor("#334155")
LIGHT_GREY = colors.HexColor("#F3F4F6")
GREEN = colors.HexColor("#15803D")
AMBER = colors.HexColor("#B45309")
RED = colors.HexColor("#B91C1C")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleNavy", parent=styles["Title"], textColor=NAVY, fontSize=24, leading=28, alignment=TA_CENTER)
subtitle_style = ParagraphStyle("SubtitleNavy", parent=styles["Heading2"], textColor=SLATE, fontSize=13, leading=17, alignment=TA_CENTER, fontName="Helvetica")
section_style = ParagraphStyle("SectionNavy", parent=styles["Heading1"], textColor=WHITE, fontSize=14, leading=18, spaceAfter=10, backColor=NAVY, borderPadding=(6, 8, 6, 8))
heading_style = ParagraphStyle("HeadingNavy", parent=styles["Heading2"], textColor=NAVY, fontSize=12.5, leading=16, spaceBefore=14, spaceAfter=6)
sub_heading_style = ParagraphStyle("SubHeadingNavy", parent=styles["Heading3"], textColor=NAVY, fontSize=11, leading=14, spaceBefore=12, spaceAfter=5)
normal_style = ParagraphStyle("BodyText", parent=styles["Normal"], fontSize=9.5, leading=14)
bullet_style = ParagraphStyle("BulletText", parent=normal_style, leftIndent=0, spaceAfter=3)
step_style = ParagraphStyle("StepText", parent=normal_style, spaceAfter=4)
tip_style = ParagraphStyle("TipText", parent=normal_style, textColor=SLATE, fontName="Helvetica-Oblique", spaceAfter=3)
cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontSize=8.5, leading=11.5)
cell_bold_style = ParagraphStyle("CellTextBold", parent=cell_style, fontName="Helvetica-Bold", textColor=NAVY)
header_cell_style = ParagraphStyle("HeaderCellText", parent=styles["Normal"], fontSize=9, leading=12, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER)
toc_style = ParagraphStyle("TocText", parent=styles["Normal"], fontSize=11, leading=20, textColor=SLATE)
role_banner_style = ParagraphStyle("RoleBanner", parent=styles["Normal"], fontSize=10, leading=13, textColor=NAVY, fontName="Helvetica-Bold", backColor=LIGHT_GREY, borderPadding=(5, 8, 5, 8))


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
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 1, "User Guide")
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


def numbered_steps(steps):
    return ListFlowable(
        [ListItem(Paragraph(s, step_style)) for s in steps],
        bulletType="1", leftIndent=14, start="1",
    )


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, bullet_style)) for i in items],
        bulletType="bullet", leftIndent=12,
    )


def role_chapter(elements, role_title, intro, sections):
    """sections: list of (heading, steps:list[str], tip:str|None)"""
    elements.append(PageBreak())
    elements.append(Paragraph(role_title, section_style))
    elements.append(Paragraph(intro, normal_style))
    for heading, steps, tip in sections:
        block = [Paragraph(heading, sub_heading_style), numbered_steps(steps)]
        if tip:
            block.append(Spacer(1, 3))
            block.append(Paragraph(f"Tip: {tip}", tip_style))
        elements.append(KeepTogether(block))
        elements.append(Spacer(1, 6))


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

    # ================= COVER =================
    elements.append(Spacer(1, 75 * mm))
    elements.append(Paragraph("QR Code Tools Management System", title_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("User Guide", subtitle_style))
    elements.append(Paragraph("How the Application Works - End to End", ParagraphStyle("CoverSub2", parent=subtitle_style, fontSize=11)))
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(f"Prepared on: {datetime.now().strftime('%d %B %Y')}", ParagraphStyle("CoverMeta", parent=normal_style, alignment=TA_CENTER)))
    elements.append(Paragraph("Larsen &amp; Toubro Limited, Construction", ParagraphStyle("CoverMeta2", parent=normal_style, alignment=TA_CENTER, textColor=NAVY, fontName="Helvetica-Bold")))
    elements.append(NextPageTemplate("Body"))
    elements.append(PageBreak())

    # ================= TOC =================
    elements.append(Paragraph("Table of Contents", section_style))
    toc_items = [
        "1.  Before You Start",
        "2.  Logging In",
        "3.  Admin Guide",
        "4.  Store Guide",
        "5.  Inspector &amp; Inspection Employee Guide",
        "6.  Worker Guide",
        "7.  Management Guide",
        "8.  End-to-End Walkthrough: Life of a Tool",
        "9.  Status &amp; Alert Reference",
        "10. Troubleshooting &amp; FAQ",
    ]
    elements.append(ListFlowable(
        [ListItem(Paragraph(item, toc_style), leftIndent=0, value="") for item in toc_items],
        bulletType="bullet", start="", leftIndent=10,
    ))

    # ================= 1. BEFORE YOU START =================
    elements.append(PageBreak())
    elements.append(Paragraph("1. Before You Start", section_style))
    elements.append(Paragraph(
        "This guide explains how to use every screen of the QR Code Tools Management System in "
        "plain, step-by-step language. It is organised by role - find your role's chapter and "
        "follow the numbered steps. Section 8 walks through one tool's entire journey so you can "
        "see how every role's work connects.",
        normal_style,
    ))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("What you will need", sub_heading_style))
    elements.append(bullets([
        "A username and password issued by your Admin.",
        "A camera-enabled phone, tablet, or computer with a webcam if you will be scanning QR codes.",
        "For Store users: the tool's physical QR label, or the ability to search by tool description.",
    ]))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Roles at a glance", sub_heading_style))
    role_data = [
        [Paragraph("Role", header_cell_style), Paragraph("What you do in this system", header_cell_style)],
        [Paragraph("Admin", cell_bold_style), Paragraph("Set up tools, users, dealers; oversee everything; review audit history.", cell_style)],
        [Paragraph("Management", cell_bold_style), Paragraph("Monitor dashboards, reports and alerts; no data entry.", cell_style)],
        [Paragraph("Store", cell_bold_style), Paragraph("Day-to-day Despatch (OUT) / Receipt (IN) of tools, with Delivery Challans.", cell_style)],
        [Paragraph("Inspector", cell_bold_style), Paragraph("Carry out safety inspections; manage Inspection Employees.", cell_style)],
        [Paragraph("Inspection Employee", cell_bold_style), Paragraph("Carry out safety inspections assigned by an Inspector.", cell_style)],
        [Paragraph("Worker", cell_bold_style), Paragraph("Look up tools on-site; verify split-tool pairs before use.", cell_style)],
        [Paragraph("Data Entry", cell_bold_style), Paragraph("Add/edit tool records only.", cell_style)],
    ]
    role_table = Table(role_data, colWidths=[34 * mm, 132 * mm], repeatRows=1)
    role_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(role_table))

    # ================= 2. LOGGING IN =================
    elements.append(PageBreak())
    elements.append(Paragraph("2. Logging In", section_style))
    elements.append(numbered_steps([
        "Open the application in your browser. A short splash screen appears while the app checks if you are already signed in.",
        "On the Login screen, enter your Username and Password and submit.",
        "The system reads your role and Site, then takes you straight to your home screen - "
        "Admin and Data Entry go to Tool Master, Store goes to the QR Scanner, Inspector and "
        "Inspection Employee go to Inspection, Worker goes to Tool Scan, and Management goes to the Dashboard.",
        "Your name, role and site are shown in the top bar; the left-hand sidebar only lists the screens your role can use.",
        "To leave the system, use Logout in the top bar. This clears your session - you will need to log in again next time.",
    ]))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Tip: if your password stops working or your role/site needs to change, contact your Admin - "
        "only Admin can create and edit user accounts.",
        tip_style,
    ))

    # ================= 3. ADMIN GUIDE =================
    role_chapter(
        elements,
        "3. Admin Guide",
        "As Admin you have full access to every module. The sections below cover the screens unique "
        "to your role, in the order they appear in your sidebar.",
        [
            ("3.1 Add a New Tool (Tool Master)", [
                "Open Tool Master and click Add Tool.",
                "Fill in General Info: Description, Make, Capacity, Safe Working Load, Tool Type "
                "(Erection / Stringing), Metal Type and Tool Variant.",
                "Fill in Purchase Info: Item Code, Purchaser Name/Contact, Supplier Code, Date of Supply, "
                "and upload the Test Certificate if available.",
                "Set the Validity Period (in years) - this drives the tool's expiry date.",
                "Fill in any Custom Fields your organisation has configured for extra checklist data.",
                "Click Save. The system automatically generates a unique QR code for the tool - print or "
                "download it from the tool's row in the list and attach it to the physical tool.",
            ], "Use the search and filters at the top of Tool Master to quickly find a tool by description, QR code, status or site."),
            ("3.2 Edit or Bulk Import Tools", [
                "Click on any tool row to open and edit its details, or use the bulk Excel/PDF import "
                "option to add many tools at once.",
                "During bulk import, the system tries to match each row's Tool Name against the Tool "
                "Config master list to auto-fill the Item Code; mismatches are flagged for review.",
            ], None),
            ("3.3 Tool Config (Name &amp; Item Code Master)", [
                "Open Tool Config to maintain the master list of approved Tool Names and their Item Codes.",
                "This list powers auto-suggestion when staff type a tool name elsewhere in the system.",
            ], None),
            ("3.4 Tool History", [
                "Open Tool History and select a tool to see its complete timeline - creation, every "
                "despatch/receipt movement, every inspection, and any status changes - in one place.",
            ], None),
            ("3.5 Dealers &amp; Custom Fields", [
                "Open Dealers and click Add Dealer to register a Sub-Contractor, Supplier or Scrap Dealer "
                "with company name, dealer code, contact details and GST number.",
                "Open the Custom Fields manager (within Dealers) to create reusable checklist fields "
                "(text, number, file upload, radio choice, checkbox, or multi-select checkboxes).",
                "These custom fields can be attached by Store during a Despatch/Receipt transaction as an "
                "extra verification checklist.",
            ], None),
            ("3.6 User Management", [
                "Open User Management and click Add User.",
                "Enter the username, full name, email, password, Role and Site (where applicable).",
                "Edit or deactivate an account at any time from the same screen.",
            ], "Each Store/Inspector/Inspection Employee/Data Entry account should be tied to exactly one Site so movement and inspection records stay organised."),
            ("3.7 Audit Log", [
                "Open Audit Log to see a running history of admin create/update/delete actions - who "
                "changed what, and when - for accountability.",
            ], None),
            ("3.8 Reports, Alerts &amp; Settings", [
                "Open Reports to generate and export management summaries.",
                "Open Alerts to review critical/warning/info notifications raised by the system (e.g. a "
                "tool's usability dropping below the safe threshold).",
                "Open Settings to adjust system-wide preferences.",
            ], None),
        ],
    )

    # ================= 4. STORE GUIDE =================
    role_chapter(
        elements,
        "4. Store Guide",
        "As Store, your daily work is moving tools in and out of your site and keeping the Delivery "
        "Challan paperwork accurate.",
        [
            ("4.1 Find a Tool (QR Scanner)", [
                "Open the QR Scanner screen (your home screen).",
                "Scan the tool's QR label with your camera, or upload a photo of the QR code, or search "
                "manually if the label is missing or damaged.",
                "The tool's current details load automatically once found.",
            ], None),
            ("4.2 Receive a Tool (Receipt / IN)", [
                "With the tool loaded, choose the Receipt (IN) tab.",
                "Pick the Receipt Type that matches what is happening: Sub-Contractor Return, New Product "
                "Supply, From Other Site, or Found/Recovered (only available if the tool was previously "
                "marked Missing or Stolen).",
                "Add any Remarks and confirm. The tool's site and status update immediately.",
                "A Preview &amp; Edit Delivery Challan window opens automatically - see Section 4.5 below.",
            ], None),
            ("4.3 Despatch a Tool (Despatch / OUT)", [
                "With the tool loaded, choose the Despatch (OUT) tab.",
                "Pick the Despatch Type: Issue to Sub-Contractor, Transfer to Next Site, or Issue to Scrap "
                "Dealer (only allowed if the tool's status is already Scrap).",
                "Fill in the Sub-Contractor / destination Site details and Remarks, then confirm.",
                "A Preview &amp; Edit Delivery Challan window opens automatically.",
            ], "Only tools currently marked Usable can be sent to a sub-contractor or another site; only Scrap tools can be sent to a scrap dealer. The system blocks the transaction otherwise."),
            ("4.4 Move Several Tools at Once (Bulk Movements)", [
                "Go to Store Inventory, tick the checkbox on each tool you want to move, then choose "
                "Receipt (IN) or Despatch (OUT) from the bulk action bar.",
                "You will land on Tools Movements with your selection pre-loaded; fill in the same kind "
                "of details as a single transaction.",
                "Confirm once - every selected tool is updated together, and one combined Delivery Challan "
                "covering all of them opens for review.",
            ], "Bulk Despatch automatically filters out ineligible tools - e.g. it will only transfer tools that are Usable, or only send Scrap tools to a scrap dealer - and tells you if nothing qualifies."),
            ("4.5 Review, Edit &amp; Download the Delivery Challan", [
                "The Preview &amp; Edit window shows a live PDF preview on one side and editable fields on "
                "the other.",
                "Check and correct every field as needed: DC No., Date, Consignee / Site Code, E-Way Bill "
                "No., TRN CD and accounting codes, the Items table, Gate Pass / Total, Sales Tax numbers, "
                "Vehicle / LR / Freight details, Receipt Details, and Remarks.",
                "Tick the Copy Distribution checkboxes for who should receive a copy (Consignee, "
                "Consignee-Consignor, Gate Pass, Consignor's File) - only ticked items print, shown in bold red.",
                "The preview updates automatically as you type.",
                "Click Download Delivery Challan to save the finished PDF, or Cancel to close without "
                "downloading (the tool's record is already saved either way).",
            ], None),
            ("4.6 Movement History &amp; Inspection Employees", [
                "Open Tools Movement History to see every past Despatch/Receipt for your site.",
                "Open Inspection Employees to view the roster of inspectors who can be assigned to your site's tools.",
            ], None),
        ],
    )

    # ================= 5. INSPECTOR GUIDE =================
    role_chapter(
        elements,
        "5. Inspector &amp; Inspection Employee Guide",
        "Inspectors and Inspection Employees keep tools safe to use by recording regular checks.",
        [
            ("5.1 Conduct an Inspection", [
                "Open Inspection and either scan the tool's QR code or select it from your site's tool list.",
                "Work through the checklist: visual damage check, set the Usability Percentage, add Remarks, "
                "and optionally upload a photo.",
                "Choose Pass or Fail and submit.",
            ], "A Fail automatically updates the tool's status (e.g. to Under Repair or Scrap) - you do not need to change it manually."),
            ("5.2 Review Past Inspections", [
                "Open Inspection Results to see every inspection you (or your team) have submitted, with "
                "filters by date, tool, or result.",
            ], None),
            ("5.3 Manage Your Profile &amp; Team (Inspector only)", [
                "Open Profile to view/update your own inspector details.",
                "Open Add Employee to register a new Inspection Employee who will work under you.",
            ], None),
        ],
    )

    # ================= 6. WORKER GUIDE =================
    role_chapter(
        elements,
        "6. Worker Guide",
        "As Worker, you use the system on-site to confirm a tool is genuine and, for split tools, that "
        "the two halves are a safe match before use.",
        [
            ("6.1 Look Up a Tool", [
                "Open Tool Scan and scan the QR code (or search) to see the tool's description, make, "
                "capacity, safe working load, status and current site.",
            ], None),
            ("6.2 Check a Split Tool Pair", [
                "Open Split Tool Check.",
                "Scan Part A, then scan Part B of the pair you intend to use together.",
                "The system compares description, make, capacity, safe working load and current site "
                "for both parts.",
                "A green Correct Combination result means the pair is safe to use; a red Mismatch result "
                "shows exactly which field does not match - do not use the pair until this is resolved.",
            ], None),
        ],
    )

    # ================= 7. MANAGEMENT GUIDE =================
    role_chapter(
        elements,
        "7. Management Guide",
        "Management has read-oriented access to monitor the overall health of the tool fleet.",
        [
            ("7.1 Dashboard", [
                "Open Dashboard to see headline counters - Issued, Available, Under Repair, Lost and "
                "Damaged tools - plus trend charts.",
            ], None),
            ("7.2 Reports", [
                "Open Reports to generate and export summaries for further analysis or circulation.",
            ], None),
            ("7.3 Alerts", [
                "Open Alerts to review critical, warning and info notifications across all sites, such as "
                "a tool's usability dropping below the safe threshold.",
            ], None),
        ],
    )

    # ================= 8. END-TO-END WALKTHROUGH =================
    elements.append(PageBreak())
    elements.append(Paragraph("8. End-to-End Walkthrough: Life of a Tool", section_style))
    elements.append(Paragraph(
        "This section follows one tool from the day it is purchased to the day it is scrapped, showing "
        "which role does what at each stage and how the screens connect.",
        normal_style,
    ))
    lifecycle_steps = [
        ("Step 1 - Tool is created", "Admin", "Admin adds the tool in Tool Master with its purchase details. The system generates a unique QR code; the QR label is printed and stuck on the physical tool. Status: Usable."),
        ("Step 2 - Tool enters store stock", "Store", "The tool sits in Store Inventory at its site, ready to be issued."),
        ("Step 3 - Tool is despatched to a sub-contractor", "Store", "Store scans the tool, runs Despatch (OUT) &rarr; Issue to Sub-Contractor, fills in the sub-contractor's details, and downloads the Delivery Challan after reviewing it in the Preview &amp; Edit window. The tool's site and sub-contractor fields update; status stays Usable."),
        ("Step 4 - Tool is inspected on site", "Inspector", "An Inspector (or Inspection Employee) scans the tool, completes the safety checklist and submits a Pass or Fail. A Pass keeps the tool Usable with an updated usability percentage; a Fail flips its status to Under Repair or Scrap automatically."),
        ("Step 5 - Tool is returned to store", "Store", "When work finishes, Store runs Receipt (IN) &rarr; Sub-Contractor Return. The sub-contractor link is cleared, the tool's site becomes the store again, and another Delivery Challan is generated for the return."),
        ("Step 6 - Worker double-checks before reuse", "Worker", "If the tool is part of a split-tool pair, a Worker runs Split Tool Check to confirm Part A and Part B still match before reuse."),
        ("Step 7 - Tool fails and is repaired or scrapped", "Inspector / Store", "If an inspection fails, the tool may go through repair; once repaired and re-passed it returns to Usable. If it cannot be repaired, it is marked Scrap."),
        ("Step 8 - Scrap tool is disposed", "Store", "Store runs Despatch (OUT) &rarr; Issue to Scrap Dealer (only available for Scrap-status tools), confirms the scrap dealer's details, and downloads the final Delivery Challan. The tool's site becomes the Scrap Yard."),
        ("Step 9 - Full history is reviewed", "Admin / Management", "At any point, Admin can open Tool History to see this entire timeline for the tool, and Management can see fleet-wide trends on the Dashboard and Alerts screens."),
    ]
    for title, who, desc in lifecycle_steps:
        block = [
            Paragraph(f"{title}  <font color='#1E3A8A'>[{who}]</font>", sub_heading_style),
            Paragraph(desc, normal_style),
        ]
        elements.append(KeepTogether(block))
        elements.append(Spacer(1, 4))

    # ================= 9. STATUS & ALERT REFERENCE =================
    elements.append(PageBreak())
    elements.append(Paragraph("9. Status &amp; Alert Reference", section_style))
    elements.append(Paragraph("Tool Status Values", sub_heading_style))
    status_data = [
        [Paragraph("Status", header_cell_style), Paragraph("Meaning", header_cell_style)],
        [Paragraph("Usable", cell_bold_style), Paragraph("Tool passed its last inspection and is fit for work.", cell_style)],
        [Paragraph("Under Repair", cell_bold_style), Paragraph("Tool failed inspection and is being fixed before reuse.", cell_style)],
        [Paragraph("Scrap / Scrapped", cell_bold_style), Paragraph("Tool cannot be repaired and is awaiting or has completed disposal.", cell_style)],
        [Paragraph("Missing", cell_bold_style), Paragraph("Tool could not be located during a stock check; eligible for Found/Recovered receipt once located.", cell_style)],
        [Paragraph("Stolen", cell_bold_style), Paragraph("Tool reported stolen; eligible for Found/Recovered receipt if recovered.", cell_style)],
        [Paragraph("Pending", cell_bold_style), Paragraph("Tool marked as not yet returned by a sub-contractor/site, with an expected return date and reason.", cell_style)],
    ]
    status_table = Table(status_data, colWidths=[34 * mm, 132 * mm], repeatRows=1)
    status_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(status_table))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Alert Severity Levels", sub_heading_style))
    alert_data = [
        [Paragraph("Severity", header_cell_style), Paragraph("When it is raised", header_cell_style)],
        [Paragraph("Critical", ParagraphStyle("CritCell", parent=cell_bold_style, textColor=RED)), Paragraph("Tool usability has dropped below 25% (high wear).", cell_style)],
        [Paragraph("Warning", ParagraphStyle("WarnCell", parent=cell_bold_style, textColor=AMBER)), Paragraph("Tool usability has dropped below 50%.", cell_style)],
        [Paragraph("Info", ParagraphStyle("InfoCell", parent=cell_bold_style, textColor=GREEN)), Paragraph("Routine events: new tool created, tool updated, successful inspection, new user registered.", cell_style)],
    ]
    alert_table = Table(alert_data, colWidths=[34 * mm, 132 * mm], repeatRows=1)
    alert_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(alert_table))

    # ================= 10. TROUBLESHOOTING & FAQ =================
    elements.append(PageBreak())
    elements.append(Paragraph("10. Troubleshooting &amp; FAQ", section_style))
    faq_data = [
        [Paragraph("Problem", header_cell_style), Paragraph("What to do", header_cell_style)],
        [Paragraph("QR code won't scan", cell_bold_style), Paragraph("Make sure the label is clean and well lit, or upload a photo of it instead of using the live camera. If the label is damaged, search for the tool manually by description.", cell_style)],
        [Paragraph("Can't log in", cell_bold_style), Paragraph("Double-check username/password. If it still fails, ask your Admin to verify your account is active and has the correct role/site.", cell_style)],
        [Paragraph("Despatch/Receipt option is greyed out", cell_bold_style), Paragraph("The system only allows certain transactions for certain tool statuses - e.g. only Usable tools can be issued to a sub-contractor, and only Scrap tools can go to a scrap dealer. Check the tool's current status first.", cell_style)],
        [Paragraph("Delivery Challan preview looks wrong", cell_bold_style), Paragraph("Every field in the Preview &amp; Edit window is editable - correct it there before downloading. The PDF regenerates automatically as you type.", cell_style)],
        [Paragraph("Split Tool Check shows Mismatch", cell_bold_style), Paragraph("Do not use the pair. The highlighted field shows exactly what differs (description, make, capacity, SWL or site) - report it to Store/Admin.", cell_style)],
        [Paragraph("I can't see a menu item another colleague has", cell_bold_style), Paragraph("Menus are role-based. If you need access to a screen you don't see, ask your Admin to review your role.", cell_style)],
    ]
    faq_table = Table(faq_data, colWidths=[44 * mm, 122 * mm], repeatRows=1)
    faq_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(KeepTogether(faq_table))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_doc()
