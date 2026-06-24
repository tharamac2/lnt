import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ltLogo from '../../assets/lt-logo.png';

export interface DeliveryChallanItem {
  description: string;
  qrCode?: string;
  quantity?: string | number;
  unit?: string;
  rate?: string;
}

export interface DeliveryChallanOptions {
  type: 'RECEIPT' | 'DISPATCH';
  consignee: string;
  siteCode?: string;
  date?: string;
  remarks?: string;
  items: DeliveryChallanItem[];
  filename?: string;
  dcNo?: string;
  trnCd?: string;
  sendingCentreCode?: string;
  mrNo?: string;
  mrDate?: string;
  stockType?: string;
  vendorCode?: string;
  ewayBillNo?: string;
  gatePassApprovedBy?: string;
  totalAmount?: string;
  consignorSalesTax?: string;
  consigneeSalesTax?: string;
  vehicleDetails?: string;
  lrNo?: string;
  freightToPay?: string;
  freightPaid?: string;
  receiptRmnNo?: string;
  receiptDate?: string;
  driverName?: string;
  driverMobile?: string;
  copyDistribution?: string[];
}

export const COPY_DISTRIBUTION_OPTIONS = [
  { id: '1', label: '1. CONSIGNEE' },
  { id: '2', label: '2. CONSIGNEE - CONSIGNOR' },
  { id: '3', label: '3. GATE PASS (SECURITY - ACCOUNTS)' },
  { id: '4', label: "4. CONSIGNOR'S FILE" },
];

