import { useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from '../components/ui/badge';
import { QrCode, Upload, Calendar, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { mockTools, mockInspections } from '../types/tool';
import { toast } from 'sonner';
import { DatePicker } from '../components/ui/date-picker';
import api from '../services/api';
import ScannerDialog from '../components/ScannerDialog';

const InspectorView = () => {
  const [scannedTool, setScannedTool] = useState<any>(null);
  const [inspectionData, setInspectionData] = useState({
    result: 'pass',
    remarks: '',
    photos: '',
    inspectionDate: new Date(),
  });

  // ...
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      // Extract code if it's a URL
      let code = rawCode;
      if (rawCode.includes('/view-tool/')) {
        const parts = rawCode.split('/view-tool/');
        if (parts.length > 1) {
          code = parts[1];
        }
      }
      // ... continue logic

      toast.info(`Scanning: ${code}...`);
      const response = await api.get(`/tools/qr/${code}`);

      const tool = response.data;
      // Map backend fields to frontend interface if needed

      const mappedTool = {
        id: tool.id,
        description: tool.description,
        make: tool.make,
        capacity: tool.capacity,
        safeWorkingLoad: tool.safe_working_load,
        purchaserName: tool.purchaser_name,
        dateOfSupply: tool.date_of_supply,
        lastInspectionDate: tool.last_inspection_date,
        currentSite: tool.current_site,
        status: tool.status,
        qrCode: tool.qr_code
      };

      setScannedTool(mappedTool);
      toast.success('Tool found!');
    } catch (error) {
      console.error(error);
      toast.error('Tool not found or scan failed');
      setScannedTool(null);
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
    try {
      if (!scannedTool) return;

      const payload = {
        tool_id: scannedTool.id,
        date: inspectionData.inspectionDate,
        result: inspectionData.result,
        usability_percentage: null,
        remarks: inspectionData.remarks,
        photos: inspectionData.photos
      };

      await api.post('/inspections/', payload);

      toast.success('Inspection saved successfully');

      // Refresh tool data to show updated status
      if (scannedTool.qrCode) {
        handleScan(scannedTool.qrCode);
      }

      // Reset form but keep tool view? Or reset everything?
      // Usually better to keep tool view to see the new status.
      // Reset form but keep tool view? Or reset everything?
      // Usually better to keep tool view to see the new status.
      setInspectionData({ result: 'pass', remarks: '', photos: '', inspectionDate: new Date() });

    } catch (error) {
      console.error(error);
      toast.error('Failed to save inspection');
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-[#16A34A]" />;
      case 'conditional':
        return <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-[#DC2626]" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Inspection Workflow</h1>
        <p className="text-gray-500 mt-1">Scan tool and complete inspection</p>
      </div>

      {/* QR Scanner */}
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

      {scannedTool && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Tool Summary */}
          <Card className="border-2 border-[#1E3A8A]">
            <CardHeader className="bg-[#1E3A8A] text-white">
              <CardTitle>Tool Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Tool ID</p>
                  <p className="font-mono font-medium">{scannedTool.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Description</p>
                  <p className="font-medium">{scannedTool.description}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Make / Capacity</p>
                  <p className="font-medium">{scannedTool.make || '-'} / {scannedTool.capacity || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Safe Working Load</p>
                  <p className="font-medium">{scannedTool.safeWorkingLoad || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-400">Current Site</p>
                  <p className="font-medium">{scannedTool.currentSite || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                      remarks: value === 'fail' ? 'Scrapped' : ''
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
              >
                Save Inspection
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default InspectorView;