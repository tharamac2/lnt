import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import {
  QrCode,
  MapPin,
  Save,
  Wrench,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  User,
  Truck,
  Store,
  Search,
  X,
  Download
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import api from '../services/api';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import ScannerDialog from '../components/ScannerDialog';

const StoreView = () => {
  const [storeLocation, setStoreLocation] = useState<string>('Store');
  const [inventoryTools, setInventoryTools] = useState<any[]>([]);

  // Inventory search, filters & bulk selection
  const [inventorySearch, setInventorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');
  const [selectedToolIds, setSelectedToolIds] = useState<Set<number>>(new Set());

  // Bulk Transaction State
  const [bulkActionMode, setBulkActionMode] = useState<'in' | 'out' | null>(null);
  const [bulkInSubCategory, setBulkInSubCategory] = useState('new_product');
  const [bulkOutSubCategory, setBulkOutSubCategory] = useState('subcon_work');
  const [bulkFormData, setBulkFormData] = useState({
    subcontractorName: '',
    subcontractorCode: '',
    subcontractorMobile: '',
    targetSite: '',
    remarks: ''
  });
  const [bulkMobileError, setBulkMobileError] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [scannedTool, setScannedTool] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transaction State
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [inSubCategory, setInSubCategory] = useState('subcon_return'); // subcon_return, new_product, site_receive
  const [outSubCategory, setOutSubCategory] = useState('subcon_work'); // subcon_work, site_transfer

  // Incident State
  const [isIncidentMode, setIsIncidentMode] = useState(false);
  const [incidentDebitTo, setIncidentDebitTo] = useState('');

  // Form Data
  const [formData, setFormData] = useState({
    subcontractorName: '',
    subcontractorCode: '',
    subcontractorMobile: '',
    targetSite: '', // Current Site updates to "Store" on In, or specific site on Out
    remarks: ''
  });
  const [mobileError, setMobileError] = useState('');

  // Last Transaction
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'usable': return 'bg-[#16A34A] text-white';
      case 'scrap': return 'bg-red-100 text-red-700';
      case 'missing': return 'bg-orange-100 text-orange-700';
      case 'stolen': return 'bg-red-900 text-white';
      case 'scrapped': return 'bg-neutral-800 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  const uniqueMakes = useMemo(() => {
    const makes = new Set<string>();
    inventoryTools.forEach((tool) => {
      if (tool.make) makes.add(tool.make);
    });
    return Array.from(makes).sort();
  }, [inventoryTools]);

  const filteredInventoryTools = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    return inventoryTools.filter((tool) => {
      if (statusFilter !== 'all' && tool.status !== statusFilter) return false;
      if (makeFilter !== 'all' && tool.make !== makeFilter) return false;
      if (!query) return true;
      return (
        (tool.description || '').toLowerCase().includes(query) ||
        (tool.qr_code || '').toLowerCase().includes(query) ||
        (tool.make || '').toLowerCase().includes(query) ||
        (tool.capacity || '').toLowerCase().includes(query)
      );
    });
  }, [inventoryTools, inventorySearch, statusFilter, makeFilter]);

  const toggleToolSelection = (toolId: number) => {
    setSelectedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const allFilteredSelected = filteredInventoryTools.length > 0 &&
    filteredInventoryTools.every((tool) => selectedToolIds.has(tool.id));

  const toggleSelectAll = () => {
    setSelectedToolIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredInventoryTools.forEach((tool) => next.delete(tool.id));
        return next;
      }
      const next = new Set(prev);
      filteredInventoryTools.forEach((tool) => next.add(tool.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedToolIds(new Set());

  const selectedTools = useMemo(
    () => inventoryTools.filter((tool) => selectedToolIds.has(tool.id)),
    [inventoryTools, selectedToolIds]
  );

  // Sub-Contractor Return is only valid for tools currently dispatched to a sub-contractor
  const allSelectedHaveSubcontractor = selectedTools.length > 0 &&
    selectedTools.every((tool) => !!tool.subcontractor_name);
  // Found/Recovered is only valid for tools currently reported missing/stolen
  const allSelectedMissingOrStolen = selectedTools.length > 0 &&
    selectedTools.every((tool) => tool.status === 'missing' || tool.status === 'stolen');
  // Scrap disposal is only valid if every selected tool is already marked scrap/scrapped
  const allSelectedScrap = selectedTools.length > 0 &&
    selectedTools.every((tool) => tool.status === 'scrap' || tool.status === 'scrapped');
  // Sub-contractor issue / site transfer are not valid if any selected tool is scrap/scrapped
  const anySelectedScrap = selectedTools.some((tool) => tool.status === 'scrap' || tool.status === 'scrapped');

  const openBulkReceipt = () => {
    setBulkInSubCategory(allSelectedHaveSubcontractor ? 'subcon_return' : 'new_product');
    setBulkActionMode('in');
  };

  const openBulkDispatch = () => {
    setBulkOutSubCategory(allSelectedScrap ? 'scrap_disposal' : 'subcon_work');
    setBulkActionMode('out');
  };

  const exportSelectedInventoryPDF = () => {
    const selectedTools = inventoryTools.filter((tool) => selectedToolIds.has(tool.id));
    if (selectedTools.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(`${storeLocation} Inventory - Selected Items`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    autoTable(doc, {
      head: [['Description', 'QR / Tracking', 'Make', 'Capacity', 'Status']],
      body: selectedTools.map((tool) => [
        tool.description,
        tool.qr_code,
        tool.make,
        tool.capacity,
        tool.status,
      ]),
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(`${storeLocation}_Selected_Inventory_${Date.now()}.pdf`);
    toast.success(`Exported ${selectedTools.length} item(s) to PDF`);
  };

  const refreshInventory = async () => {
    try {
      const userRes = await api.get('/users/me');
      const site = userRes.data.site;
      if (site) {
        setStoreLocation(site);
        const toolsRes = await api.get(`/tools/?site=${site}&limit=10000000`);
        setInventoryTools(toolsRes.data);
      } else {
        setStoreLocation('Store');
      }
    } catch (err) {
      console.error("Failed to fetch user site or inventory", err);
    }
  };

  useEffect(() => {
    refreshInventory();
  }, [lastTransaction]);

  const triggerScan = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setScanning(true);
    const html5QrCode = new Html5Qrcode("reader-hidden-store");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      let code = decodedText;
      if (decodedText.includes('/view-tool/')) {
        const parts = decodedText.split('/view-tool/');
        if (parts.length > 1) {
          code = parts[1];
        }
      }
      fetchToolDetails(code);
    } catch (err) {
      console.error("Error scanning file", err);
      toast.error("Could not read QR code from image");
    } finally {
      setScanning(false);
      html5QrCode.clear();
    }
  };

  const fetchToolDetails = async (code: string) => {
    try {
      toast.info(`Fetching tool: ${code}`);
      setLastTransaction(null); // Clear previous transaction summary
      const res = await api.get(`/tools/qr/${code}`);
      setScannedTool(res.data);

      // Auto-fill form based on current tool state
      setFormData({
        subcontractorName: res.data.subcontractor_name || '',
        subcontractorCode: res.data.subcontractor_code || '',
        subcontractorMobile: res.data.subcontractor_mobile || '',
        targetSite: '',
        remarks: ''
      });

      // Auto-fill Incident Debit if subcon assigned
      if (res.data.subcontractor_name) {
        setIncidentDebitTo(res.data.subcontractor_name);
      } else {
        setIncidentDebitTo('');
      }

      // Sub-Contractor Return is only valid for tools currently dispatched to a sub-contractor
      setInSubCategory(res.data.subcontractor_name ? 'subcon_return' : 'new_product');

      toast.success("Tool details loaded");
    } catch (error) {
      console.error(error);
      toast.error("Tool not found");
    }
  };



  const generatePDF = (tool: any, transactionDetails: any, remarks: string, type: 'RECEIPT' | 'DISPATCH' = 'RECEIPT') => {
    try {
      const doc = new jsPDF();

      // --- Header ---
      doc.setFontSize(22);
      doc.setTextColor(30, 58, 138); // #1E3A8A Blue
      // "Inward Delivery Challan" for Receipt, "Outward Delivery Challan" for Dispatch
      const title = type === 'RECEIPT' ? "Inward Delivery Challan" : "Outward Delivery Challan";
      doc.text(title, 105, 20, { align: "center" });

      // --- Meta Info ---
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, { align: "center" });
      doc.text(`Transaction ID: ${Date.now()}`, 105, 35, { align: "center" });

      doc.setLineWidth(0.5);
      doc.line(15, 40, 195, 40);

      // --- Tool Details Box ---
      // Box: x=15, y=45, w=180, h=45
      doc.setDrawColor(200); // Light Gray Border
      doc.setFillColor(250); // Very Light Gray BG
      doc.rect(15, 45, 180, 45, 'FD'); // Fill and Draw

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Tool Details", 20, 55);

      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text(`Description:`, 20, 65); doc.text(tool.description, 60, 65);
      doc.text(`QR Code:`, 20, 72); doc.text(tool.qr_code, 60, 72);
      doc.text(`Make:`, 20, 79); doc.text(tool.make, 60, 79);
      doc.text(`Capacity:`, 20, 86); doc.text(`${tool.capacity} (SWL: ${tool.safe_working_load})`, 60, 86);

      // --- Transaction Details Box ---
      // Box: x=15, y=95, w=180, h=55
      doc.setDrawColor(200);
      doc.setFillColor(255); // White BG
      doc.rect(15, 95, 180, 55, 'S'); // Stroke only

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Transaction Details", 20, 105);

      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text(`Type:`, 20, 115); doc.text(type === 'RECEIPT' ? "Receipt (Inward)" : "Dispatch (Outward)", 60, 115);
      doc.text(`Category:`, 20, 122); doc.text(transactionDetails.replace('_', ' ').toUpperCase(), 60, 122);

      if (type === 'RECEIPT') {
        if (transactionDetails === 'subcon_return' && tool.subcontractor_name) {
          doc.text(`Returned By:`, 20, 129); doc.text(tool.subcontractor_name, 60, 129);
        } else {
          doc.text(`Source:`, 20, 129); doc.text("External / Site", 60, 129);
        }
        doc.text(`Destination:`, 20, 136); doc.text(storeLocation, 60, 136);
      } else {
        // DISPATCH
        if (transactionDetails === 'subcon_work' && tool.subcontractor_name) {
          doc.text(`Issued To:`, 20, 129); doc.text(tool.subcontractor_name || 'Sub-Contractor', 60, 129);
        } else {
          doc.text(`Destination:`, 20, 129); doc.text("Site Transfer", 60, 129);
        }
        doc.text(`Source:`, 20, 136); doc.text(storeLocation, 60, 136);
      }

      doc.text(`Remarks:`, 20, 143); doc.text(remarks || '-', 60, 143, { maxWidth: 120 });

      // --- Footer ---
      doc.setLineWidth(0.5);
      doc.setDrawColor(0); // Black line
      doc.line(20, 250, 190, 250);

      doc.setFontSize(10);
      doc.text("Authorized Signature", 150, 270, { align: "center" });
      doc.line(130, 265, 170, 265);

      // Save
      const filename = `${type === 'RECEIPT' ? 'Inward' : 'Outward'}_Challan_${tool.qr_code}_${Date.now()}.pdf`;
      doc.save(filename);
      toast.success(`${type === 'RECEIPT' ? 'Inward' : 'Outward'} Challan Downloaded`);
    } catch (pdfError) {
      console.error("PDF Generation failed", pdfError);
      toast.error("Failed to generate PDF");
    }
  };


  const generateBulkPDF = (tools: any[], transactionDetails: string, remarks: string, type: 'RECEIPT' | 'DISPATCH') => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138);
      const title = type === 'RECEIPT' ? "Bulk Inward Delivery Challan" : "Bulk Outward Delivery Challan";
      doc.text(title, 105, 18, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 26, { align: "center" });
      doc.text(`Transaction ID: ${Date.now()}`, 105, 31, { align: "center" });

      doc.setFontSize(11);
      doc.setTextColor(50);
      let y = 40;
      doc.text(`Type:`, 14, y); doc.text(type === 'RECEIPT' ? "Receipt (Inward)" : "Dispatch (Outward)", 50, y);
      y += 6;
      doc.text(`Category:`, 14, y); doc.text(transactionDetails.replace(/_/g, ' ').toUpperCase(), 50, y);
      y += 6;
      if (type === 'RECEIPT') {
        doc.text(`Destination:`, 14, y); doc.text(storeLocation, 50, y);
      } else {
        doc.text(`Source:`, 14, y); doc.text(storeLocation, 50, y);
      }
      y += 6;
      doc.text(`Remarks:`, 14, y); doc.text(remarks || '-', 50, y, { maxWidth: 145 });
      y += 8;

      autoTable(doc, {
        head: [['Description', 'QR / Tracking', 'Make', 'Capacity']],
        body: tools.map((tool) => [tool.description, tool.qr_code, tool.make, tool.capacity]),
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138] },
      });

      doc.save(`Bulk_${type === 'RECEIPT' ? 'Inward' : 'Outward'}_Challan_${Date.now()}.pdf`);
      toast.success(`${type === 'RECEIPT' ? 'Inward' : 'Outward'} Challan Downloaded`);
    } catch (pdfError) {
      console.error("PDF Generation failed", pdfError);
      toast.error("Failed to generate PDF");
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedTools.length === 0 || !bulkActionMode) return;

    if ((bulkActionMode === 'out' && bulkOutSubCategory === 'subcon_work') ||
      (bulkActionMode === 'out' && bulkOutSubCategory === 'scrap_disposal')) {
      if (bulkFormData.subcontractorMobile && !/^\d{10}$/.test(bulkFormData.subcontractorMobile)) {
        toast.error("Please enter a valid 10-digit mobile number");
        return;
      }
    }

    if (bulkActionMode === 'out' && bulkOutSubCategory === 'site_transfer' && !bulkFormData.targetSite) {
      toast.error("Please enter a destination site");
      return;
    }

    setBulkSubmitting(true);
    try {
      const updatedTools: any[] = [];

      for (const tool of selectedTools) {
        const payload: any = { previous_site: tool.current_site };

        if (bulkActionMode === 'in') {
          payload.current_site = storeLocation;
          if (bulkInSubCategory === 'subcon_return') {
            payload.subcontractor_name = null;
            payload.subcontractor_code = null;
            payload.remarks = `Returned from Sub-Contractor (Bulk). ${bulkFormData.remarks}`;
          } else if (bulkInSubCategory === 'new_product') {
            payload.remarks = `New Product Received (Bulk). ${bulkFormData.remarks}`;
          } else if (bulkInSubCategory === 'site_receive') {
            payload.remarks = `Received from Site ${tool.current_site} (Bulk). ${bulkFormData.remarks}`;
          } else if (bulkInSubCategory === 'found_recovered') {
            payload.status = 'usable';
            payload.debit_to = null;
            payload.subcontractor_name = null;
            payload.subcontractor_code = null;
            payload.remarks = `Tool Found/Recovered (Bulk). Previous status: ${tool.status}. ${bulkFormData.remarks}`;
          }
        } else {
          if (bulkOutSubCategory === 'subcon_work') {
            payload.current_site = bulkFormData.targetSite || tool.current_site;
            payload.subcontractor_name = bulkFormData.subcontractorName;
            payload.subcontractor_code = bulkFormData.subcontractorCode;
            payload.subcontractor_mobile = bulkFormData.subcontractorMobile;
            payload.remarks = `Issued to Sub-Contractor (Bulk). ${bulkFormData.remarks}`;
          } else if (bulkOutSubCategory === 'site_transfer') {
            payload.current_site = bulkFormData.targetSite;
            payload.subcontractor_name = null;
            payload.subcontractor_code = null;
            payload.remarks = `Transferred to Site: ${bulkFormData.targetSite} (Bulk). ${bulkFormData.remarks}`;
          } else if (bulkOutSubCategory === 'scrap_disposal') {
            payload.status = 'scrapped';
            payload.current_site = 'Scrap Yard';
            payload.subcontractor_name = bulkFormData.subcontractorName;
            payload.subcontractor_code = bulkFormData.subcontractorCode;
            payload.subcontractor_mobile = bulkFormData.subcontractorMobile;
            payload.debit_to = null;
            payload.remarks = `Sent to Scrap Dealer: ${bulkFormData.subcontractorName} (${bulkFormData.subcontractorCode}) (Bulk). ${bulkFormData.remarks}`;
          }
        }

        await api.patch(`/tools/${tool.id}`, payload);
        updatedTools.push({ ...tool, ...payload });
      }

      toast.success(`Bulk ${bulkActionMode === 'in' ? 'Receipt' : 'Dispatch'} recorded for ${selectedTools.length} item(s)`);

      const transactionDetails = bulkActionMode === 'in' ? bulkInSubCategory : bulkOutSubCategory;
      const pdfType = bulkActionMode === 'in' ? 'RECEIPT' : 'DISPATCH';
      setTimeout(() => {
        generateBulkPDF(updatedTools, transactionDetails, bulkFormData.remarks, pdfType);
      }, 500);

      setBulkActionMode(null);
      clearSelection();
      setBulkFormData({ subcontractorName: '', subcontractorCode: '', subcontractorMobile: '', targetSite: '', remarks: '' });
      setBulkMobileError('');
      await refreshInventory();
      if (scannedTool) {
        refreshTool();
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to complete bulk transaction");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!scannedTool) return;

    // Mobile Validation
    if ((transactionType === 'out' && outSubCategory === 'subcon_work') ||
      (transactionType === 'out' && outSubCategory === 'scrap_disposal')) {
      if (formData.subcontractorMobile && !/^\d{10}$/.test(formData.subcontractorMobile)) {
        toast.error("Please enter a valid 10-digit mobile number");
        return;
      }
    }

    try {
      let payload: any = {};

      if (isIncidentMode) {
        // Incident Logic handled separately
        return;
      }

      if (transactionType === 'in') {
        // RECEIPT LOGIC
        // Default location is the selected Store, unless specified otherwise (e.g. Receive from site might imply it's NOW at Store)
        payload.current_site = storeLocation;

        if (inSubCategory === 'subcon_return') {
          payload.subcontractor_name = null; // Clear subcon
          payload.subcontractor_code = null;
          payload.remarks = `Returned from Sub-Contractor. ${formData.remarks}`;
        } else if (inSubCategory === 'new_product') {
          payload.remarks = `New Product Received. ${formData.remarks}`;
        } else if (inSubCategory === 'site_receive') {
          payload.remarks = `Received from Site ${scannedTool.current_site}. ${formData.remarks}`;
        } else if (inSubCategory === 'found_recovered') {
          payload.status = 'usable'; // Reset status
          payload.debit_to = null; // Clear liability
          payload.subcontractor_name = null;
          payload.subcontractor_code = null;
          payload.remarks = `Tool Found/Recovered. Previous status: ${scannedTool.status}. ${formData.remarks}`;
        }
      } else {
        // DISPATCH LOGIC
        if (outSubCategory === 'subcon_work') {
          payload.current_site = formData.targetSite || scannedTool.current_site; // Optional update site
          payload.subcontractor_name = formData.subcontractorName;
          payload.subcontractor_code = formData.subcontractorCode;
          payload.subcontractor_mobile = formData.subcontractorMobile;
          payload.remarks = `Issued to Sub-Contractor. ${formData.remarks}`;
        } else if (outSubCategory === 'site_transfer') {
          payload.current_site = formData.targetSite;
          payload.subcontractor_name = null; // Clear subcon if moving site to site? Depends on workflow. Assuming clear.
          payload.subcontractor_code = null;
          payload.remarks = `Transferred to Site: ${formData.targetSite}. ${formData.remarks}`;
        } else if (outSubCategory === 'scrap_disposal') {
          payload.status = 'scrapped';
          payload.current_site = 'Scrap Yard';
          payload.subcontractor_name = formData.subcontractorName; // Reusing for Scrap Dealer Name
          payload.subcontractor_code = formData.subcontractorCode; // Reusing for Scrap Dealer Code
          payload.subcontractor_mobile = formData.subcontractorMobile;
          payload.debit_to = null;
          payload.remarks = `Sent to Scrap Dealer: ${formData.subcontractorName} (${formData.subcontractorCode}). ${formData.remarks}`;
        }
      }

      // Common Fields
      payload.previous_site = scannedTool.current_site;

      await api.patch(`/tools/${scannedTool.id}`, payload);
      setLastTransaction({
        type: transactionType === 'in' ? 'RECEIPT' : 'DISPATCH',
        details: transactionType === 'in' ? inSubCategory : outSubCategory,
        remarks: payload.remarks,
        timestamp: new Date().toLocaleString()
      });
      toast.success("Transaction recorded successfully");

      // Generate PDF for both Receipt and Dispatch
      setTimeout(() => {
        generatePDF(
          { ...scannedTool, ...payload },
          transactionType === 'in' ? inSubCategory : outSubCategory,
          payload.remarks,
          transactionType === 'in' ? 'RECEIPT' : 'DISPATCH'
        );
      }, 500);

      refreshTool();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update tool");
    }
  };

  const handleIncidentReport = async (type: 'missing' | 'stolen') => {
    if (!scannedTool) return;
    try {
      const payload = {
        status: type,
        debit_to: incidentDebitTo,
        remarks: `Reported ${type.toUpperCase()}. Debit to: ${incidentDebitTo || 'None'}.`
      };
      await api.patch(`/tools/${scannedTool.id}`, payload);
      toast.success(`Tool marked as ${type}`);
      refreshTool();
      setIsIncidentMode(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to report incident");
    }
  };

  const refreshTool = async () => {
    if (scannedTool) {
      const res = await api.get(`/tools/${scannedTool.id}`);
      setScannedTool(res.data);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Store Operations</h1>
          <p className="text-gray-500 mt-1">Receipts, Dispatches, and Incident Reporting</p>
        </div>

      </div>

      {/* Inventory List */}
      {storeLocation && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-500 mb-6 mt-6">
          <CardHeader className="bg-gray-50 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <MapPin className="text-[#1E3A8A] w-5 h-5"/>
                {storeLocation} Inventory
              </CardTitle>
              <CardDescription>
                Tools actively stationed at {storeLocation}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
              {filteredInventoryTools.length} of {inventoryTools.length} {inventoryTools.length === 1 ? 'Item' : 'Items'}
            </Badge>
          </CardHeader>

          {/* Search & Filters */}
          {inventoryTools.length > 0 && (
            <div className="p-3 border-b border-gray-100 flex flex-col md:flex-row gap-2 md:items-center bg-white">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by description, QR code, make or capacity..."
                  className="pl-8 h-9"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                />
                {inventorySearch && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setInventorySearch('')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="usable">Usable</SelectItem>
                  <SelectItem value="scrap">Scrap</SelectItem>
                  <SelectItem value="scrapped">Scrapped</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="stolen">Stolen</SelectItem>
                </SelectContent>
              </Select>
              <Select value={makeFilter} onValueChange={setMakeFilter}>
                <SelectTrigger className="h-9 w-full md:w-[150px]">
                  <SelectValue placeholder="Make" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Makes</SelectItem>
                  {uniqueMakes.map((make) => (
                    <SelectItem key={make} value={make}>{make}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Bulk Selection Toolbar */}
          {selectedToolIds.size > 0 && (
            <div className="px-3 py-2 border-b border-blue-100 bg-blue-50 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-blue-800 font-medium">
                {selectedToolIds.size} item{selectedToolIds.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  className={`h-8 ${bulkActionMode === 'in' ? 'bg-green-700 hover:bg-green-800' : 'bg-green-600 hover:bg-green-700'} text-white`}
                  onClick={openBulkReceipt}
                >
                  <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" />
                  Receipt (IN)
                </Button>
                <Button
                  size="sm"
                  className={`h-8 ${bulkActionMode === 'out' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                  onClick={openBulkDispatch}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" />
                  Dispatch (OUT)
                </Button>
                <Button size="sm" variant="outline" className="h-8 bg-white" onClick={exportSelectedInventoryPDF}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export List
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-gray-500" onClick={() => { clearSelection(); setBulkActionMode(null); }}>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            {inventoryTools.length > 0 ? (
              filteredInventoryTools.length > 0 ? (
              <div className="max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader className="bg-white sticky top-0 border-b border-gray-100 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>QR / Tracking</TableHead>
                      <TableHead>Make & Capacity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventoryTools.map((tool) => (
                      <TableRow key={tool.id} className="hover:bg-blue-50/20 cursor-pointer" onClick={() => fetchToolDetails(tool.qr_code)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedToolIds.has(tool.id)}
                            onCheckedChange={() => toggleToolSelection(tool.id)}
                            aria-label={`Select ${tool.description}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-[#1E3A8A]">{tool.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-gray-500">{tool.qr_code}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                           {tool.make} <span className="text-xs text-gray-400 block">{tool.capacity}</span>
                        </TableCell>
                        <TableCell>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase whitespace-nowrap ${getStatusColor(tool.status)}`}>
                             {tool.status}
                           </span>
                           {tool.subcontractor_name && (
                             <span className="block text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]" title={tool.subcontractor_name}>
                               held by: {tool.subcontractor_name}
                             </span>
                           )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              ) : (
                <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                  <Search className="w-12 h-12 text-gray-200 mb-2"/>
                  <p>No tools match your search or filters.</p>
                </div>
              )
            ) : (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <Store className="w-12 h-12 text-gray-200 mb-2"/>
                <p>This location has no tools currently registered.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Transaction Panel */}
      {bulkActionMode && selectedTools.length > 0 && (
        <Card className="border-l-4 border-l-[#1E3A8A] animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="bg-gray-50 pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              {bulkActionMode === 'in' ? <ArrowDownCircle className="text-green-600 w-5 h-5" /> : <ArrowUpCircle className="text-blue-600 w-5 h-5" />}
              Bulk {bulkActionMode === 'in' ? 'Receipt (IN)' : 'Dispatch (OUT)'}
              <Badge variant="outline">{selectedTools.length} item{selectedTools.length === 1 ? '' : 's'}</Badge>
            </CardTitle>
            <CardDescription>
              This transaction will be applied to all {selectedTools.length} selected tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {bulkActionMode === 'in' && (
              <div className="space-y-4 animate-in slide-in-from-left-2">
                <Label>Receipt Type</Label>
                <RadioGroup value={bulkInSubCategory} onValueChange={setBulkInSubCategory} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${!allSelectedHaveSubcontractor ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <RadioGroupItem value="subcon_return" id="br1" disabled={!allSelectedHaveSubcontractor} />
                    <Label htmlFor="br1" className={`cursor-pointer ${!allSelectedHaveSubcontractor ? 'cursor-not-allowed text-gray-400' : ''}`}>Sub-Contractor Return</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="new_product" id="br2" />
                    <Label htmlFor="br2" className="cursor-pointer">New Product Supply</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="site_receive" id="br3" />
                    <Label htmlFor="br3" className="cursor-pointer">From Other Site</Label>
                  </div>
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${!allSelectedMissingOrStolen ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-green-50 border-green-200 bg-green-50/50'}`}>
                    <RadioGroupItem value="found_recovered" id="br4" disabled={!allSelectedMissingOrStolen} />
                    <Label htmlFor="br4" className={`cursor-pointer font-medium ${!allSelectedMissingOrStolen ? 'cursor-not-allowed text-gray-400' : 'text-green-800'}`}>Found / Recovered</Label>
                  </div>
                </RadioGroup>

                {!allSelectedHaveSubcontractor && (
                  <p className="text-xs text-gray-500">Sub-Contractor Return is only available when every selected tool is currently issued to a sub-contractor.</p>
                )}
                {!allSelectedMissingOrStolen && (
                  <p className="text-xs text-gray-500">Found / Recovered is only available when every selected tool is currently reported Missing or Stolen.</p>
                )}

                {bulkInSubCategory === 'subcon_return' && (
                  <div className="bg-orange-50 p-3 rounded text-sm text-orange-800 border border-orange-200">
                    <strong>Action:</strong> Selected tools will be marked as returned to Store. Sub-contractor assignment will be cleared.
                  </div>
                )}
                {bulkInSubCategory === 'found_recovered' && (
                  <div className="bg-green-50 p-3 rounded text-sm text-green-800 border border-green-200">
                    <strong>Action:</strong> Selected tools' status will be reset to <b>Usable</b>. Liability (Debit To) will be cleared. Tools returned to Store.
                  </div>
                )}
              </div>
            )}

            {bulkActionMode === 'out' && (
              <div className="space-y-4 animate-in slide-in-from-right-2">
                <Label>Dispatch Type</Label>
                <RadioGroup value={bulkOutSubCategory} onValueChange={setBulkOutSubCategory} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${anySelectedScrap ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <RadioGroupItem value="subcon_work" id="bd1" disabled={anySelectedScrap} />
                    <Label htmlFor="bd1" className={`cursor-pointer ${anySelectedScrap ? 'cursor-not-allowed text-gray-400' : ''}`}>Issue to Sub-Contractor</Label>
                  </div>
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${anySelectedScrap ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <RadioGroupItem value="site_transfer" id="bd2" disabled={anySelectedScrap} />
                    <Label htmlFor="bd2" className={`cursor-pointer ${anySelectedScrap ? 'cursor-not-allowed text-gray-400' : ''}`}>Transfer to Next Site</Label>
                  </div>
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${!allSelectedScrap ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-red-50 border-red-200'}`}>
                    <RadioGroupItem value="scrap_disposal" id="bd3" disabled={!allSelectedScrap} />
                    <Label htmlFor="bd3" className={`cursor-pointer ${!allSelectedScrap ? 'cursor-not-allowed text-gray-400' : 'text-red-700'}`}>Issue to Scrap Dealer</Label>
                  </div>
                </RadioGroup>

                {anySelectedScrap && (
                  <p className="text-xs text-gray-500">Issue to Sub-Contractor / Transfer are disabled because one or more selected tools are marked Scrap.</p>
                )}
                {!allSelectedScrap && (
                  <p className="text-xs text-gray-500">Issue to Scrap Dealer is only available when every selected tool is already marked Scrap.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {bulkActionMode === 'out' && bulkOutSubCategory === 'subcon_work' && (
                <>
                  <div className="space-y-2">
                    <Label>Sub-Contractor Name</Label>
                    <Input
                      placeholder="Name"
                      value={bulkFormData.subcontractorName}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sub-Contractor Code</Label>
                    <Input
                      placeholder="Code"
                      value={bulkFormData.subcontractorCode}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex justify-between">
                      Sub-Contractor Mobile
                      {bulkMobileError && <span className="text-red-500 text-[10px]">{bulkMobileError}</span>}
                    </Label>
                    <Input
                      placeholder="10-digit mobile number"
                      value={bulkFormData.subcontractorMobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setBulkFormData({ ...bulkFormData, subcontractorMobile: val });
                        setBulkMobileError(val && val.length !== 10 ? 'Must be 10 digits' : '');
                      }}
                    />
                  </div>
                </>
              )}

              {bulkActionMode === 'out' && bulkOutSubCategory === 'scrap_disposal' && (
                <>
                  <div className="space-y-2">
                    <Label>Scrap Dealer Name</Label>
                    <Input
                      placeholder="Dealer Name"
                      value={bulkFormData.subcontractorName}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scrap Dealer Code</Label>
                    <Input
                      placeholder="Dealer Code"
                      value={bulkFormData.subcontractorCode}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex justify-between">
                      Scrap Dealer Mobile
                      {bulkMobileError && <span className="text-red-500 text-[10px]">{bulkMobileError}</span>}
                    </Label>
                    <Input
                      placeholder="10-digit mobile number"
                      value={bulkFormData.subcontractorMobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setBulkFormData({ ...bulkFormData, subcontractorMobile: val });
                        setBulkMobileError(val && val.length !== 10 ? 'Must be 10 digits' : '');
                      }}
                    />
                  </div>
                </>
              )}

              {((bulkActionMode === 'out' && (bulkOutSubCategory === 'subcon_work' || bulkOutSubCategory === 'site_transfer')) || (bulkActionMode === 'in' && bulkInSubCategory === 'site_receive')) && (
                <div className="space-y-2">
                  <Label>{bulkActionMode === 'out' ? 'Destination Site' : 'Origin Site (Optional)'}</Label>
                  <Input
                    placeholder="Site Name"
                    value={bulkFormData.targetSite}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, targetSite: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Enter additional details..."
                  value={bulkFormData.remarks}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button className="flex-1 bg-[#1E3A8A]" onClick={handleBulkSubmit} disabled={bulkSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {bulkSubmitting ? 'Processing...' : `Confirm Bulk ${bulkActionMode === 'in' ? 'Receipt' : 'Dispatch'} (${selectedTools.length})`}
              </Button>
              <Button variant="outline" onClick={() => setBulkActionMode(null)} disabled={bulkSubmitting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Scanner */}
      <Card>
        <CardContent className="py-6 flex flex-col items-center gap-4">
          <div id="reader-hidden-store" className="hidden"></div>
          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <div className="flex flex-col md:flex-row gap-3 w-full justify-center">
            <ScannerDialog 
              onScan={fetchToolDetails} 
              buttonText="Live Camera Scanner"
              triggerClassName="bg-green-600 hover:bg-green-700 text-white px-8"
            />
            
            <Button size="lg" variant="outline" className="border-gray-300 px-8" onClick={triggerScan} disabled={scanning}>
              <QrCode className="w-5 h-5 mr-2" />
              {scanning ? 'Scanning...' : 'Upload QR Image'}
            </Button>
          </div>
          
          {/* Dev Manual Input */}
          <Input placeholder="Manual QR Entry" className="w-40 h-8 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') { fetchToolDetails(e.currentTarget.value); e.currentTarget.value = ''; } }} />
        </CardContent>
      </Card>

      {scannedTool && (
        <div className="space-y-6">
          {/* Tool Details Header */}
          <Card className="border-l-4 border-l-[#1E3A8A] overflow-hidden">
            <CardHeader className="bg-gray-50 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {scannedTool.description}
                    <Badge variant="outline">{scannedTool.qr_code}</Badge>
                  </CardTitle>
                  <CardDescription className='mt-1'>
                    Current Site: <strong>{scannedTool.current_site || 'N/A'}</strong> |
                    Status: <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${getStatusColor(scannedTool.status)}`}>{scannedTool.status}</span>
                  </CardDescription>
                </div>
                {scannedTool.subcontractor_name && (
                  <Badge variant="secondary" className="flex flex-col items-end gap-1 px-3 py-1">
                    <span className="text-[10px] text-gray-500 uppercase">Held By</span>
                    <span className="font-semibold">{scannedTool.subcontractor_name}</span>
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Make</p>
                  <p className="font-semibold text-gray-900">{scannedTool.make}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Capacity</p>
                  <p className="font-semibold text-gray-900">{scannedTool.capacity}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">SWL</p>
                  <p className="font-semibold text-[#1E3A8A]">{scannedTool.safe_working_load}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Expiry</p>
                  <p className="font-semibold text-gray-900">{scannedTool.expiry_date ? new Date(scannedTool.expiry_date).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Supplier Name</p>
                  <p className="font-semibold text-gray-900">{scannedTool.purchaser_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Supplier Code</p>
                  <p className="font-semibold text-gray-900">{scannedTool.supplier_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Date of Receipt</p>
                  <p className="font-semibold text-gray-900">{scannedTool.date_of_supply ? new Date(scannedTool.date_of_supply).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Job Code</p>
                  <p className="font-semibold text-gray-900">{scannedTool.job_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Job Description</p>
                  <p className="font-semibold text-gray-900">{scannedTool.job_description || '-'}</p>
                </div>
              </div>

              {/* Movement History */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Movement History</p>
                <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center justify-center gap-8 text-sm">
                    <div className="text-center">
                      <span className="text-xs text-gray-500 block">Previous Site</span>
                      <span className="font-semibold text-gray-700">{scannedTool.previous_site || '-'}</span>
                    </div>
                    <div className="text-blue-300">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-500 block">Current Site</span>
                      <span className="font-semibold text-blue-700">{scannedTool.current_site || storeLocation}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operations Area */}
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions" onClick={() => setIsIncidentMode(false)}>Standard Operations</TabsTrigger>
              <TabsTrigger value="incidents" onClick={() => setIsIncidentMode(true)} className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">Incident Reporting</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Button
                      variant={transactionType === 'in' ? 'default' : 'outline'}
                      className={`flex-1 gap-2 ${transactionType === 'in' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => setTransactionType('in')}
                    >
                      <ArrowDownCircle className="w-4 h-4" /> Receipt (IN)
                    </Button>
                    <Button
                      variant={transactionType === 'out' ? 'default' : 'outline'}
                      className={`flex-1 gap-2 ${transactionType === 'out' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => setTransactionType('out')}
                    >
                      <ArrowUpCircle className="w-4 h-4" /> Dispatch (OUT)
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {transactionType === 'in' && (
                    <div className="space-y-4 animate-in slide-in-from-left-2">
                      <Label>Receipt Type</Label>
                      <RadioGroup value={inSubCategory} onValueChange={setInSubCategory} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${!scannedTool.subcontractor_name ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                          <RadioGroupItem value="subcon_return" id="r1" disabled={!scannedTool.subcontractor_name} />
                          <Label htmlFor="r1" className={`cursor-pointer ${!scannedTool.subcontractor_name ? 'cursor-not-allowed text-gray-400' : ''}`}>Sub-Contractor Return</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                          <RadioGroupItem value="new_product" id="r2" />
                          <Label htmlFor="r2" className="cursor-pointer">New Product Supply</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                          <RadioGroupItem value="site_receive" id="r3" />
                          <Label htmlFor="r3" className="cursor-pointer">From Other Site</Label>
                        </div>
                        <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${scannedTool.status !== 'missing' && scannedTool.status !== 'stolen' ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-green-50 border-green-200 bg-green-50/50'}`}>
                          <RadioGroupItem value="found_recovered" id="r4" disabled={scannedTool.status !== 'missing' && scannedTool.status !== 'stolen'} />
                          <Label htmlFor="r4" className={`cursor-pointer font-medium ${scannedTool.status !== 'missing' && scannedTool.status !== 'stolen' ? 'cursor-not-allowed text-gray-400' : 'text-green-800'}`}>Found / Recovered</Label>
                        </div>
                      </RadioGroup>

                      {!scannedTool.subcontractor_name && (
                        <p className="text-xs text-gray-500">Sub-Contractor Return is only available for tools currently issued to a sub-contractor.</p>
                      )}

                      {/* Conditional Info */}
                      {inSubCategory === 'subcon_return' && (
                        <div className="bg-orange-50 p-3 rounded text-sm text-orange-800 border border-orange-200">
                          <strong>Action:</strong> Tool will be marked as returned to Store. Sub-contractor assignment will be cleared.
                        </div>
                      )}
                      {inSubCategory === 'found_recovered' && (
                        <div className="bg-green-50 p-3 rounded text-sm text-green-800 border border-green-200">
                          <strong>Action:</strong> Tool status will be reset to <b>Usable</b>. Liability (Debit To) will be cleared. Tool returned to Store.
                        </div>
                      )}
                    </div>
                  )}

                  {transactionType === 'out' && (
                    <div className="space-y-4 animate-in slide-in-from-right-2">
                      <Label>Dispatch Type</Label>
                      <RadioGroup value={outSubCategory} onValueChange={setOutSubCategory} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${scannedTool.status === 'scrap' || scannedTool.status === 'scrapped' ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                          <RadioGroupItem value="subcon_work" id="d1" disabled={scannedTool.status === 'scrap' || scannedTool.status === 'scrapped'} />
                          <Label htmlFor="d1" className={`cursor-pointer ${scannedTool.status === 'scrap' || scannedTool.status === 'scrapped' ? 'cursor-not-allowed text-gray-400' : ''}`}>Issue to Sub-Contractor</Label>
                        </div>
                        <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${scannedTool.status === 'scrap' || scannedTool.status === 'scrapped' ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                          <RadioGroupItem value="site_transfer" id="d2" disabled={scannedTool.status === 'scrap' || scannedTool.status === 'scrapped'} />
                          <Label htmlFor="d2" className={`cursor-pointer ${scannedTool.status === 'scrap' || scannedTool.status === 'scrapped' ? 'cursor-not-allowed text-gray-400' : ''}`}>Transfer to Next Site</Label>
                        </div>
                        <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer ${scannedTool.status !== 'scrap' && scannedTool.status !== 'scrapped' ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'hover:bg-red-50 border-red-200'}`}>
                          <RadioGroupItem value="scrap_disposal" id="d3" disabled={scannedTool.status !== 'scrap' && scannedTool.status !== 'scrapped'} />
                          <Label htmlFor="d3" className={`cursor-pointer ${scannedTool.status !== 'scrap' && scannedTool.status !== 'scrapped' ? 'cursor-not-allowed text-gray-400' : 'text-red-700'}`}>Issue to Scrap Dealer</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    {/* Fields dynamic based on selection */}
                    {(transactionType === 'out' && outSubCategory === 'subcon_work') && (
                      <>
                        <div className="space-y-2">
                          <Label>Sub-Contractor Name</Label>
                          <Input
                            placeholder="Name"
                            value={formData.subcontractorName}
                            onChange={(e) => setFormData({ ...formData, subcontractorName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sub-Contractor Code</Label>
                          <Input
                            placeholder="Code"
                            value={formData.subcontractorCode}
                            onChange={(e) => setFormData({ ...formData, subcontractorCode: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="flex justify-between">
                            Sub-Contractor Mobile
                            {mobileError && <span className="text-red-500 text-[10px]">{mobileError}</span>}
                          </Label>
                          <Input
                            placeholder="10-digit mobile number"
                            value={formData.subcontractorMobile}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setFormData({ ...formData, subcontractorMobile: val });
                              if (val && val.length !== 10) {
                                setMobileError('Must be 10 digits');
                              } else {
                                setMobileError('');
                              }
                            }}
                          />
                        </div>
                      </>
                    )}

                    {(transactionType === 'out' && outSubCategory === 'scrap_disposal') && (
                      <>
                        <div className="space-y-2">
                          <Label>Scrap Dealer Name</Label>
                          <Input
                            placeholder="Dealer Name"
                            value={formData.subcontractorName}
                            onChange={(e) => setFormData({ ...formData, subcontractorName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Scrap Dealer Code</Label>
                          <Input
                            placeholder="Dealer Code"
                            value={formData.subcontractorCode}
                            onChange={(e) => setFormData({ ...formData, subcontractorCode: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="flex justify-between">
                            Scrap Dealer Mobile
                            {mobileError && <span className="text-red-500 text-[10px]">{mobileError}</span>}
                          </Label>
                          <Input
                            placeholder="10-digit mobile number"
                            value={formData.subcontractorMobile}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setFormData({ ...formData, subcontractorMobile: val });
                              if (val && val.length !== 10) {
                                setMobileError('Must be 10 digits');
                              } else {
                                setMobileError('');
                              }
                            }}
                          />
                        </div>
                      </>
                    )}

                    {(transactionType === 'out' || inSubCategory === 'site_receive') && (
                      <div className="space-y-2">
                        <Label>{transactionType === 'out' ? 'Destination Site' : 'Origin Site (Optional)'}</Label>
                        <Input
                          placeholder="Site Name"
                          value={formData.targetSite}
                          onChange={(e) => setFormData({ ...formData, targetSite: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label>Remarks</Label>
                      <Input
                        placeholder="Enter additional details..."
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button className="w-full bg-[#1E3A8A]" onClick={handleSubmit}>
                    <Save className="w-4 h-4 mr-2" />
                    Confirm {transactionType === 'in' ? 'Receipt' : 'Dispatch'}
                  </Button>

                  {lastTransaction && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-green-800 flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Transaction Recorded Successfully
                          </h3>
                          <div className="mt-2 text-sm text-green-700 space-y-1">
                            <p><span className="font-medium">Type:</span> {lastTransaction.type}</p>
                            <p><span className="font-medium">Category:</span> {lastTransaction.details.replace('_', ' ').toUpperCase()}</p>
                            <p><span className="font-medium">Remarks:</span> {lastTransaction.remarks}</p>
                            <p><span className="font-medium">Time:</span> {lastTransaction.timestamp}</p>
                          </div>
                        </div>
                        {lastTransaction && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white border-green-200 text-green-700 hover:bg-green-100"
                            onClick={() => generatePDF(scannedTool, lastTransaction.details, lastTransaction.remarks, lastTransaction.type)}
                          >
                            <ArrowDownCircle className="w-4 h-4 mr-2" />
                            Download {lastTransaction.type === 'RECEIPT' ? 'Receipt' : 'Dispatch'} Note
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="incidents" className="mt-4">
              <Card className="border-red-200">
                <CardHeader className="bg-red-50">
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Report Incident
                  </CardTitle>
                  <CardDescription>
                    Mark tool as Missing or Stolen and calculate liability.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label>Debit To (Sub-Contractor / Entity)</Label>
                    <div className="flex gap-2">
                      <User className="w-5 h-5 text-gray-400 mt-2" />
                      <Input
                        placeholder="Who is liable?"
                        value={incidentDebitTo}
                        onChange={(e) => setIncidentDebitTo(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      This entity will be held liable for the cost of the tool.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => handleIncidentReport('missing')}>
                      Mark as MISSING
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleIncidentReport('stolen')}>
                      Mark as STOLEN
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )
      }
    </div >
  );
};

export default StoreView;
