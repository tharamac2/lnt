"""One-off script: generates a client-facing PDF summary of the SCR
implementation roadmap. Run with: python backend/generate_scr_roadmap_pdf.py
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
OUTPUT_PATH = os.path.join(BASE_DIR, "QR_Tool_Management_System_SCR_Roadmap.pdf")

NAVY = colors.HexColor("#1E3A8A")
LIGHT_GREY = colors.HexColor("#F3F4F6")

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleNavy", parent=styles["Title"], textColor=NAVY)
heading_style = ParagraphStyle("HeadingNavy", parent=styles["Heading2"], textColor=NAVY, spaceBefore=14, spaceAfter=6)
sub_heading_style = ParagraphStyle("SubHeadingNavy", parent=styles["Heading3"], textColor=NAVY, spaceBefore=10, spaceAfter=4)
normal_style = ParagraphStyle("BodyText", parent=styles["Normal"], leading=14)
cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontSize=8, leading=11)
header_cell_style = ParagraphStyle("HeaderCellText", parent=styles["Normal"], fontSize=9, leading=12, textColor=colors.whitesmoke, fontName="Helvetica-Bold")

# (Phase title, SCR item numbers, what the user will be able to do)
PHASES = [
    ("Phase 1 - Stronger Validation, Flexible Validity Periods & Login Security Logs",
     "SCR 3, 4, 5, 8",
     "The system will stop users from typing letters into number-only fields like Capacity and "
     "Safe Working Load. Staff will be able to set a custom validity period for each tool instead "
     "of a fixed 3 years. Every login attempt - successful or failed - will be recorded with the "
     "user, time, and status for security review."),
    ("Phase 2 - Smart Suggestions for Tool Names, Item Codes & Suppliers",
     "SCR 9, 10, 11",
     "As staff type a tool name, the system will suggest matching names from a master list and "
     "auto-fill the related item code. Typing a supplier name will suggest matches and auto-fill "
     "that supplier's contact person, mobile number, email, and address."),
    ("Phase 3 - Multi-Tool In/Out with Delivery Challan",
     "SCR 1, 2, 17",
     "Store staff will be able to select multiple tools at once for a single In/Out transaction "
     "and generate one Delivery Challan covering all selected tools. Before a transaction can be "
     "completed, the system will check tool availability and inspection status and show clear "
     "messages if something is not eligible for the transaction."),
    ("Phase 4 - Admin Activity Audit Trail",
     "SCR 6",
     "Admin users will retain full ability to edit, update, and delete records, and every such "
     "action will be logged - who made the change, what changed, and when - so it can be "
     "reviewed later."),
    ("Phase 5 - Inspection Personnel Records",
     "SCR 7",
     "The system will maintain a master list of certified inspectors with their name, employee ID, "
     "designation, department, contact number, and certification details. Each inspection record "
     "will be linked to the inspector who carried it out."),
    ("Phase 6 - Multiple Certificates per Tool & Expiry Alerts",
     "SCR 12, 13",
     "Multiple inspection certificates (PDFs) can be uploaded per tool, each with its certificate "
     "number, issuing agency, issue date, and expiry date. A dashboard will show certificates that "
     "are expired or due within 30, 60, or 90 days, with clear status labels: Valid, Expiring "
     "Soon, or Expired."),
    ("Phase 7 - Full Tool History Timeline",
     "SCR 14",
     "Each tool will have a single timeline showing its complete life story - purchase, issue, "
     "return, inspection, repair, transfer, and disposal - in one place."),
    ("Phase 8 - QR-Based Physical Audit",
     "SCR 15",
     "During a physical stock check, staff will scan tool QR codes and the system will produce a "
     "report showing which tools were Verified, which are Missing, and which are Mismatched "
     "against the records."),
    ("Phase 9 - Repair & Maintenance Tracking",
     "SCR 16",
     "Repairs and maintenance work can be logged against a tool with the repair date, vendor "
     "details, cost, and status. This information will appear in the tool's history timeline."),
    ("Phase 10 - Enhanced Management Dashboard",
     "SCR 18",
     "The management dashboard will show new counters - Issued Tools, Available Tools, Tools "
     "Under Repair, Lost Tools, and Damaged Tools - and the exportable reports will be updated "
     "to match."),
]

SCR_ITEMS = [
    ("1", "Multiple Tool Selection for In/Out", "Select several tools together for one In/Out transaction, linked to a Delivery Challan.", "Phase 3"),
    ("2", "Validation for In/Out Transactions", "System checks tool availability and inspection status before allowing a transaction to complete.", "Phase 3"),
    ("3", "Alphanumeric Input Support", "Text fields accept letters and numbers; fields like Capacity, SWL, Tonnage, Quantity, and Weight accept numbers only.", "Phase 1"),
    ("4", "Tool Validity Period Enhancement", "Default validity stays at 3 years but can be customised per tool, including during bulk import.", "Phase 1"),
    ("5", "Admin Module Alphanumeric Validation", "Same numeric/alphanumeric rules applied consistently in the Admin module.", "Phase 1"),
    ("6", "Admin Full Edit/Delete/Update with Audit Logs", "Admins keep full edit/delete/update rights; every change is logged for audit purposes.", "Phase 4"),
    ("7", "Inspection Module Enhancement", "Maintain inspector records (name, ID, designation, department, contact, certification) linked to inspections.", "Phase 5"),
    ("8", "Login Error Handling and Audit Logging", "All login attempts (success/failure) are recorded with username, date/time, status, and IP address.", "Phase 1"),
    ("9", "Tool Name Auto-Suggestion", "Searchable dropdown suggests tool names as the user types.", "Phase 2"),
    ("10", "Item Code Auto-Suggestion and Auto-Fetch", "Selecting an item code auto-fills related tool details; manual entry remains available.", "Phase 2"),
    ("11", "Supplier Master Auto-Fetch", "Supplier details (code, contact, mobile, email, address) auto-fill from a saved supplier list.", "Phase 2"),
    ("12", "Third-Party Inspection Certificate Upload", "Upload multiple PDF certificates per tool, each with number, agency, issue and expiry dates.", "Phase 6"),
    ("13", "Certificate Expiry Monitoring & Alerts", "Dashboard view of certificates expired or due in 30/60/90 days, with status labels.", "Phase 6"),
    ("14", "Tool History Tracking", "Complete lifecycle history per tool: purchase, issue, return, inspection, repair, transfer, disposal.", "Phase 7"),
    ("15", "Tool Audit Verification", "QR-based physical verification producing Verified / Missing / Mismatched reports.", "Phase 8"),
    ("16", "Tool Repair & Maintenance Module", "Record repairs with date, vendor, cost, and history; linked to tool history.", "Phase 9"),
    ("17", "Tool Transfer Between Sites", "Transfer tools between stores/sites with full movement records and optional approval workflow.", "Phase 3"),
    ("18", "Dashboard & Management Analytics", "Centralised dashboard with totals, statuses, and exportable management reports.", "Phase 10"),
]


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40,
    )
    elements = []

    # --- Cover ---
    if os.path.isfile(LOGO_PATH):
        logo = Image(LOGO_PATH, width=2.0 * inch, height=0.8 * inch)
        logo.hAlign = "CENTER"
        elements.append(logo)
        elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("QR Tool Management System", title_style))
    elements.append(Paragraph("Software Change Request - Implementation Roadmap", heading_style))
    elements.append(Spacer(1, 0.15 * inch))
    elements.append(Paragraph(f"Prepared on: {datetime.now().strftime('%d %B %Y')}", normal_style))
    elements.append(Spacer(1, 0.25 * inch))
    elements.append(Paragraph(
        "This document explains, in plain language, the 18 enhancements requested for the "
        "QR Tool Management System (Store, Admin, and Inspection modules), and the order in "
        "which they will be delivered. The work has been organised into 10 phases so that "
        "improvements can be reviewed and used as soon as each phase is completed, rather than "
        "waiting for the entire project to finish.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.3 * inch))

    # --- SCR item table ---
    elements.append(Paragraph("Requested Changes at a Glance", heading_style))
    table_data = [[
        Paragraph("#", header_cell_style),
        Paragraph("Requested Change", header_cell_style),
        Paragraph("What This Means For You", header_cell_style),
        Paragraph("Delivery Phase", header_cell_style),
    ]]
    for num, title, desc, phase in SCR_ITEMS:
        table_data.append([
            Paragraph(num, cell_style),
            Paragraph(f"<b>{title}</b>", cell_style),
            Paragraph(desc, cell_style),
            Paragraph(phase, cell_style),
        ])

    item_table = Table(table_data, colWidths=[0.3 * inch, 1.7 * inch, 3.7 * inch, 0.9 * inch], repeatRows=1)
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GREY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GREY, colors.white]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(item_table)

    elements.append(PageBreak())

    # --- Phase roadmap ---
    elements.append(Paragraph("Delivery Roadmap", heading_style))
    elements.append(Paragraph(
        "The roadmap below groups the 18 requested changes into 10 phases. Each phase builds on "
        "the previous one and delivers a working improvement that can be reviewed before moving "
        "to the next phase. Foundational items - input validation, validity periods, and login "
        "security logging - come first as they are quick wins and improve data quality for "
        "everything that follows. The multi-tool In/Out and Delivery Challan rework (Phase 3) is "
        "the largest single piece of work, so it follows once the groundwork is in place. The "
        "remaining phases add specialised modules (inspector records, certificates, repairs, "
        "audits, and dashboard analytics) that can be sequenced flexibly based on priority.",
        normal_style,
    ))
    elements.append(Spacer(1, 0.15 * inch))

    for title, scr_refs, desc in PHASES:
        elements.append(Paragraph(title, sub_heading_style))
        elements.append(Paragraph(f"<i>Covers: {scr_refs}</i>", cell_style))
        elements.append(Spacer(1, 0.04 * inch))
        elements.append(Paragraph(desc, normal_style))
        elements.append(Spacer(1, 0.12 * inch))

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph("QR Tool Management System &middot; L&amp;T Construction", cell_style))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
