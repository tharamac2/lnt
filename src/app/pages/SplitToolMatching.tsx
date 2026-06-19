import { useState, useRef } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { QrCode, CheckCircle, XCircle, ArrowRight, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../services/api';
import { toast } from 'sonner';

const SplitToolMatching = () => {
  const [step, setStep] = useState(1);
  const [partA, setPartA] = useState('');
  const [partB, setPartB] = useState('');
  const [partADetails, setPartADetails] = useState<any>(null); // Store full details
  const [partBDesc, setPartBDesc] = useState('');
  const [partAStatus, setPartAStatus] = useState<'usable' | 'scrap'>('usable');
  const [partBStatus, setPartBStatus] = useState<'usable' | 'scrap'>('usable');

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<'match' | 'mismatch' | 'mixed_status' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeScan, setActiveScan] = useState<'A' | 'B' | null>(null);

  const triggerCamera = (part: 'A' | 'B') => {
    setActiveScan(part);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setScanning(true);

    const html5QrCode = new Html5Qrcode("reader-hidden-split");

    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      handleScan(decodedText);
    } catch (err) {
      console.error("Error scanning file", err);
      toast.error("Could not read QR code");
    } finally {
      setScanning(false);
      html5QrCode.clear();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleScan = async (rawCode: string) => {
    try {
      // Clean up code URL if needed
      let code = rawCode;
      if (rawCode.includes('/view-tool/')) {
        code = rawCode.split('/view-tool/')[1];
      }

      const response = await api.get(`/tools/qr/${code}`);
      const tool = response.data;

      if (activeScan === 'A') {
        setPartA(tool.qr_code);
        setPartADetails(tool); // Save full object
        setPartAStatus(tool.status || 'usable');
        setStep(2);
        toast.success("Part A Scanned");
      } else if (activeScan === 'B') {
        setPartB(tool.qr_code);
        setPartBDesc(tool.description);
        setPartBStatus(tool.status || 'usable');

        // Check if either part is a Derrick Pole
        const isDerrickPole = (desc: string) => {
          const d = (desc || '').toLowerCase().trim();
          return (d.includes('derrick') && d.includes('pole')) || (d.includes('dirreck') && d.includes('pole'));
        };

        const isDerrickA = isDerrickPole(partADetails.description);
        const isDerrickB = isDerrickPole(tool.description);

        if (isDerrickA || isDerrickB) {
          if (isDerrickA !== isDerrickB) {
            // One is a Derrick Pole and the other is not
            setResult('mismatch');
          } else {
            // Both are Derrick Poles
            const matchLocation = (partADetails.current_site || '').toLowerCase() === (tool.current_site || '').toLowerCase();
            if (!matchLocation) {
              setResult('mismatch');
            } else {
              try {
                // Fetch all tools in the same upload batch as Part A to find the total N of Derrick Poles
                const batchToolsRes = await api.get(`/tools/public/batch/${partA}`);
                const batchTools = batchToolsRes.data;

                // Filter for Derrick Poles
                const derrickPoles = batchTools.filter((t: any) => isDerrickPole(t.description));

                // Extract sequence number suffix from QR code
                const getQrSuffix = (qr: string) => {
                  const match = qr.match(/\d+$/);
                  return match ? parseInt(match[0], 10) : 0;
                };

                // Sort ascending by sequence suffix
                derrickPoles.sort((x: any, y: any) => getQrSuffix(x.qr_code) - getQrSuffix(y.qr_code));

                // Find 0-based indexes in the sorted list
                const idxA = derrickPoles.findIndex((t: any) => t.qr_code === partA);
                const idxB = derrickPoles.findIndex((t: any) => t.qr_code === tool.qr_code);

                if (idxA === -1 || idxB === -1) {
                  setResult('mismatch');
                } else {
                  const N = derrickPoles.length;
                  const half = Math.floor(N / 2);
                  const isPairMatch = Math.abs(idxA - idxB) === half && half > 0;

                  if (!isPairMatch) {
                    setResult('mismatch');
                  } else {
                    // Match found, check usability status
                    const isAMatchStatus = partAStatus === 'usable';
                    const isBMatchStatus = (tool.status || 'usable') === 'usable';

                    if (isAMatchStatus && isBMatchStatus) {
                      setResult('match');
                    } else {
                      setResult('mismatch');
                    }
                  }
                }
              } catch (err) {
                console.error("Error verifying Derrick Pole pairs", err);
                setResult('mismatch');
              }
            }
          }
        } else {
          // Default matching logic for non-Derrick Pole tools
          const matchDesc = partADetails.description.toLowerCase() === tool.description.toLowerCase();
          const matchLocation = (partADetails.current_site || '').toLowerCase() === (tool.current_site || '').toLowerCase();
          const isMatch = matchDesc && matchLocation;

          if (!isMatch) {
            setResult('mismatch');
          } else {
            const isAMatchStatus = partAStatus === 'usable';
            const isBMatchStatus = (tool.status || 'usable') === 'usable';

            if (isAMatchStatus && isBMatchStatus) {
              setResult('match');
            } else {
              setResult('mismatch');
            }
          }
        }
      }

    } catch (error) {
      console.error(error);
      toast.error("Invalid QR or Tool not found");
    }
  };

  const reset = () => {
    setStep(1);
    setPartA('');
    setPartB('');
    setPartADetails(null);
    setPartBDesc('');
    setPartAStatus('usable');
    setPartBStatus('usable');
    setResult(null);
    setActiveScan(null);
  };

  if (result) {
    const isMatch = result === 'match';
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        {/* Hidden div for scanner */}
        <div id="reader-hidden-split" className="hidden"></div>

        <div
          className={`max-w-2xl w-full rounded-2xl p-12 text-center space-y-8 ${
            isMatch ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
          }`}
        >
          {isMatch ? (
            <CheckCircle className="w-32 h-32 text-white mx-auto animate-bounce" />
          ) : (
            <XCircle className="w-32 h-32 text-white mx-auto animate-pulse" />
          )}

          <div className="text-white space-y-4">
            <h1 className="text-5xl font-bold">
              {isMatch ? 'SAFE TO USE' : 'MISMATCH'}
            </h1>
            <p className="text-2xl opacity-90">
              {isMatch ? 'Tool is in good condition' : 'Tool is not matchable'}
            </p>
          </div>

          <Button
            size="lg"
            variant="secondary"
            className="text-lg px-12 py-6"
            onClick={reset}
          >
            Scan Another Tool
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Hidden div for scanner */}
        <div id="reader-hidden-split" className="hidden"></div>
        {/* Hidden File Input */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-[#0F172A] mb-2">Split Tool Matching</h1>
          <p className="text-lg text-gray-500">Scan two parts to verify they belong together</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Part A */}
          <Card className={step >= 1 ? 'border-2 border-[#1E3A8A]' : 'opacity-50'}>
            <CardContent className="py-12">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-24 h-24 bg-[#1E3A8A] rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  A
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Part A</h2>
                  {partA && (
                    <div className="space-y-1">
                      <p className="text-lg font-medium capitalize">{partADetails?.description}</p>
                      <p className="font-mono text-sm text-[#16A34A]">{partA}</p>
                    </div>
                  )}
                </div>
                {step === 1 && (
                  <div className={`w-48 h-48 border-4 border-dashed rounded-lg flex items-center justify-center ${scanning ? 'border-[#1E3A8A] animate-pulse' : 'border-gray-300'
                    }`}>
                    {scanning ? (
                      <div className="w-16 h-16 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <QrCode className="w-20 h-20 text-gray-400" />
                    )}
                  </div>
                )}
                {step === 1 && (
                  <Button
                    className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                    onClick={() => triggerCamera('A')}
                    disabled={scanning}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {scanning ? 'Scanning...' : 'Scan with Google Lens'}
                  </Button>
                )}
                {step >= 2 && (
                  <div className="flex items-center gap-2 text-[#16A34A]">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">Scanned</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Arrow */}
          <div className="hidden md:flex justify-center">
            <ArrowRight className={`w-12 h-12 ${step >= 2 ? 'text-[#1E3A8A]' : 'text-gray-300'}`} />
          </div>

          {/* Part B */}
          <Card className={step >= 2 ? 'border-2 border-[#1E3A8A]' : 'opacity-50'}>
            <CardContent className="py-12">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-24 h-24 bg-[#1E3A8A] rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  B
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Part B</h2>
                  {partB && (
                    <div className="space-y-1">
                      <p className="text-lg font-medium capitalize">{partBDesc}</p>
                      <p className="font-mono text-sm text-[#16A34A]">{partB}</p>
                    </div>
                  )}
                </div>
                {step === 2 && (
                  <div className={`w-48 h-48 border-4 border-dashed rounded-lg flex items-center justify-center ${scanning ? 'border-[#1E3A8A] animate-pulse' : 'border-gray-300'
                    }`}>
                    {scanning ? (
                      <div className="w-16 h-16 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <QrCode className="w-20 h-20 text-gray-400" />
                    )}
                  </div>
                )}
                {step === 2 && (
                  <Button
                    className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                    onClick={() => triggerCamera('B')}
                    disabled={scanning}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {scanning ? 'Scanning...' : 'Scan with Google Lens'}
                  </Button>
                )}
                {step < 2 && (
                  <p className="text-gray-400 text-center">Scan Part A first</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {step >= 1 && !result && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={reset}>
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitToolMatching;
