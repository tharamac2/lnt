import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { ArrowDownCircle, ArrowUpCircle, History, Save, Truck } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { generateDeliveryChallanPDF } from '../utils/deliveryChallan';

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

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await api.get('/users/me');
        setStoreLocation(userRes.data.site || '');
      } catch (err) {
        console.error("Failed to fetch user site", err);
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

  // Sub-Contractor Return is only valid for tools currently dispatched to a sub-contractor
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

  const generateBulkPDF = (tools: any[], transactionDetails: string, remarks: string, type: 'RECEIPT' | 'DISPATCH') => {
    let consignee = storeLocation;
    let siteCode: string | undefined;

    if (type === 'DISPATCH') {
      if (transactionDetails === 'subcon_work') {
        consignee = bulkFormData.subcontractorName || 'Sub-Contractor';
        siteCode = bulkFormData.subcontractorCode || undefined;
      } else if (transactionDetails === 'site_transfer') {
        consignee = bulkFormData.targetSite || 'Site';
      } else if (transactionDetails === 'scrap_disposal') {
        consignee = bulkFormData.subcontractorName || 'Scrap Dealer';
        siteCode = bulkFormData.subcontractorCode || undefined;
      }
    }

    generateDeliveryChallanPDF({
      type,
      consignee,
      siteCode,
      remarks,
      items: tools.map((tool) => ({
        description: tool.description,
        qrCode: tool.qr_code,
        quantity: '1',
        unit: 'NOS',
      })),
      filename: `Bulk_${type === 'RECEIPT' ? 'Inward' : 'Outward'}_Challan_${Date.now()}.pdf`,
    })
      .then(() => toast.success(`${type === 'RECEIPT' ? 'Inward' : 'Outward'} Challan Downloaded`))
      .catch((pdfError) => {
        console.error("PDF Generation failed", pdfError);
        toast.error("Failed to generate PDF");
      });
  };

  const cancelBulkTransaction = () => {
    setBulkActionMode(null);
    setBulkTools([]);
    setBulkFormData({ subcontractorName: '', subcontractorCode: '', subcontractorMobile: '', targetSite: '', remarks: '' });
    setBulkMobileError('');
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

      for (const tool of toolsToProcess) {
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

      toast.success(`Bulk ${bulkActionMode === 'in' ? 'Receipt' : 'Dispatch'} recorded for ${toolsToProcess.length} item(s)`);

      const transactionDetails = bulkActionMode === 'in' ? bulkInSubCategory : bulkOutSubCategory;
      const pdfType = bulkActionMode === 'in' ? 'RECEIPT' : 'DISPATCH';
      setTimeout(() => {
        generateBulkPDF(updatedTools, transactionDetails, bulkFormData.remarks, pdfType);
      }, 500);

      cancelBulkTransaction();
      navigate('/tools-movement-history');
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
            Perform bulk Receipt (IN) / Dispatch (OUT) transactions for {storeLocation || 'your site'}
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
            <p>Select tools from Store Inventory and choose Receipt (IN) or Dispatch (OUT) to start a bulk transaction here.</p>
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
              Bulk {bulkActionMode === 'in' ? 'Receipt (IN)' : 'Dispatch (OUT)'}
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
              </div>
            )}

            {bulkActionMode === 'out' && (
              <div className="space-y-4 animate-in slide-in-from-right-2">
                <Label>Dispatch Type</Label>
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
                  * Note: Dispatches to Sub-Contractor / Site will automatically filter and only transfer <strong>usable (working condition)</strong> tools.
                </p>
                <p className="text-xs text-red-600">
                  * Note: Dispatches to Scrap Dealer will automatically filter and only transfer <strong>scrap</strong> tools.
                </p>
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
                {bulkSubmitting ? 'Processing...' : `Confirm Bulk ${bulkActionMode === 'in' ? 'Receipt' : 'Dispatch'} (${bulkTools.length})`}
              </Button>
              <Button variant="outline" onClick={cancelBulkTransaction} disabled={bulkSubmitting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ToolsMovements;