const getLogoDataUrl = async (): Promise<string> => {
  const response = await fetch(ltLogo);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const buildDeliveryChallanDoc = async (options: DeliveryChallanOptions): Promise<jsPDF> => {
  const {
    type, consignee, siteCode, date, remarks, items,
    dcNo, trnCd, sendingCentreCode, mrNo, mrDate, stockType, vendorCode, ewayBillNo,
    gatePassApprovedBy, totalAmount, consignorSalesTax, consigneeSalesTax,
    vehicleDetails, lrNo, freightToPay, freightPaid, receiptRmnNo, receiptDate,
    driverName, driverMobile,
    copyDistribution,
  } = options;
  const doc = new jsPDF();

  const left = 14;
  const right = 196;
  const width = right - left;

  // --- Logo & Company Header ---
  try {
    const logoData = await getLogoDataUrl();
    // Logo is ~347x100px (~3.47:1) - keep aspect ratio
    doc.addImage(logoData, 'PNG', left, 8, 38, 11);
  } catch (e) {
    console.warn('Could not load logo for PDF', e);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text('Larsen & Toubro Limited, Construction', (left + right) / 2, 27, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(left, 31, right, 31);

  // --- Box 1: Delivery Challan / Consignee ---
  const box1Top = 31;
  const box1Height = 32;
  const box1Bottom = box1Top + box1Height;
  const leftColWidth = 110;
  const leftColRight = left + leftColWidth;

  doc.setLineWidth(0.3);
  doc.rect(left, box1Top, width, box1Height);
  doc.line(leftColRight, box1Top, leftColRight, box1Bottom); // vertical divider

  // Left column: title + M.R.C NO / DATE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('DELIVERY CHALLAN', left + leftColWidth / 2, box1Top + 12, { align: 'center' });

  const subRowY = box1Top + 19;
  doc.line(left, subRowY, leftColRight, subRowY); // horizontal divider
  const leftSubColRight = left + leftColWidth / 2;
  doc.line(leftSubColRight, subRowY, leftSubColRight, box1Bottom); // vertical divider

  doc.setFontSize(8);
  doc.text('DC NO.', left + 2, subRowY + 5);
  doc.text('DATE', leftSubColRight + 2, subRowY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(dcNo || '-', left + 2, subRowY + 11);
  doc.text(date || new Date().toLocaleDateString(), leftSubColRight + 2, subRowY + 11);

  // Right column: Consignee
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONSIGNEE', leftColRight + 2, box1Top + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(consignee || '-', leftColRight + 2, box1Top + 11, { maxWidth: width - leftColWidth - 4 });

  const rightSubRowY = box1Bottom - 6;
  doc.line(leftColRight, rightSubRowY, right, rightSubRowY); // horizontal divider
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONSIGNEE / SITE CODE NO.', leftColRight + 2, rightSubRowY + 4);
  doc.setFont('helvetica', 'normal');
  if (siteCode) {
    doc.text(siteCode, leftColRight + 55, rightSubRowY + 4);
  }

  // --- Box 2: TRN CD / Codes Row ---
  const box2Top = box1Bottom;
  const box2Height = 22;
  const box2Bottom = box2Top + box2Height;
  const colWidths = [18, 36, 24, 30, 36, 38];
  const colLabels = ['TRN CD', 'SENDING / ACCOUNTING\nCENTRE CODE', 'M. R. NO.', 'M. R. DATE', 'STOCK TYPE', 'VENDOR CODE'];
  const colValues = [trnCd || 'M 25', sendingCentreCode || '', mrNo || '', mrDate || '', stockType || '', vendorCode || ''];

  doc.setLineWidth(0.3);
  doc.rect(left, box2Top, width, box2Height);
  let colX = left;
  const colXPositions: number[] = [];
  for (let i = 0; i < colWidths.length; i++) {
    colXPositions.push(colX);
    if (i > 0) doc.line(colX, box2Top, colX, box2Bottom);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const lines = colLabels[i].split('\n');
    lines.forEach((line, li) => doc.text(line, colX + 1.5, box2Top + 4 + li * 3.5));
    colX += colWidths[i];
  }
  // Column values
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  colValues.forEach((val, i) => {
    if (val) doc.text(String(val), colXPositions[i] + 1.5, box2Bottom - 3, { maxWidth: colWidths[i] - 3 });
  });

  // --- E-Way Bill No. Row ---
  const ewayBoxTop = box2Bottom;
  const ewayBoxHeight = 10;
  const ewayBoxBottom = ewayBoxTop + ewayBoxHeight;
  doc.rect(left, ewayBoxTop, width, ewayBoxHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('E-WAY BILL NO.', left + 2, ewayBoxTop + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (ewayBillNo) doc.text(ewayBillNo, left + 38, ewayBoxTop + 6.5, { maxWidth: width - 40 });

  // --- Instruction line ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const instruction = type === 'DISPATCH'
    ? 'We have despatched the following goods. Kindly return the duplicate copy duly signed acknowledging receipt of goods'
    : 'We have received the following goods. Kindly acknowledge receipt by signing the duplicate copy';
  doc.text(instruction, (left + right) / 2, ewayBoxBottom + 6, { align: 'center', maxWidth: width - 4 });

  const cursorY = ewayBoxBottom + 10;

  // --- Items Table ---
  autoTable(doc, {
    startY: cursorY,
    margin: { left, right: 210 - right },
    head: [['SL.\nNO.', 'DESCRIPTION', 'QUANTITY', 'UNIT', 'RATE\nRS.']],
    body: items.map((item, idx) => [
      String(idx + 1),
      item.qrCode ? `${item.description}\nQR: ${item.qrCode}` : item.description,
      String(item.quantity ?? '1'),
      item.unit ?? 'NOS',
      item.rate ?? '',
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 96 },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
    },
  });

  let y = (doc as any).lastAutoTable.finalY as number;

  // If there isn't enough room for the remaining sections (~96mm), start a new page
  if (y > 191) {
    doc.addPage();
    y = 20;
  }

  // --- Gate Pass / Total ---
  const gatePassWidth = 140;
  doc.setLineWidth(0.3);
  doc.rect(left, y, width, 14);
  doc.line(left + gatePassWidth, y, left + gatePassWidth, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GATE PASS COPY APPROVED BY', left + gatePassWidth / 2, y + 6, { align: 'center' });
  doc.text('TOTAL', left + gatePassWidth + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (gatePassApprovedBy) doc.text(gatePassApprovedBy, left + gatePassWidth / 2, y + 12, { align: 'center', maxWidth: gatePassWidth - 4 });
  if (totalAmount) doc.text(String(totalAmount), left + gatePassWidth + 22, y + 6);
  y += 14;

  // --- Sales Tax Row ---
  doc.rect(left, y, width, 16);
  doc.line(left + width / 2, y, left + width / 2, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("CONSIGNOR'S SALES TAX NO. & DATE", left + 2, y + 6);
  doc.text("CONSIGNEE'S SALES TAX NO. & DATE", left + width / 2 + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  if (consignorSalesTax) doc.text(consignorSalesTax, left + 2, y + 12, { maxWidth: width / 2 - 4 });
  if (consigneeSalesTax) doc.text(consigneeSalesTax, left + width / 2 + 2, y + 12, { maxWidth: width / 2 - 4 });
  y += 16;

  // --- Vehicle / LR / Freight Row ---
  const vehicleWidth = 75;
  const lrWidth = 57;
  const freightWidth = width - vehicleWidth - lrWidth;
  doc.rect(left, y, width, 20);
  doc.line(left + vehicleWidth, y, left + vehicleWidth, y + 20);
  doc.line(left + vehicleWidth + lrWidth, y, left + vehicleWidth + lrWidth, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('VEHICLE / PATCH THROUGH', left + 2, y + 6);
  doc.text('LR / RR NO. & DATE', left + vehicleWidth + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  if (vehicleDetails) doc.text(vehicleDetails, left + 2, y + 14, { maxWidth: vehicleWidth - 4 });
  if (lrNo) doc.text(lrNo, left + vehicleWidth + 2, y + 14, { maxWidth: lrWidth - 4 });

  const freightX = left + vehicleWidth + lrWidth;
  const freightLabelWidth = freightWidth / 2;
  doc.line(freightX + freightLabelWidth, y, freightX + freightLabelWidth, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.text('FREIGHT RS.', freightX + 2, y + 6);
  doc.line(freightX + freightLabelWidth, y + 10, freightX + freightWidth, y + 10);
  doc.text('TO PAY', freightX + freightLabelWidth + 2, y + 7);
  doc.text('PAID', freightX + freightLabelWidth + 2, y + 17);
  doc.setFont('helvetica', 'normal');
  if (freightToPay) doc.text(String(freightToPay), freightX + freightLabelWidth + 20, y + 7);
  if (freightPaid) doc.text(String(freightPaid), freightX + freightLabelWidth + 20, y + 17);
  y += 20;

  // --- Receipt Details / For L&T ---
  const recHeight = 28;
  doc.rect(left, y, width, recHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RECEIPT DETAILS', left + 2, y + 6);
  doc.text('FOR LARSEN & TOUBRO LIMITED CONSTRUCTION DIVISION', right - 2, y + 6, { align: 'right', maxWidth: width / 2 });
  doc.line(left, y + 10, right, y + 10);

  // Single-line columns: RMN No. | Date | Driver Name | Mobile No. | Signature of Receiver
  const recCols = [
    { label: '(RMN NO.)', value: receiptRmnNo, x: left + 2, w: 26 },
    { label: '(DATE)', value: receiptDate, x: left + 30, w: 22 },
    { label: '(DRIVER NAME)', value: driverName, x: left + 54, w: 40 },
    { label: '(MOBILE NO.)', value: driverMobile, x: left + 96, w: 34 },
    { label: '(SIGNATURE OF RECEIVER)', value: '', x: left + 132, w: width - 132 - 2 },
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  recCols.forEach((col) => {
    if (col.value) doc.text(String(col.value), col.x, y + recHeight - 9, { maxWidth: col.w - 2 });
  });
  doc.setFontSize(6.5);
  recCols.forEach((col) => {
    doc.text(col.label, col.x, y + recHeight - 3, { maxWidth: col.w - 2 });
  });
  y += recHeight;

  // --- Remarks Box ---
  const remarksBoxHeight = 16;
  doc.setLineWidth(0.3);
  doc.rect(left, y, width, remarksBoxHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REMARKS', left + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (remarks) doc.text(remarks, left + 2, y + 12, { maxWidth: width - 4 });
  y += remarksBoxHeight;

  // --- Footer ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('D&M/STR/906', left, y + 5);
  doc.text('Registered Office : L & T House, Ballard Estate, Bombay - 400 038.', (left + right) / 2, y + 5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text('COPY DISTRIBUTION', left, y + 11);
  const selectedCopies = copyDistribution && copyDistribution.length > 0
    ? copyDistribution
    : COPY_DISTRIBUTION_OPTIONS.map((opt) => opt.id);

  let copyXCursor = left + 30;
  const separator = '   |   ';
  const visibleCopies = COPY_DISTRIBUTION_OPTIONS.filter((opt) => selectedCopies.includes(opt.id));
  visibleCopies.forEach((opt, idx) => {
    const label = opt.label.replace(/^\d+\.\s*/, '');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(label, copyXCursor, y + 11);
    copyXCursor += doc.getTextWidth(label);

    if (idx < visibleCopies.length - 1) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(separator, copyXCursor, y + 11);
      copyXCursor += doc.getTextWidth(separator);
    }
  });
  doc.setTextColor(0);

  return doc;
};

export const generateDeliveryChallanPDF = async (options: DeliveryChallanOptions) => {
  const { type, filename } = options;
  const doc = await buildDeliveryChallanDoc(options);
  const finalFilename = filename || `${type === 'RECEIPT' ? 'Inward' : 'Outward'}_Delivery_Challan_${Date.now()}.pdf`;
  doc.save(finalFilename);
};
