import { useState, useRef } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { QrCode, CheckCircle, XCircle, Slash, Camera } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import ScannerDialog from '../components/ScannerDialog';

const WorkerView = () => {
  const [scannedTool, setScannedTool] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setScanning(true);

    // Html5Qrcode requires a DOM element ID, even if hidden for file scanning
    const html5QrCode = new Html5Qrcode("reader-hidden");

    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      handleScan(decodedText);
    } catch (err) {
      console.error("Error scanning file", err);
      toast.error("Could not read QR code from image");
    } finally {
      setScanning(false);
      // It's good practice to clear the scanner instance after use
      html5QrCode.clear();
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handleScan = async (rawCode: string) => {
    if (!rawCode) return;
    setScanning(true);
    try {
      // Extract code if URL
      let code = rawCode;
      if (rawCode.includes('/view-tool/')) {
        const parts = rawCode.split('/view-tool/');
        if (parts.length > 1) {
          code = parts[1];
        }
      }

      const response = await api.get(`/tools/qr/${code}`);
      const tool = response.data;

      // Map to display format
      setScannedTool({
        id: tool.id,
        description: tool.description,
        make: tool.make,
        capacity: tool.capacity,
        safeWorkingLoad: tool.safe_working_load,
        status: tool.status,
        usabilityPercentage: tool.usability_percentage,
        qrCode: tool.qr_code,
        purchaserName: tool.purchaser_name,
        dateOfSupply: tool.date_of_supply,
        lastInspectionDate: tool.last_inspection_date,
        expiryDate: tool.expiry_date,
        validityPeriod: tool.validity_period,
        subcontractorName: tool.subcontractor_name,
        currentSite: tool.current_site
      });
      toast.success("Tool scanned successfully");

    } catch (error) {
      console.error(error);
      toast.error("Tool not found or invalid QR");
      setScannedTool(null);
    } finally {
      setScanning(false);
    }
  };

  const simulateScan = () => {
    // For demo button, just hint to use manual input or provide a default
    const input = document.getElementById('worker-qr-input') as HTMLInputElement;
    if (input && input.value) {
      handleScan(input.value);
    } else {
      // Try a default valid seed if empty
      handleScan('TOOL-SEED-001');
    }
  };

  const resetScan = () => {
    setScannedTool(null);
  };

  const isSafe = scannedTool?.status === 'usable';

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {!scannedTool ? (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center space-y-8">
                <h1 className="text-4xl font-semibold text-[#0F172A] text-center">
                  Tool Safety Check
                </h1>

                {/* Hidden div for html5-qrcode logic if needed */}
                <div id="reader-hidden" className="hidden"></div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="w-full max-w-sm mx-auto">
                  <div className="text-center space-y-6">
                    <div className="w-64 h-64 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center mx-auto bg-gray-50">
                      {scanning ? (
                        <div className="w-16 h-16 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <QrCode className="w-32 h-32 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xl text-gray-600">Scan Tool QR Code</p>
                    <ScannerDialog 
                      onScan={handleScan} 
                      buttonText="Live Camera Scanner"
                      triggerClassName="w-full text-lg py-6 bg-[#16A34A] hover:bg-[#16A34A]/90"
                    />
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full text-lg py-6 border-dashed border-2"
                      onClick={triggerCamera}
                      disabled={scanning}
                    >
                      <Camera className="w-6 h-6 mr-2" />
                      Upload QR Image
                    </Button>
                  </div>

                  <div className="mt-8 flex w-full items-center space-x-2">
                    <Input
                      id="worker-qr-input"
                      placeholder="Or enter code manually"
                    />
                    <Button onClick={() => {
                      const input = document.getElementById('worker-qr-input') as HTMLInputElement;
                      if (input) handleScan(input.value);
                    }}>CHECK</Button>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        ) : (
          <div
            className={`rounded-2xl p-12 text-center space-y-8 ${isSafe ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
              }`}
          >
            {isSafe ? (
              <CheckCircle className="w-32 h-32 text-white mx-auto animate-bounce" />
            ) : (
              <XCircle className="w-32 h-32 text-white mx-auto animate-pulse" />
            )}

            <div className="text-white space-y-4">
              <h1 className="text-5xl font-bold">
                {isSafe ? 'SAFE TO USE' : 'DO NOT USE'}
              </h1>
              <p className="text-2xl opacity-90">
                {isSafe ? 'Tool is in good condition' : 'Tool is not safe for operation'}
              </p>
            </div>



            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-12 py-6"
              onClick={resetScan}
            >
              Scan Another Tool
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerView;
