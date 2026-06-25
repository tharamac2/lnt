import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { ArrowDownCircle, ArrowUpCircle, History, Save, Truck, X, Upload } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { DeliveryChallanOptions } from '../utils/deliveryChallan';
import DeliveryChallanPreviewDialog from '../components/DeliveryChallanPreviewDialog';

const ToolsMovements = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeLocation, setStoreLocation] = useState<string>('');

  // Bulk Transaction State (passed in from Store Inventory's bulk select)
  const [bulkTools, setBulkTools] = useState<any[]>([]);
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
  const [toolConfigs, setToolConfigs] = useState<{ [key: number]: { status: 'received' | 'pending' | 'missing' | 'unconfigured'; expectedDays: number; reason: string } }>({});
  const [notReturnedTools, setNotReturnedTools] = useState<any[]>([]);

  // Dealers (Sub Contractor / Supplier / Scrap Dealer) for auto-fill dropdowns
  const [dealers, setDealers] = useState<any[]>([]);
  useEffect(() => {
    api.get('/dealers/').then((res) => setDealers(res.data || [])).catch((err) => console.error('Failed to fetch dealers', err));
  }, []);
  const dealersByCategory = (category: string) => dealers.filter((d) => d.category === category);
  const applyBulkDealer = (dealerId: string) => {
    const dealer = dealers.find((d) => String(d.id) === dealerId);
    if (!dealer) return;
    setBulkFormData((prev) => ({
      ...prev,
      subcontractorName: dealer.company_name || '',
      subcontractorCode: dealer.dealer_code || '',
      subcontractorMobile: dealer.contact_number || '',
    }));
  };

  useEffect(() => {
    const fetchAndFilterNotReturned = async () => {
      if (bulkActionMode !== 'in' || bulkTools.length === 0) {
        setNotReturnedTools([]);
        return;
      }
      try {
        const res = await api.get(`/tools/?limit=10000000`);
        const allTools = res.data;

        const selectedSubconNames = Array.from(new Set(bulkTools.map(t => t.subcontractor_name).filter(Boolean)));
        const selectedPreviousSites = Array.from(new Set(bulkTools.map(t => t.previous_site).filter(Boolean)));
        const selectedIds = new Set(bulkTools.map(t => t.id));

        let candidateTools: any[] = [];

        if (bulkInSubCategory === 'subcon_return') {
          candidateTools = allTools.filter((t: any) => 
            !selectedIds.has(t.id) &&
            t.current_site === storeLocation &&
            selectedSubconNames.includes(t.subcontractor_name)
          );
        } else if (bulkInSubCategory === 'site_receive') {
          candidateTools = allTools.filter((t: any) => 
            !selectedIds.has(t.id) &&
            t.current_site === storeLocation &&
            selectedPreviousSites.includes(t.previous_site)
          );
        }

        setNotReturnedTools(candidateTools);
      } catch (err) {
        console.error("Failed to fetch and filter not returned tools", err);
      }
    };

    fetchAndFilterNotReturned();
  }, [bulkTools, bulkInSubCategory, bulkActionMode, storeLocation]);

  useEffect(() => {
    if (notReturnedTools.length > 0) {
      setToolConfigs(prev => {
        const next = { ...prev };
        notReturnedTools.forEach(tool => {
          if (!next[tool.id]) {
            next[tool.id] = {
              status: 'unconfigured',
              expectedDays: 40,
              reason: ''
            };
          }
        });
        return next;
      });
    }
  }, [notReturnedTools]);

  // Delivery Challan Preview/Edit Dialog
  const [challanDraft, setChallanDraft] = useState<DeliveryChallanOptions | null>(null);

  // Dealer Custom Fields State
  const [dealerCustomFields, setDealerCustomFields] = useState<any[]>([]);
  const [selectedCustomFields, setSelectedCustomFields] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<{ [key: string]: any }>({});
  const [showCustomFieldsSelector, setShowCustomFieldsSelector] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const handleCustomFileUpload = async (fieldName: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingField(fieldName);
    try {
      const response = await api.post('/upload/certificate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setCustomFieldValues(prev => ({
        ...prev,
        [fieldName]: response.data.url
      }));
      toast.success(`${fieldName} uploaded successfully`);
    } catch (error) {
      console.error('Failed to upload file', error);
      toast.error(`Failed to upload ${fieldName}`);
    } finally {
      setUploadingField(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await api.get('/users/me');
        setStoreLocation(userRes.data.site || '');
      } catch (err) {
        console.error("Failed to fetch user site", err);
      }

      try {
        const customFieldsRes = await api.get('/dealers/custom-fields');
        setDealerCustomFields(customFieldsRes.data || []);
      } catch (err) {
        console.error("Failed to fetch dealer custom fields", err);
      }
    };
    init();

    const state = location.state as any;
    if (state?.selectedTools?.length && (state?.mode === 'in' || state?.mode === 'out')) {
      setBulkTools(state.selectedTools);
      setBulkActionMode(state.mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sub-Contractor Return is only valid for tools currently despatched to a sub-contractor
  const allSelectedHaveSubcontractor = bulkTools.length > 0 &&
    bulkTools.every((tool) => !!tool.subcontractor_name);
  // Found/Recovered is only valid for tools currently reported missing/stolen
  const allSelectedMissingOrStolen = bulkTools.length > 0 &&
    bulkTools.every((tool) => tool.status === 'missing' || tool.status === 'stolen');
  // Scrap disposal is only valid if every selected tool is already marked scrap/scrapped
  const allSelectedScrap = bulkTools.length > 0 &&
    bulkTools.every((tool) => tool.status === 'scrap' || tool.status === 'scrapped');
  // Sub-contractor issue / site transfer are not valid if any selected tool is scrap/scrapped
  const anySelectedScrap = bulkTools.some((tool) => tool.status === 'scrap' || tool.status === 'scrapped');

  useEffect(() => {
    if (bulkActionMode === 'in') {
      setBulkInSubCategory(allSelectedHaveSubcontractor ? 'subcon_return' : 'new_product');
    } else if (bulkActionMode === 'out') {
      setBulkOutSubCategory(allSelectedScrap ? 'scrap_disposal' : 'subcon_work');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkActionMode]);

  const generateBulkPDF = (tools: any[], transactionDetails: string, remarks: string, type: 'RECEIPT' | 'DESPATCH') => {
    let consignee = storeLocation;
    let siteCode: string | undefined;
    let vendorCode: string | undefined;

    if (type === 'DESPATCH') {
      if (transactionDetails === 'subcon_work') {
        consignee = bulkFormData.subcontractorName || 'Sub-Contractor';
        siteCode = bulkFormData.targetSite || undefined;
        vendorCode = bulkFormData.subcontractorCode || undefined;
      } else if (transactionDetails === 'site_transfer') {
        consignee = bulkFormData.targetSite || 'Site';
      } else if (transactionDetails === 'scrap_disposal') {
        consignee = bulkFormData.subcontractorName || 'Scrap Dealer';
        vendorCode = bulkFormData.subcontractorCode || undefined;
      }
    }

    setChallanDraft({
      type,
      consignee,
      siteCode,
      vendorCode,
      remarks,
      items: tools.map((tool) => ({
        description: tool.description,
        materialCode: tool.item_code,
        qrCode: tool.qr_code,
        quantity: '1',
        unit: 'NOS',
      })),
      filename: `Bulk_${type === 'RECEIPT' ? 'Inward' : 'Outward'}_Challan_${Date.now()}.pdf`,
    });
  };

  const cancelBulkTransaction = () => {
    setBulkActionMode(null);
    setBulkTools([]);
    setBulkFormData({ subcontractorName: '', subcontractorCode: '', subcontractorMobile: '', targetSite: '', remarks: '' });
    setBulkMobileError('');
    setSelectedCustomFields([]);
    setCustomFieldValues({});
    setShowCustomFieldsSelector(false);
    setToolConfigs({});
  };

  const handleBulkSubmit = async () => {
    if (bulkTools.length === 0 || !bulkActionMode) return;

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

    if (bulkActionMode === 'in') {
      for (const tool of notReturnedTools) {
        const config = toolConfigs[tool.id];
        if (config && config.status === 'pending') {
          if (!config.expectedDays || config.expectedDays <= 0) {
            toast.error(`Please enter a valid number of expected days for not-returned tool ${tool.qr_code}`);
            return;
          }
          if (!config.reason || !config.reason.trim()) {
            toast.error(`Please enter a reason for delay for not-returned tool ${tool.qr_code}`);
            return;
          }
        }
      }
    }

    let toolsToProcess = [...bulkTools];
    if (bulkActionMode === 'out') {
      if (bulkOutSubCategory === 'subcon_work' || bulkOutSubCategory === 'site_transfer') {
        toolsToProcess = bulkTools.filter((t) => t.status === 'usable');
        if (toolsToProcess.length === 0) {
          toast.error("No eligible working tools (usable) found in selection for this transfer.");
          return;
        }
      } else if (bulkOutSubCategory === 'scrap_disposal') {
        toolsToProcess = bulkTools.filter((t) => t.status === 'scrap' || t.status === 'scrapped');
        if (toolsToProcess.length === 0) {
          toast.error("No eligible scrap tools found in selection for scrap disposal.");
          return;
        }
      }
    }

    setBulkSubmitting(true);
    try {
      const updatedTools: any[] = [];

      let checklistStr = '';
      if (selectedCustomFields.length > 0) {
        const items = selectedCustomFields.map((field) => {
          const val = customFieldValues[field.name];
          let displayVal = '';
          if (val === undefined || val === null || val === '') {
            displayVal = 'Not Provided';
          } else if (typeof val === 'boolean') {
            displayVal = val ? 'Yes' : 'No';
          } else if (Array.isArray(val)) {
            displayVal = `[${val.join(', ')}]`;
          } else {
            displayVal = typeof val === 'string' && val.startsWith('/') ? val.split('/').pop() || val : String(val);
          }
          return `${field.name}: ${displayVal}`;
        });
        checklistStr = ` [Checklist: ${items.join(', ')}]`;
      }

      // 1. Process all selected tools (they are marked Received/Returned)
      for (const tool of toolsToProcess) {
        const payload: any = { previous_site: tool.current_site };

        if (bulkActionMode === 'in') {
          payload.status = 'usable';
          payload.current_site = storeLocation;
          payload.pending_return_date = null;
          payload.pending_reason = null;
          if (bulkInSubCategory === 'subcon_return') {
            payload.subcontractor_name = null;
            payload.subcontractor_code = null;
            payload.remarks = `Returned from Sub-Contractor. ${bulkFormData.remarks}${checklistStr}`;
          } else if (bulkInSubCategory === 'new_product') {
            const supplierInfo = bulkFormData.subcontractorName
              ? ` Supplier: ${bulkFormData.subcontractorName}${bulkFormData.subcontractorCode ? ' (' + bulkFormData.subcontractorCode + ')' : ''}.`
              : '';
            payload.remarks = `New Product Received.${supplierInfo} ${bulkFormData.remarks}${checklistStr}`;
          } else if (bulkInSubCategory === 'site_receive') {
            payload.remarks = `Received from Site ${tool.current_site}. ${bulkFormData.remarks}${checklistStr}`;
          } else if (bulkInSubCategory === 'found_recovered') {
            payload.debit_to = null;
            payload.subcontractor_name = null;
            payload.subcontractor_code = null;
            payload.remarks = `Tool Found/Recovered. Previous status: ${tool.status}. ${bulkFormData.remarks}${checklistStr}`;
          }
        } else {
          if (bulkOutSubCategory === 'subcon_work') {
            payload.current_site = bulkFormData.targetSite || tool.current_site;
            payload.subcontractor_name = bulkFormData.subcontractorName;
            payload.subcontractor_code = bulkFormData.subcontractorCode;
            payload.subcontractor_mobile = bulkFormData.subcontractorMobile;
            payload.remarks = `Issued to Sub-Contractor (Bulk). ${bulkFormData.remarks}${checklistStr}`;
          } else if (bulkOutSubCategory === 'site_transfer') {
            payload.current_site = bulkFormData.targetSite;
            payload.subcontractor_name = null;
            payload.subcontractor_code = null;
            payload.remarks = `Transferred to Site: ${bulkFormData.targetSite} (Bulk). ${bulkFormData.remarks}${checklistStr}`;
          } else if (bulkOutSubCategory === 'scrap_disposal') {
            payload.status = 'scrapped';
            payload.current_site = 'Scrap Yard';
            payload.subcontractor_name = bulkFormData.subcontractorName;
            payload.subcontractor_code = bulkFormData.subcontractorCode;
            payload.subcontractor_mobile = bulkFormData.subcontractorMobile;
            payload.debit_to = null;
            payload.remarks = `Sent to Scrap Dealer: ${bulkFormData.subcontractorName} (${bulkFormData.subcontractorCode}) (Bulk). ${bulkFormData.remarks}${checklistStr}`;
          }
        }

        await api.patch(`/tools/${tool.id}`, payload);
        updatedTools.push({ ...tool, ...payload });
      }

      // 2. Process not-returned tools that are explicitly configured as pending or missing
      if (bulkActionMode === 'in') {
        for (const tool of notReturnedTools) {
          const config = toolConfigs[tool.id];
          if (config && (config.status === 'pending' || config.status === 'missing')) {
            const payload: any = {};
            if (config.status === 'missing') {
              payload.status = 'missing';
              payload.pending_return_date = null;
              payload.pending_reason = null;
              payload.remarks = `Marked as Missing during receipt. ${bulkFormData.remarks}`;
            } else if (config.status === 'pending') {
              payload.status = 'pending';
              const days = config.expectedDays || 40;
              const returnDate = new Date();
              returnDate.setDate(returnDate.getDate() + days);
              payload.pending_return_date = returnDate.toISOString();
              payload.pending_reason = config.reason || 'Pending return';
              payload.remarks = `Marked as Pending return (${days} days: ${payload.pending_reason}). ${bulkFormData.remarks}`;
            }
            await api.patch(`/tools/${tool.id}`, payload);
          }
        }
      }

      toast.success(`Bulk ${bulkActionMode === 'in' ? 'Receipt' : 'Despatch'} recorded for ${toolsToProcess.length} item(s)`);

      const transactionDetails = bulkActionMode === 'in' ? bulkInSubCategory : bulkOutSubCategory;
      const pdfType = bulkActionMode === 'in' ? 'RECEIPT' : 'DESPATCH';
      const pdfRemarks = bulkFormData.remarks ? `${bulkFormData.remarks}${checklistStr}` : checklistStr.trim();
      const toolsToPrint = pdfType === 'RECEIPT'
        ? updatedTools.filter(t => t.status === 'usable')
        : updatedTools;
      if (toolsToPrint.length > 0) {
        generateBulkPDF(toolsToPrint, transactionDetails, pdfRemarks, pdfType);
      } else {
        toast.info("No received tools to print on the Receipt Challan");
      }

      cancelBulkTransaction();
    } catch (error) {
      console.error(error);
      toast.error("Failed to complete bulk transaction");
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Tools Movements</h1>
          <p className="text-gray-500 mt-1">
            Perform bulk Receipt (IN) / Despatch (OUT) transactions for {storeLocation || 'your site'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/tools-movement-history')}>
          <History className="w-4 h-4 mr-2" />
          View Movement History
        </Button>
      </div>

      {!bulkActionMode && (
        <Card>
          <CardContent className="p-8 text-center text-gray-400 flex flex-col items-center">
            <Truck className="w-12 h-12 text-gray-200 mb-2" />
            <p>Select tools from Store Inventory and choose Receipt (IN) or Despatch (OUT) to start a bulk transaction here.</p>
            <Button className="mt-4 bg-[#1E3A8A]" onClick={() => navigate('/store-inventory')}>
              Go to Store Inventory
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk Transaction Panel */}
      {bulkActionMode && bulkTools.length > 0 && (
        <Card className="border-l-4 border-l-[#1E3A8A] animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="bg-gray-50 pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              {bulkActionMode === 'in' ? <ArrowDownCircle className="text-green-600 w-5 h-5" /> : <ArrowUpCircle className="text-blue-600 w-5 h-5" />}
              Bulk {bulkActionMode === 'in' ? 'Receipt (IN)' : 'Despatch (OUT)'}
              <Badge variant="outline">{bulkTools.length} item{bulkTools.length === 1 ? '' : 's'}</Badge>
            </CardTitle>
            <CardDescription>
              This transaction will be applied to all {bulkTools.length} selected tools.
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

                {/* Returned Tools (Arrived) Section */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold text-[#0F172A]">Returned Tools (Arrived)</Label>
                  <p className="text-xs text-gray-500">
                    These are the selected tools that have returned to the store.
                  </p>
                  <div className="overflow-x-auto border rounded-lg bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Tool Details</th>
                          <th className="px-4 py-3 font-semibold">Current Site / Subcontractor</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkTools.map((tool) => (
                          <tr key={tool.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800 text-xs">{tool.description}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tool.qr_code}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">
                              <div>{tool.current_site || 'Store'}</div>
                              {tool.subcontractor_name && (
                                <div className="text-[10px] text-slate-400 mt-0.5">Subcon: {tool.subcontractor_name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                                Received (Arrived)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Not Returned Tools Section */}
                {notReturnedTools.length > 0 && (
                  <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col gap-1">
                      <Label className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                        Not Returned Tools (Pending or Missing)
                        <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 text-[10px]">
                          {notReturnedTools.length} Item{notReturnedTools.length === 1 ? '' : 's'}
                        </Badge>
                      </Label>
                      <p className="text-xs text-gray-500">
                        These are the other tools held by this subcontractor / site that were not selected. Specify whether they are Pending or Missing.
                      </p>
                    </div>
                    <div className="overflow-x-auto border rounded-lg bg-white">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Tool Details</th>
                            <th className="px-4 py-3 font-semibold">Current Site / Subcontractor</th>
                            <th className="px-4 py-3 font-semibold w-72">Action / Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {notReturnedTools.map((tool) => {
                            const config = toolConfigs[tool.id] || { status: 'unconfigured', expectedDays: 40, reason: '' };
                            return (
                              <tr key={tool.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-800 text-xs">{tool.description}</div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tool.qr_code}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-xs">
                                  <div>{tool.current_site || 'Store'}</div>
                                  {tool.subcontractor_name && (
                                    <div className="text-[10px] text-slate-400 mt-0.5">Subcon: {tool.subcontractor_name}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-2">
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setToolConfigs(prev => ({
                                          ...prev,
                                          [tool.id]: { ...prev[tool.id], status: 'unconfigured' }
                                        }))}
                                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                                          config.status === 'unconfigured'
                                            ? 'bg-slate-100 border-slate-350 text-slate-800 shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        Unchanged
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setToolConfigs(prev => ({
                                          ...prev,
                                          [tool.id]: { ...prev[tool.id], status: 'pending' }
                                        }))}
                                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                                          config.status === 'pending'
                                            ? 'bg-amber-550 border-amber-550 text-white shadow-sm shadow-amber-100'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-55'
                                        }`}
                                      >
                                        Pending
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setToolConfigs(prev => ({
                                          ...prev,
                                          [tool.id]: { ...prev[tool.id], status: 'missing' }
                                        }))}
                                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                                          config.status === 'missing'
                                            ? 'bg-red-650 border-red-650 text-white shadow-sm shadow-red-100'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        Missing
                                      </button>
                                    </div>

                                    {config.status === 'pending' && (
                                      <div className="space-y-1 bg-amber-50/50 p-2 rounded border border-amber-100/50 animate-in slide-in-from-top-1 duration-200">
                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[9px] font-bold text-amber-800 uppercase tracking-wider shrink-0 w-12">Days:</label>
                                          <Input
                                            type="number"
                                            min={1}
                                            placeholder="Days"
                                            value={config.expectedDays || ''}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value) || 0;
                                              setToolConfigs(prev => ({
                                                ...prev,
                                                [tool.id]: { ...prev[tool.id], expectedDays: val }
                                              }));
                                            }}
                                            className="h-6 text-[10px] py-0.5 px-1.5 border-amber-200 focus:border-amber-400 focus:ring-amber-400 bg-white"
                                          />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[9px] font-bold text-amber-800 uppercase tracking-wider shrink-0 w-12">Reason:</label>
                                          <Input
                                            placeholder="Reason for delay"
                                            value={config.reason || ''}
                                            onChange={(e) => setToolConfigs(prev => ({
                                              ...prev,
                                              [tool.id]: { ...prev[tool.id], reason: e.target.value }
                                            }))}
                                            className="h-6 text-[10px] py-0.5 px-1.5 border-amber-200 focus:border-amber-400 focus:ring-amber-400 bg-white"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {bulkActionMode === 'out' && (
              <div className="space-y-4 animate-in slide-in-from-right-2">
                <Label>Despatch Type</Label>
                <RadioGroup value={bulkOutSubCategory} onValueChange={setBulkOutSubCategory} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="subcon_work" id="bd1" />
                    <Label htmlFor="bd1" className="cursor-pointer">Issue to Sub-Contractor</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="site_transfer" id="bd2" />
                    <Label htmlFor="bd2" className="cursor-pointer">Transfer to Next Site</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-red-50 border-red-200">
                    <RadioGroupItem value="scrap_disposal" id="bd3" />
                    <Label htmlFor="bd3" className="cursor-pointer text-red-700">Issue to Scrap Dealer</Label>
                  </div>
                </RadioGroup>

                <p className="text-xs text-gray-500">
                  * Note: Despatches to Sub-Contractor / Site will automatically filter and only transfer <strong>usable (working condition)</strong> tools.
                </p>
                <p className="text-xs text-red-600">
                  * Note: Despatches to Scrap Dealer will automatically filter and only transfer <strong>scrap</strong> tools.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {bulkActionMode === 'out' && bulkOutSubCategory === 'subcon_work' && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Select Sub-Contractor (optional)</Label>
                    <select
                      defaultValue=""
                      onChange={(e) => applyBulkDealer(e.target.value)}
                      className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose from Dealers list --</option>
                      {dealersByCategory('sub_contractor').map((d) => (
                        <option key={d.id} value={d.id}>{d.company_name} ({d.dealer_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sub-Contractor Name</Label>
                    <Input
                      placeholder="Name"
                      value={bulkFormData.subcontractorName}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor Code</Label>
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
                  <div className="space-y-2 md:col-span-2">
                    <Label>Select Scrap Dealer (optional)</Label>
                    <select
                      defaultValue=""
                      onChange={(e) => applyBulkDealer(e.target.value)}
                      className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose from Dealers list --</option>
                      {dealersByCategory('scrap_dealer').map((d) => (
                        <option key={d.id} value={d.id}>{d.company_name} ({d.dealer_code})</option>
                      ))}
                    </select>
                  </div>
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

              {bulkActionMode === 'in' && bulkInSubCategory === 'new_product' && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Select Supplier (optional)</Label>
                    <select
                      defaultValue=""
                      onChange={(e) => applyBulkDealer(e.target.value)}
                      className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose from Dealers list --</option>
                      {dealersByCategory('supplier').map((d) => (
                        <option key={d.id} value={d.id}>{d.company_name} ({d.dealer_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier Name</Label>
                    <Input
                      placeholder="Name"
                      value={bulkFormData.subcontractorName}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier Code</Label>
                    <Input
                      placeholder="Code"
                      value={bulkFormData.subcontractorCode}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, subcontractorCode: e.target.value })}
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

              {/* Custom Fields Checklist Section */}
              <div className="space-y-4 md:col-span-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold text-[#0F172A]">Custom Checklist / Verification Fields</Label>
                    <p className="text-xs text-gray-500">Add dealer custom fields as verification checklists for this transaction</p>
                  </div>
                  {dealerCustomFields.length > 0 ? (
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomFieldsSelector(!showCustomFieldsSelector)}
                        className="bg-white border-[#1E3A8A] text-[#1E3A8A] hover:bg-blue-50"
                      >
                        + Add Custom Field
                      </Button>
                      
                      {showCustomFieldsSelector && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border rounded-md shadow-lg z-50 p-2 max-h-60 overflow-y-auto">
                          <div className="text-xs font-semibold text-gray-400 px-2 py-1 border-b">Select Field to Add</div>
                          {dealerCustomFields
                            .filter(field => !selectedCustomFields.some(selected => selected.id === field.id))
                            .map(field => (
                              <button
                                key={field.id}
                                type="button"
                                className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-700 block transition-colors"
                                onClick={() => {
                                  setSelectedCustomFields([...selectedCustomFields, field]);
                                  let initialVal: any = '';
                                  if (field.field_type === 'checkbox') initialVal = false;
                                  if (field.field_type === 'checkboxes') initialVal = [];
                                  setCustomFieldValues(prev => ({ ...prev, [field.name]: initialVal }));
                                  setShowCustomFieldsSelector(false);
                                }}
                              >
                                {field.name}
                              </button>
                            ))}
                          {dealerCustomFields.filter(field => !selectedCustomFields.some(selected => selected.id === field.id)).length === 0 && (
                            <div className="text-xs text-gray-500 p-2 text-center">No more fields to add</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No dealer custom fields defined</span>
                  )}
                </div>

                {selectedCustomFields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-dashed">
                    {selectedCustomFields.map((field) => {
                      const val = customFieldValues[field.name];
                      return (
                        <div key={field.id} className="flex flex-col bg-white p-3 rounded border shadow-sm space-y-2 relative">
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              {field.name}
                              <span className="text-[9px] text-slate-400 font-mono lowercase">({field.field_type})</span>
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => {
                                setSelectedCustomFields(selectedCustomFields.filter(f => f.id !== field.id));
                                setCustomFieldValues(prev => {
                                  const copy = { ...prev };
                                  delete copy[field.name];
                                  return copy;
                                });
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="pt-1">
                            {field.field_type === 'text' && (
                              <Input
                                placeholder={`Enter ${field.name}`}
                                value={val || ''}
                                onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                                className="h-9 text-xs"
                              />
                            )}

                            {field.field_type === 'number' && (
                              <Input
                                type="number"
                                placeholder={`Enter ${field.name}`}
                                value={val || ''}
                                onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                                className="h-9 text-xs"
                              />
                            )}

                            {field.field_type === 'checkbox' && (
                              <div className="flex items-center space-x-2 pt-1">
                                <input
                                  type="checkbox"
                                  id={`custom-toggle-${field.id}`}
                                  checked={!!val}
                                  onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.name]: e.target.checked }))}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                />
                                <Label
                                  htmlFor={`custom-toggle-${field.id}`}
                                  className="text-xs text-slate-500 select-none cursor-pointer"
                                >
                                  Toggle Yes / No ({val ? 'Yes' : 'No'})
                                </Label>
                              </div>
                            )}

                            {field.field_type === 'radio' && (
                              <div className="flex flex-wrap gap-4 pt-1">
                                {(field.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((opt) => (
                                  <label key={opt} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`custom-radio-${field.id}`}
                                      value={opt}
                                      checked={val === opt}
                                      onChange={() => setCustomFieldValues(prev => ({ ...prev, [field.name]: opt }))}
                                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {field.field_type === 'checkboxes' && (
                              <div className="flex flex-wrap gap-4 pt-1">
                                {(field.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((opt) => {
                                  const currentArray = Array.isArray(val) ? val : [];
                                  const isChecked = currentArray.includes(opt);
                                  return (
                                    <label key={opt} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          let nextArray;
                                          if (isChecked) {
                                            nextArray = currentArray.filter((item: string) => item !== opt);
                                          } else {
                                            nextArray = [...currentArray, opt];
                                          }
                                          setCustomFieldValues(prev => ({ ...prev, [field.name]: nextArray }));
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {field.field_type === 'file' && (
                              <div className="space-y-1.5 w-full">
                                {val ? (
                                  <div className="flex items-center justify-between bg-blue-50 border border-blue-150 p-2 rounded-lg text-xs">
                                    <span className="font-semibold text-blue-750 truncate max-w-[180px]">
                                      {val.split('/').pop()}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setCustomFieldValues(prev => {
                                        const copy = { ...prev };
                                        delete copy[field.name];
                                        return copy;
                                      })}
                                      className="h-6 px-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 text-[10px]"
                                    >
                                      Clear
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`custom-file-${field.id}`}
                                      type="file"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleCustomFileUpload(field.name, file);
                                      }}
                                      disabled={uploadingField === field.name}
                                      className="text-xs h-9 cursor-pointer"
                                    />
                                    {uploadingField === field.name && (
                                      <span className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full shrink-0"></span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed text-sm text-gray-400">
                    No custom fields added. Use the button above to add verification checklist items.
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button className="flex-1 bg-[#1E3A8A]" onClick={handleBulkSubmit} disabled={bulkSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {bulkSubmitting ? 'Processing...' : `Confirm Bulk ${bulkActionMode === 'in' ? 'Receipt' : 'Despatch'} (${bulkTools.length})`}
              </Button>
              <Button variant="outline" onClick={cancelBulkTransaction} disabled={bulkSubmitting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DeliveryChallanPreviewDialog
        open={!!challanDraft}
        onOpenChange={(o) => {
          if (!o) {
            setChallanDraft(null);
            navigate('/tools-movement-history');
          }
        }}
        initialOptions={challanDraft}
      />
    </div>
  );
};

export default ToolsMovements;
