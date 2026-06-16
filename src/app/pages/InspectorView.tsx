import { useState, useRef, useEffect, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { QrCode, Upload, CheckCircle, XCircle, UserPlus, ShieldCheck, Clock, Search, X, Package, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker } from '../components/ui/date-picker';
import api from '../services/api';
import ScannerDialog from '../components/ScannerDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const InspectorView = () => {
  const [inspectionData, setInspectionData] = useState({
    result: 'pass',
    remarks: '',
    photos: '',
    inspectionDate: new Date(),
  });

  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Employee profile / verification
  const [employeeRecords, setEmployeeRecords] = useState<any[]>([]);

  // Site tool inventory + bulk selection
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserSite, setCurrentUserSite] = useState<string | null>(null);
  const [siteTools, setSiteTools] = useState<any[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<Set<number>>(new Set());
  const lastSelectedIndexRef = useRef<number>(-1);

  const fetchEmployeeRecords = async () => {
    try {
      const res = await api.get('/inspectors/me');
      setEmployeeRecords(res.data);
    } catch (error) {
      console.error('Failed to fetch employee profile', error);
    }
  };

  useEffect(() => {
    fetchEmployeeRecords();
    const fetchCurrentUser = async () => {
      try {
        const res = await api.get('/users/me');
        setCurrentUserRole(res.data.role || null);
        setCurrentUserSite(res.data.site || null);
      } catch (error) {
        console.error('Failed to fetch current user', error);
      }
    };
    fetchCurrentUser();
  }, []);

  const verifiedEmployee = employeeRecords.find((e) => e.status === 'verified');
  const latestEmployee = employeeRecords[0];

  // Inspector (manager) accounts can always view site tool data.
  // Inspection Employee accounts can only view tool data once admin-verified.
  const canViewTools = currentUserRole === 'inspector' || !!verifiedEmployee;

  const fetchSiteTools = async () => {
    if (!currentUserSite) return;
    setLoadingTools(true);
    try {
      const res = await api.get(`/tools/?site=${encodeURIComponent(currentUserSite)}&limit=10000000`);
      setSiteTools(res.data);
    } catch (error) {
      console.error('Failed to fetch site tools', error);
    } finally {
      setLoadingTools(false);
    }
  };

  useEffect(() => {
    if (canViewTools && currentUserSite) {
      fetchSiteTools();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewTools, currentUserSite]);

  const filteredSiteTools = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    if (!query) return siteTools;
    return siteTools.filter((tool) => (
      (tool.description || '').toLowerCase().includes(query) ||
      (tool.qr_code || '').toLowerCase().includes(query) ||
      (tool.make || '').toLowerCase().includes(query)
    ));
  }, [siteTools, inventorySearch]);

  const allFilteredSelected = filteredSiteTools.length > 0 &&
    filteredSiteTools.every((tool) => selectedToolIds.has(tool.id));

  const toggleToolSelection = (toolId: number, shiftKey: boolean = false) => {
    const currentIndex = filteredSiteTools.findIndex((t) => t.id === toolId);
    if (shiftKey && lastSelectedIndexRef.current >= 0) {
      const start = Math.min(lastSelectedIndexRef.current, currentIndex);
      const end = Math.max(lastSelectedIndexRef.current, currentIndex);
      setSelectedToolIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(filteredSiteTools[i].id);
        return next;
      });
    } else {
      setSelectedToolIds((prev) => {
        const next = new Set(prev);
        if (next.has(toolId)) next.delete(toolId); else next.add(toolId);
        return next;
      });
    }
    lastSelectedIndexRef.current = currentIndex;
  };

  const toggleSelectAll = () => {
    setSelectedToolIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredSiteTools.forEach((tool) => next.delete(tool.id));
        return next;
      }
      const next = new Set(prev);
      filteredSiteTools.forEach((tool) => next.add(tool.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedToolIds(new Set());

  const selectedTools = useMemo(
    () => siteTools.filter((tool) => selectedToolIds.has(tool.id)),
    [siteTools, selectedToolIds]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setScanning(true);

    const html5QrCode = new Html5Qrcode("reader-hidden-inspector");

    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      handleScan(decodedText);
    } catch (err) {
      console.error("Error scanning file", err);
      toast.error("Could not read QR code from image");
    } finally {
      setScanning(false);
      html5QrCode.clear();
    }
  };

  const triggerScan = () => {
    fileInputRef.current?.click();
  };

  const handleScan = async (rawCode: string) => {
    if (!canViewTools) {
      toast.error('Your employee profile must be verified by an admin before you can inspect tools.');
      return;
    }

    try {
      // Extract code if it's a URL
      let code = rawCode;
      if (rawCode.includes('/view-tool/')) {
        const parts = rawCode.split('/view-tool/');
        if (parts.length > 1) {
          code = parts[1];
        }
      }

      toast.info(`Scanning: ${code}...`);
      const response = await api.get(`/tools/qr/${code}`);
      const tool = response.data;

      // Merge into the site tool list (if not already present) and select it
      setSiteTools((prev) => (prev.some((t) => t.id === tool.id) ? prev : [tool, ...prev]));
      setSelectedToolIds((prev) => new Set(prev).add(tool.id));

      toast.success('Tool found and selected for inspection!');
    } catch (error) {
      console.error(error);
      toast.error('Tool not found or scan failed');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setInspectionData(prev => ({ ...prev, photos: response.data.url }));
        toast.success("Photo uploaded successfully");
      } catch (error) {
        console.error("Upload failed", error);
        toast.error("Failed to upload photo");
      }
    }
  };

  const handleSubmit = async () => {
    if (selectedTools.length === 0) return;

    if (!verifiedEmployee) {
      toast.error('Your employee profile must be verified by an admin before you can submit inspections.');
      return;
    }

    if (!inspectionData.remarks) {
      toast.error('Please select a remark before saving');
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(selectedTools.map((tool) => api.post('/inspections/', {
        tool_id: tool.id,
        date: inspectionData.inspectionDate,
        result: inspectionData.result,
        usability_percentage: null,
        remarks: inspectionData.remarks,
        photos: inspectionData.photos,
      })));

      toast.success(`Inspection saved for ${selectedTools.length} tool${selectedTools.length > 1 ? 's' : ''}`);

      clearSelection();
      setInspectionData({ result: 'pass', remarks: '', photos: '', inspectionDate: new Date() });
      fetchSiteTools();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save inspection');
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Inspection Workflow</h1>
        <p className="text-gray-500 mt-1">Scan tool and complete inspection</p>
      </div>

      {latestEmployee && (
        verifiedEmployee ? (
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-200 bg-green-50 text-green-700 text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Employee profile verified: {verifiedEmployee.name} ({verifiedEmployee.employee_id})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-sm">
            <Clock className="w-4 h-4" />
            <span>Employee profile pending admin verification: {latestEmployee.name} ({latestEmployee.employee_id}). You cannot submit inspections until verified.</span>
          </div>
        )
      )}

      {!latestEmployee && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-sm">
          <UserPlus className="w-4 h-4" />
          <span>Add your employee details and wait for admin verification before you can submit inspections.</span>
        </div>
      )}

      {/* QR Scanner */}
      {canViewTools && (
      <Card>
        <CardHeader>
          <CardTitle>Scan Tool QR Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-48 h-48 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <QrCode className="w-24 h-24 text-gray-400" />
            </div>

            <div className="flex w-full max-w-sm items-center space-x-2">
              <Input
                placeholder="Enter QR Code manually"
                id="manual-qr"
              />
              <Button
                onClick={() => {
                  const input = document.getElementById('manual-qr') as HTMLInputElement;
                  if (input && input.value) {
                    handleScan(input.value);
                  } else {
                    handleScan('TOOL-SEED-001');
                  }
                }}
                className="bg-[#1E3A8A]"
              >
                Scan / Search
              </Button>
            </div>

            <div className="flex flex-col items-center w-full max-w-sm pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">-- OR --</p>
              <div id="reader-hidden-inspector" className="hidden"></div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <ScannerDialog
                onScan={handleScan}
                buttonText="Live Camera Scanner"
                triggerClassName="w-full mb-2 bg-green-600 hover:bg-green-700 text-white"
              />
              <Button
                variant="outline"
                onClick={triggerScan}
                className="w-full border-dashed border-2 border-gray-400 text-gray-700 hover:bg-gray-50"
                disabled={scanning}
              >
                {scanning ? "Scanning Image..." : "📷 Upload QR Image"}
              </Button>
            </div>

            <p className="text-xs text-gray-400">Try: TOOL-SEED-001</p>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Site Tool Inventory - bulk selection */}
      {canViewTools && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-500">
          <CardHeader className="bg-gray-50 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Package className="text-[#1E3A8A] w-5 h-5" />
                {currentUserSite || 'Site'} Tools
              </CardTitle>
              <CardDescription>Select one or more tools to inspect</CardDescription>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
              {filteredSiteTools.length} of {siteTools.length} {siteTools.length === 1 ? 'Item' : 'Items'}
            </Badge>
          </CardHeader>

          {siteTools.length > 0 && (
            <div className="p-3 border-b border-gray-100 bg-white">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by description, QR code or make..."
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
            </div>
          )}

          {selectedToolIds.size > 0 && (
            <div className="sticky top-16 z-20 px-3 py-2 border-b border-blue-100 bg-blue-50 flex items-center justify-between gap-2 flex-wrap shadow-sm">
              <span className="text-sm text-blue-800 font-medium">
                {selectedToolIds.size} tool{selectedToolIds.size === 1 ? '' : 's'} selected
              </span>
              <Button size="sm" variant="ghost" className="h-8 text-gray-500" onClick={clearSelection}>
                <X className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            </div>
          )}

          <CardContent className="p-0">
            {loadingTools ? (
              <div className="p-8 text-center text-gray-400">Loading tools...</div>
            ) : siteTools.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <Package className="w-12 h-12 text-gray-200 mb-2" />
                <p>No tools found at this site.</p>
              </div>
            ) : filteredSiteTools.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <Search className="w-12 h-12 text-gray-200 mb-2" />
                <p>No tools match your search.</p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-x-auto overflow-y-auto [&>div]:overflow-visible">
                <Table className="border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 border-b border-gray-100 z-10 shadow-sm [&_th]:bg-white">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Make / Capacity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSiteTools.map((tool) => (
                      <TableRow
                        key={tool.id}
                        className="hover:bg-blue-50/20 cursor-pointer"
                        onClick={(e) => toggleToolSelection(tool.id, e.shiftKey)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedToolIds.has(tool.id)}
                            onCheckedChange={() => {
                              const nativeEvent = window.event as MouseEvent | undefined;
                              toggleToolSelection(tool.id, nativeEvent?.shiftKey ?? false);
                            }}
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewTools && selectedTools.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Tool Summary */}
          {selectedTools.length === 1 ? (
            <Card className="border-2 border-[#1E3A8A]">
              <CardHeader className="bg-[#1E3A8A] text-white">
                <CardTitle>Tool Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Tool ID</p>
                    <p className="font-mono font-medium">{selectedTools[0].id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Description</p>
                    <p className="font-medium">{selectedTools[0].description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Make / Capacity</p>
                    <p className="font-medium">{selectedTools[0].make || '-'} / {selectedTools[0].capacity || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Safe Working Load</p>
                    <p className="font-medium">{selectedTools[0].safe_working_load || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-400">Current Site</p>
                    <p className="font-medium">{selectedTools[0].current_site || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-[#1E3A8A]">
              <CardHeader className="bg-[#1E3A8A] text-white">
                <CardTitle>Bulk Inspection - {selectedTools.length} Tools Selected</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-1 max-h-40 overflow-auto">
                  {selectedTools.map((tool) => (
                    <li key={tool.id} className="text-sm text-gray-600 flex items-center justify-between">
                      <span className="font-medium text-[#1E3A8A]">{tool.description}</span>
                      <Badge variant="outline" className="text-[10px] text-gray-500">{tool.qr_code}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Inspection Form */}
          <Card>
            <CardHeader>
              <CardTitle>Inspection Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Inspection Date <span className="text-red-600">*</span></Label>
                <DatePicker
                  date={inspectionData.inspectionDate}
                  onDateChange={(date) => setInspectionData({ ...inspectionData, inspectionDate: date || new Date() })}
                />
              </div>

              <div className="space-y-3">
                <Label>Inspection Result</Label>
                <RadioGroup
                  value={inspectionData.result}
                  onValueChange={(value) => {
                    setInspectionData(prev => ({
                      ...prev,
                      result: value,
                      remarks: value === 'fail' ? 'Scrapped' : value === 'repair' ? 'Sent for repair' : ''
                    }));
                  }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pass" id="pass" />
                      <Label htmlFor="pass" className="font-normal cursor-pointer flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-[#16A34A]" />
                        Pass
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="repair" id="repair" />
                      <Label htmlFor="repair" className="font-normal cursor-pointer flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-amber-600" />
                        Repair
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fail" id="fail" />
                      <Label htmlFor="fail" className="font-normal cursor-pointer flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-[#DC2626]" />
                        Fail
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks <span className="text-red-600">*</span></Label>
                <Select
                  value={inspectionData.remarks}
                  onValueChange={(value) => setInspectionData({ ...inspectionData, remarks: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a remark" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tool is in good working condition">Tool is in good working condition</SelectItem>
                    <SelectItem value="Minor wear and tear, safe to use">Minor wear and tear, safe to use</SelectItem>
                    <SelectItem value="Requires cleaning/maintenance">Requires cleaning/maintenance</SelectItem>
                    <SelectItem value="Damaged, unsafe for use">Damaged, unsafe for use</SelectItem>
                    <SelectItem value="Sent for repair">Sent for repair</SelectItem>
                    {inspectionData.result !== 'pass' && (
                      <SelectItem value="Scrapped">Scrapped</SelectItem>
                    )}
                    <SelectItem value="Other">Other (See Notes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Photo Upload</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${inspectionData.photos ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {inspectionData.photos ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
                      <p className="text-green-700 font-medium">Photo Uploaded Successfully</p>
                      <p className="text-xs text-green-600 mt-1">Click to replace photo</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-12 h-12 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 mb-2">Click to upload photo evidence</p>
                      <p className="text-xs text-gray-400">JPG, PNG up to 10MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="photo-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </div>
              </div>

              <Button
                className="w-full bg-[#16A34A] hover:bg-[#16A34A]/90 h-12 text-lg"
                onClick={handleSubmit}
                disabled={!verifiedEmployee || submitting}
                title={!verifiedEmployee ? 'Your employee profile must be verified by an admin before you can submit inspections.' : undefined}
              >
                {submitting
                  ? 'Saving...'
                  : selectedTools.length > 1
                    ? `Save Inspection for ${selectedTools.length} Tools`
                    : 'Save Inspection'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default InspectorView;
