import { useState, useRef, useEffect } from 'react';
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
  Save,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  User,
  Truck,
  Wrench,
} from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import ScannerDialog from '../components/ScannerDialog';
import { DeliveryChallanOptions } from '../utils/deliveryChallan';
import DeliveryChallanPreviewDialog from '../components/DeliveryChallanPreviewDialog';

const StoreView = () => {
  const location = useLocation();
  const [storeLocation, setStoreLocation] = useState<string>('Store');

  const [scannedTool, setScannedTool] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  // Transaction State
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [inSubCategory, setInSubCategory] = useState('subcon_return'); // subcon_return, new_product, site_receive
  const [outSubCategory, setOutSubCategory] = useState('subcon_work'); // subcon_work, site_transfer

  // Incident State
  const [isIncidentMode, setIsIncidentMode] = useState(false);
  const [incidentDebitTo, setIncidentDebitTo] = useState('');

  // Repair Completion State
  const [repairResult, setRepairResult] = useState<'pass' | 'not_pass' | null>(null);
  const [repairScrapDealer, setRepairScrapDealer] = useState('');
  const [repairRemarks, setRepairRemarks] = useState('');
  const [repairValidityYears, setRepairValidityYears] = useState('');

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

  // Delivery Challan Preview/Edit Dialog
  const [challanDraft, setChallanDraft] = useState<DeliveryChallanOptions | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'usable': return 'bg-[#16A34A] text-white';
      case 'scrap': return 'bg-red-100 text-red-700';
      case 'under-repair': return 'bg-amber-100 text-amber-700';
      case 'missing': return 'bg-orange-100 text-orange-700';
      case 'stolen': return 'bg-red-900 text-white';
      case 'scrapped': return 'bg-neutral-800 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleManualSearchChange = async (query: string) => {
    setManualSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/tools/?search=${encodeURIComponent(query)}`);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error("Failed to search tools", err);
      }
    }, 300);
  };

  const refreshStoreLocation = async () => {
    try {
      const userRes = await api.get('/users/me');
      setStoreLocation(userRes.data.site || 'Store');
    } catch (err) {
      console.error("Failed to fetch user site", err);
    }
  };

  useEffect(() => {
    refreshStoreLocation();
  }, []);

  // If navigated here from Store Inventory with a specific tool, load it
  useEffect(() => {
    const qrCode = (location.state as any)?.qrCode;
    if (qrCode) {
      fetchToolDetails(qrCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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

      // Sub-Contractor Return is only valid for tools currently despatched to a sub-contractor
      setInSubCategory(res.data.subcontractor_name ? 'subcon_return' : 'new_product');

      toast.success("Tool details loaded");
    } catch (error) {
      console.error(error);
      toast.error("Tool not found");
    }
  };



  const generatePDF = (tool: any, transactionDetails: string, remarks: string, type: 'RECEIPT' | 'DESPATCH' = 'RECEIPT') => {
    let consignee = storeLocation;
    let siteCode: string | undefined;

    if (type === 'DESPATCH') {
      if (transactionDetails === 'subcon_work') {
        consignee = tool.subcontractor_name || 'Sub-Contractor';
        siteCode = tool.subcontractor_code || undefined;
      } else if (transactionDetails === 'site_transfer') {
        consignee = tool.current_site || 'Site';
      } else if (transactionDetails === 'scrap_disposal') {
        consignee = tool.subcontractor_name || 'Scrap Dealer';
        siteCode = tool.subcontractor_code || undefined;
      }
    }

    setChallanDraft({
      type,
      consignee,
      siteCode,
      remarks,
      items: [{
        description: tool.description,
        materialCode: tool.item_code,
        qrCode: tool.qr_code,
        quantity: '1',
        unit: 'NOS',
      }],
      filename: `${type === 'RECEIPT' ? 'Inward' : 'Outward'}_Challan_${tool.qr_code}_${Date.now()}.pdf`,
    });
  };


  const handleSubmit = async () => {
    if (!scannedTool) return;

    // Tool Status Validation
    if (transactionType === 'out') {
      if (outSubCategory === 'subcon_work' || outSubCategory === 'site_transfer') {
        if (scannedTool.status !== 'usable') {
          toast.error("Only tools in working condition (usable) can be issued to a subcontractor or transferred to another site.");
          return;
        }
      } else if (outSubCategory === 'scrap_disposal') {
        if (scannedTool.status !== 'scrap' && scannedTool.status !== 'scrapped') {
          toast.error("Only scrap tools can be sent to a scrap dealer.");
          return;
        }
      }
    }

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
        // DESPATCH LOGIC
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
        type: transactionType === 'in' ? 'RECEIPT' : 'DESPATCH',
        details: transactionType === 'in' ? inSubCategory : outSubCategory,
        remarks: payload.remarks,
        timestamp: new Date().toLocaleString()
      });
      toast.success("Transaction recorded successfully");

      // Generate PDF for both Receipt and Despatch
      setTimeout(() => {
        generatePDF(
          { ...scannedTool, ...payload },
          transactionType === 'in' ? inSubCategory : outSubCategory,
          payload.remarks,
          transactionType === 'in' ? 'RECEIPT' : 'DESPATCH'
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

  const handleRepairComplete = async () => {
    if (!scannedTool || !repairResult) return;
    try {
      if (repairResult === 'pass') {
        await api.patch(`/tools/${scannedTool.id}`, {
          status: 'usable',
          validity_period: repairValidityYears ? parseInt(repairValidityYears) : undefined,
          remarks: `Repair completed — PASSED. Tool restored to usable. Validity: ${repairValidityYears ? repairValidityYears + ' year(s)' : 'not set'}. ${repairRemarks}`.trim(),
        });
        toast.success('Tool marked as Usable after repair.');
      } else {
        await api.patch(`/tools/${scannedTool.id}`, {
          status: 'scrap',
          debit_to: repairScrapDealer || null,
          remarks: `Repair completed — NOT PASSED. Issued to scrap dealer${repairScrapDealer ? ': ' + repairScrapDealer : ''}. ${repairRemarks}`.trim(),
        });
        toast.success('Tool issued to scrap dealer after failed repair.');
      }
      setRepairResult(null);
      setRepairScrapDealer('');
      setRepairRemarks('');
      setRepairValidityYears('');
      refreshTool();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update repair result');
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
          <p className="text-gray-500 mt-1">Receipts, Despatches, and Incident Reporting</p>
        </div>

      </div>

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
          <div ref={searchContainerRef} className="relative w-80">
            <Input
              placeholder="Manual QR Entry (Search or Scan)"
              className="w-full h-9 text-sm"
              value={manualSearchQuery}
              onChange={(e) => handleManualSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualSearchQuery.trim()) {
                  fetchToolDetails(manualSearchQuery.trim());
                  setManualSearchQuery('');
                  setSearchResults([]);
                }
              }}
            />
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-50 divide-y divide-gray-100 text-left">
                {searchResults.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex flex-col gap-0.5"
                    onClick={() => {
                      fetchToolDetails(tool.qr_code);
                      setManualSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <span className="font-medium text-gray-900">{tool.description}</span>
                    <span className="text-xs text-gray-500">QR: {tool.qr_code} | Site: {tool.current_site || 'None'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
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
                      <ArrowUpCircle className="w-4 h-4" /> Despatch (OUT)
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
                      <Label>Despatch Type</Label>
                      <RadioGroup value={outSubCategory} onValueChange={setOutSubCategory} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                          <RadioGroupItem value="subcon_work" id="d1" />
                          <Label htmlFor="d1" className="cursor-pointer">Issue to Sub-Contractor</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                          <RadioGroupItem value="site_transfer" id="d2" />
                          <Label htmlFor="d2" className="cursor-pointer">Transfer to Next Site</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-red-50 border-red-200">
                          <RadioGroupItem value="scrap_disposal" id="d3" />
                          <Label htmlFor="d3" className="cursor-pointer text-red-700">Issue to Scrap Dealer</Label>
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
                          <Label>Vendor Code</Label>
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
                        <Label>
                          {transactionType === 'out'
                            ? (outSubCategory === 'subcon_work' ? 'Site Code' : 'Next Store')
                            : 'Origin Site (Optional)'}
                        </Label>
                        <Input
                          placeholder={
                            transactionType === 'out'
                              ? (outSubCategory === 'subcon_work' ? 'Site Code' : 'Store Name')
                              : 'Site Name'
                          }
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
                    Confirm {transactionType === 'in' ? 'Receipt' : 'Despatch'}
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
                            Download {lastTransaction.type === 'RECEIPT' ? 'Receipt' : 'Despatch'} Note
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

              {/* Repair Completion Card */}
              <Card className="border-amber-200 mt-4">
                <CardHeader className="bg-amber-50">
                  <CardTitle className="text-amber-800 flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    Repair Completed
                  </CardTitle>
                  <CardDescription>
                    Update the tool status after repair is done — mark as Usable or send to Scrap Dealer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Repair Result</Label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                        <input
                          type="radio"
                          name="repairResult"
                          value="pass"
                          checked={repairResult === 'pass'}
                          onChange={() => setRepairResult('pass')}
                          className="w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="font-medium text-green-700">Pass — Tool is Usable</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                        <input
                          type="radio"
                          name="repairResult"
                          value="not_pass"
                          checked={repairResult === 'not_pass'}
                          onChange={() => setRepairResult('not_pass')}
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                        />
                        <span className="font-medium text-red-700">Not Pass — Issue to Scrap Dealer</span>
                      </label>
                    </div>
                  </div>

                  {repairResult === 'pass' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Valid for (years)</Label>
                      <select
                        value={repairValidityYears}
                        onChange={(e) => setRepairValidityYears(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select validity period</option>
                        <option value="1">0 – 1 year</option>
                        <option value="2">1 – 2 years</option>
                        <option value="4">3 – 4 years</option>
                        <option value="6">5 – 6 years</option>
                        <option value="7">6 – 7 years</option>
                        <option value="8">7 – 8 years</option>
                      </select>
                    </div>
                  )}

                  {repairResult === 'not_pass' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Scrap Dealer Name</Label>
                      <div className="flex gap-2">
                        <Truck className="w-5 h-5 text-gray-400 mt-2" />
                        <Input
                          placeholder="Enter scrap dealer name"
                          value={repairScrapDealer}
                          onChange={(e) => setRepairScrapDealer(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Remarks (optional)</Label>
                    <Input
                      placeholder="Any additional notes about the repair..."
                      value={repairRemarks}
                      onChange={(e) => setRepairRemarks(e.target.value)}
                    />
                  </div>

                  <Button
                    className={`w-full font-semibold ${repairResult === 'pass' ? 'bg-green-600 hover:bg-green-700 text-white' : repairResult === 'not_pass' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                    disabled={!repairResult}
                    onClick={handleRepairComplete}
                  >
                    {repairResult === 'pass' && 'Confirm — Mark Tool as Usable'}
                    {repairResult === 'not_pass' && 'Confirm — Issue to Scrap Dealer'}
                    {!repairResult && 'Select a repair result above'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )
      }

      <DeliveryChallanPreviewDialog
        open={!!challanDraft}
        onOpenChange={(o) => !o && setChallanDraft(null)}
        initialOptions={challanDraft}
      />
    </div >
  );
};

export default StoreView;
