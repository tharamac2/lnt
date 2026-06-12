
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, Calendar, MapPin, Activity, FileDown, QrCode } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ViewTool = () => {
    const { qrCode } = useParams<{ qrCode: string }>();
    const navigate = useNavigate();
    const [tool, setTool] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const generatePDF = () => {
        if (!tool) return;

        const doc = new jsPDF();

        // Header
        doc.setFillColor(30, 58, 138); // #1E3A8A
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('Tool Inspection Certificate', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });

        // Tool Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.text('Equipment Details', 14, 50);

        const details = [
            ['Tool Description', tool.description],
            ['Identification / QR', tool.qr_code],
            ['Make', tool.make],
            ['Capacity', tool.capacity],
            ['Safe Working Load (SWL)', tool.safe_working_load],
            ['Current Status', tool.status.toUpperCase()],
            ['Current Site', tool.current_site || 'N/A'],
        ];

        autoTable(doc, {
            startY: 55,
            head: [['Parameter', 'Value']],
            body: details,
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138] },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        // Dates & Inspection
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.text('Inspection & Validity', 14, finalY);

        const dates = [
            ['Date of Receipt', tool.date_of_supply ? new Date(tool.date_of_supply).toLocaleDateString() : 'N/A'],
            ['Last Inspection Date', new Date(tool.last_inspection_date).toLocaleDateString()],
            ['Next Inspection Due', tool.expiry_date ? new Date(tool.expiry_date).toLocaleDateString() : 'N/A'],
            ['Usability Percentage', tool.usability_percentage ? `${tool.usability_percentage}%` : 'N/A'],
            ['Subcontractor', tool.subcontractor_name || 'N/A'],
        ];

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Parameter', 'Value']],
            body: dates,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138] },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('This document is electronically generated and holds the latest status of the equipment.', 105, pageHeight - 10, { align: 'center' });

        doc.save(`${tool.qr_code}_Certificate.pdf`);
        toast.success("Certificate downloaded");
    };

    useEffect(() => {
        const fetchTool = async () => {
            if (!qrCode) return;
            try {
                const response = await api.get(`/tools/qr/${qrCode}`);
                setTool(response.data);
            } catch (error) {
                console.error(error);
                toast.error('Tool not found');
            } finally {
                setLoading(false);
            }
        };
        fetchTool();
    }, [qrCode]);

    if (loading) {
        return <div className="p-8 text-center">Loading tool details...</div>;
    }

    if (!tool) {
        return (
            <div className="p-8 text-center space-y-4">
                <h2 className="text-xl font-semibold text-red-600">Tool Not Found</h2>
                <p>The scanned QR code does not match any tool in our database.</p>
                <Button onClick={() => navigate('/')}>Go Home</Button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-4">
                <Button variant="ghost" onClick={() => window.history.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={generatePDF} className="bg-[#1E3A8A] text-white">
                    <FileDown className="w-4 h-4 mr-2" /> Download Report
                </Button>
            </div>

            <Card className="overflow-hidden border-2 border-t-4 border-t-[#1E3A8A] shadow-lg">
                <CardHeader className="flex flex-row items-center space-x-4 pb-2">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-[#1E3A8A]" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">{tool.description}</CardTitle>
                        <p className="text-sm font-mono text-gray-500">{tool.qr_code}</p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    {/* Status Badge */}
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm text-gray-500">Status</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1
               ${tool.status === 'usable' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {tool.status === 'usable' ? (
                                <CheckCircle className="w-3 h-3" />
                            ) : (
                                <XCircle className="w-3 h-3" />
                            )}{tool.status.toUpperCase()}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500">Make</p>
                            <p className="font-medium">{tool.make || '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Capacity</p>
                            <p className="font-medium">{tool.capacity || '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Safe Working Load</p>
                            <p className="font-medium">{tool.safe_working_load || '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Current Site</p>
                            <p className="font-medium">{tool.current_site || '-'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-gray-500">Supplier</p>
                            <p className="font-medium">{tool.purchaser_name || '-'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-gray-500">Date of Receipt</p>
                            <p className="font-medium">{tool.date_of_supply ? new Date(tool.date_of_supply).toLocaleDateString() : '-'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-gray-500">Last Inspection</p>
                            <p className="font-medium">{tool.last_inspection_date ? new Date(tool.last_inspection_date).toLocaleDateString() : 'Never'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-gray-500">Supplier Contact</p>
                            <p className="font-medium">{tool.purchaser_contact || '-'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ViewTool;
