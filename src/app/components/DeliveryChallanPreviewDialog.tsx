import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Trash2, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildDeliveryChallanDoc,
  DeliveryChallanItem,
  DeliveryChallanOptions,
} from '../utils/deliveryChallan';

interface DeliveryChallanPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOptions: DeliveryChallanOptions | null;
  onDownloaded?: () => void;
}

type EditableFields = Omit<DeliveryChallanOptions, 'type' | 'items' | 'filename' | 'copyDistribution'>;

// Copy Distribution checkboxes are always shown unchecked in the generated PDF
const EMPTY_COPY_DISTRIBUTION: string[] = [];

const emptyFields: EditableFields = {
  consignee: '',
  siteCode: '',
  date: '',
  remarks: '',
  dcNo: '',
  trnCd: '',
  sendingCentreCode: '',
  mrNo: '',
  mrDate: '',
  stockType: '',
  vendorCode: '',
  ewayBillNo: '',
  gatePassApprovedBy: '',
  totalAmount: '',
  consignorSalesTax: '',
  consigneeSalesTax: '',
  vehicleDetails: '',
  lrNo: '',
  freightToPay: '',
  freightPaid: '',
  receiptRmnNo: '',
  receiptDate: '',
  driverName: '',
  driverMobile: '',
};

const DeliveryChallanPreviewDialog = ({
  open,
  onOpenChange,
  initialOptions,
  onDownloaded,
}: DeliveryChallanPreviewDialogProps) => {
  const [fields, setFields] = useState<EditableFields>(emptyFields);
  const [items, setItems] = useState<DeliveryChallanItem[]>([]);
  const copyDistribution = EMPTY_COPY_DISTRIBUTION;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const setField = (key: keyof EditableFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (open && initialOptions) {
      setFields({
        consignee: initialOptions.consignee || '',
        siteCode: initialOptions.siteCode || '',
        date: initialOptions.date || new Date().toLocaleDateString(),
        remarks: initialOptions.remarks || '',
        dcNo: initialOptions.dcNo || '',
        trnCd: initialOptions.trnCd || 'M 25',
        sendingCentreCode: initialOptions.sendingCentreCode || '',
        mrNo: initialOptions.mrNo || '',
        mrDate: initialOptions.mrDate || '',
        stockType: initialOptions.stockType || '',
        vendorCode: initialOptions.vendorCode || '',
        ewayBillNo: initialOptions.ewayBillNo || '',
        gatePassApprovedBy: initialOptions.gatePassApprovedBy || '',
        totalAmount: initialOptions.totalAmount || '',
        consignorSalesTax: initialOptions.consignorSalesTax || '',
        consigneeSalesTax: initialOptions.consigneeSalesTax || '',
        vehicleDetails: initialOptions.vehicleDetails || '',
        lrNo: initialOptions.lrNo || '',
        freightToPay: initialOptions.freightToPay || '',
        freightPaid: initialOptions.freightPaid || '',
        receiptRmnNo: initialOptions.receiptRmnNo || '',
        receiptDate: initialOptions.receiptDate || '',
        driverName: initialOptions.driverName || '',
        driverMobile: initialOptions.driverMobile || '',
      });
      setItems(initialOptions.items.map((item) => ({ ...item })));
    }
  }, [open, initialOptions]);

  useEffect(() => {
    if (!open || !initialOptions) return;

    let revoked = false;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      buildDeliveryChallanDoc({
        ...initialOptions,
        ...fields,
        items,
        copyDistribution,
      })
        .then((doc) => {
          if (revoked) return;
          const blobUrl = doc.output('bloburl') as unknown as string;
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return blobUrl;
          });
        })
        .catch((err) => {
          console.error('Failed to build challan preview', err);
          setPreviewLoading(false);
        });
    }, 600);

    return () => {
      revoked = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialOptions, fields, items, copyDistribution]);

  useEffect(() => {
    if (!open) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateItem = (index: number, field: keyof DeliveryChallanItem, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: '1', unit: 'NOS', rate: '' }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownload = async () => {
    if (!initialOptions) return;
    setDownloading(true);
    try {
      const doc = await buildDeliveryChallanDoc({
        ...initialOptions,
        ...fields,
        items,
        copyDistribution,
      });
      const filename =
        initialOptions.filename ||
        `${initialOptions.type === 'RECEIPT' ? 'Inward' : 'Outward'}_Delivery_Challan_${Date.now()}.pdf`;
      doc.save(filename);
      toast.success('Delivery Challan downloaded');
      onDownloaded?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to download challan', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (!initialOptions) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Preview & Edit {initialOptions.type === 'RECEIPT' ? 'Receipt' : 'Dispatch'} Delivery Challan
          </DialogTitle>
          <DialogDescription>
            Edit any field below — the preview updates automatically. Download when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>DC No.</Label>
                <Input value={fields.dcNo} onChange={(e) => setField('dcNo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input value={fields.date} onChange={(e) => setField('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Consignee</Label>
                <Input value={fields.consignee} onChange={(e) => setField('consignee', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Consignee / Site Code</Label>
                <Input value={fields.siteCode} onChange={(e) => setField('siteCode', e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>E-Way Bill No.</Label>
                <Input value={fields.ewayBillNo} onChange={(e) => setField('ewayBillNo', e.target.value)} />
              </div>
            </div>

            {/* TRN CD / codes row */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Transaction Codes</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">TRN CD</Label>
                  <Input value={fields.trnCd} onChange={(e) => setField('trnCd', e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Sending / Accounting Centre Code</Label>
                  <Input value={fields.sendingCentreCode} onChange={(e) => setField('sendingCentreCode', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">M. R. No.</Label>
                  <Input value={fields.mrNo} onChange={(e) => setField('mrNo', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">M. R. Date</Label>
                  <Input value={fields.mrDate} onChange={(e) => setField('mrDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Stock Type</Label>
                  <Input value={fields.stockType} onChange={(e) => setField('stockType', e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-3">
                  <Label className="text-xs">Vendor Code</Label>
                  <Input value={fields.vendorCode} onChange={(e) => setField('vendorCode', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 border rounded-md p-2 items-center">
                    <Input
                      className="col-span-5"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Qty"
                      value={String(item.quantity ?? '')}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Unit"
                      value={item.unit ?? ''}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Rate"
                      value={item.rate ?? ''}
                      onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Gate pass / total */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Gate Pass & Total</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Gate Pass Approved By</Label>
                  <Input value={fields.gatePassApprovedBy} onChange={(e) => setField('gatePassApprovedBy', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Total (Rs.)</Label>
                  <Input value={fields.totalAmount} onChange={(e) => setField('totalAmount', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Sales tax */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Sales Tax</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Consignor's Sales Tax No. & Date</Label>
                  <Input value={fields.consignorSalesTax} onChange={(e) => setField('consignorSalesTax', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Consignee's Sales Tax No. & Date</Label>
                  <Input value={fields.consigneeSalesTax} onChange={(e) => setField('consigneeSalesTax', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Transport */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Transport & Freight</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Despatch Through</Label>
                  <Input value={fields.vehicleDetails} onChange={(e) => setField('vehicleDetails', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">LR / RR No. & Date</Label>
                  <Input value={fields.lrNo} onChange={(e) => setField('lrNo', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Freight To Pay (Rs.)</Label>
                  <Input value={fields.freightToPay} onChange={(e) => setField('freightToPay', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Freight Paid (Rs.)</Label>
                  <Input value={fields.freightPaid} onChange={(e) => setField('freightPaid', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Receipt details */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Receipt Details</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Site MRN No</Label>
                  <Input value={fields.receiptRmnNo} onChange={(e) => setField('receiptRmnNo', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Receipt Date</Label>
                  <Input value={fields.receiptDate} onChange={(e) => setField('receiptDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Driver Name</Label>
                  <Input value={fields.driverName} onChange={(e) => setField('driverName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Driver Mobile Number</Label>
                  <Input value={fields.driverMobile} onChange={(e) => setField('driverMobile', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-400">Signature of receiver is filled in manually after printing.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea value={fields.remarks} onChange={(e) => setField('remarks', e.target.value)} rows={2} />
            </div>
          </div>

          <div className="relative border rounded-md overflow-hidden bg-gray-50 min-h-[400px]">
            {previewUrl && (
              <iframe
                title="Delivery Challan Preview"
                src={previewUrl}
                className="w-full h-full min-h-[400px]"
                onLoad={() => setPreviewLoading(false)}
              />
            )}
            {(previewLoading || !previewUrl) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-400">
                Generating preview...
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-[#1E3A8A]" onClick={handleDownload} disabled={downloading}>
            <Download className="w-4 h-4 mr-2" />
            {downloading ? 'Preparing...' : 'Download Delivery Challan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryChallanPreviewDialog;
