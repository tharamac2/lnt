import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeConfigs } from 'html5-qrcode';
import { Button } from './ui/button';
import { Camera } from 'lucide-react';

interface LiveScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
  fps?: number;
  qrbox?: number;
}

const LiveScanner: React.FC<LiveScannerProps> = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
}) => {
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    qrCodeRef.current = new Html5Qrcode('qr-reader-surface');

    return () => {
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        qrCodeRef.current.stop().then(() => {
          qrCodeRef.current?.clear();
        }).catch(err => console.error("Failed to stop scanner", err));
      }
    };
  }, []);

  const startScanner = async () => {
    if (!qrCodeRef.current) return;

    try {
      setError(null);
      const config: Html5QrcodeConfigs = {
        fps,
        qrbox: { width: qrbox, height: qrbox },
        aspectRatio: 1.0,
      };

      await qrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          if (onScanError) onScanError(errorMessage);
        }
      );
      setIsStarted(true);
    } catch (err: any) {
      console.error('Failed to start scanner', err);
      setError(err?.message || 'Camera access denied or not available');
      setIsStarted(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-[300px] justify-center bg-black relative rounded-lg overflow-hidden">
      <div id="qr-reader-surface" className="w-full h-full min-h-[300px]"></div>
      
      {!isStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center space-y-4">
          <Camera className="w-12 h-12 text-gray-500" />
          {error ? (
            <div className="text-red-400">
              <p className="font-semibold">Camera Error</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <p className="text-sm opacity-80">The scanner needs camera access to read QR codes.</p>
          )}
          <Button 
            onClick={startScanner} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Start Camera Scanner
          </Button>
        </div>
      )}
    </div>
  );
};

export default LiveScanner;
