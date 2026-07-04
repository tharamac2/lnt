import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Camera, QrCode } from 'lucide-react';
import LiveScanner from './LiveScanner';
import { toast } from 'sonner';

interface ScannerDialogProps {
  onScan: (code: string) => void;
  buttonText?: string;
  title?: string;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  triggerClassName?: string;
}

const ScannerDialog: React.FC<ScannerDialogProps> = ({
  onScan,
  buttonText = "Live Scanner",
  title = "Scan QR Code",
  triggerVariant = "default",
  triggerClassName = "",
}) => {
  const [open, setOpen] = React.useState(false);

  const handleScanSuccess = (decodedText: string) => {
    // Extract code from URL if needed
    let code = decodedText;
    if (decodedText.includes('/view-tool/')) {
      const parts = decodedText.split('/view-tool/');
      if (parts.length > 1) {
        code = parts[1];
      }
    }
    
    onScan(code);
    setOpen(false); // Close dialog on success
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={triggerClassName}>
          <Camera className="w-5 h-5 mr-2" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 overflow-hidden rounded-xl bg-black">
          {open && (
            <LiveScanner 
              onScanSuccess={handleScanSuccess} 
              onScanError={(err) => {
                // Ignore silent errors
                if (err.includes("NotFoundException")) return; 
              }}
            />
          )}
        </div>
        <p className="text-xs text-center text-gray-500 mt-2">
          Position the QR code within the frame to scan automatically.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ScannerDialog;
