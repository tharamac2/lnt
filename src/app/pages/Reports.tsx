import { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Download, Search, X } from "lucide-react";
import { QRCodeCanvas } from 'qrcode.react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from '../components/ui/badge';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
    const [tools, setTools] = useState<any[]>([]);
    const [globalSearch, setGlobalSearch] = useState("");
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [hoveredTool, setHoveredTool] = useState<any | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        const fetchTools = async () => {
            try {
                const response = await api.get('/tools/');
                const sortedTools = response.data.sort((a: any, b: any) => b.id - a.id);
                setTools(sortedTools);
            } catch (error) {
                console.error("Failed to fetch tools report", error);
            }
        };
        fetchTools();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [globalSearch, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setGlobalSearch("");
        setFilters({});
    };

    const filteredTools = tools.filter(tool => {
        // 1. Global Search
        const searchStr = globalSearch.toLowerCase();
        const globalMatch = !globalSearch || [
            tool.description, tool.qr_code, tool.make, tool.capacity, tool.safe_working_load,
            tool.purchaser_name, tool.subcontractor_name, tool.current_site, tool.status,
            tool.inspection_result
        ].some(val => val?.toString().toLowerCase().includes(searchStr));

        if (!globalMatch) return false;

        // 2. Column Filters
        return Object.entries(filters).every(([key, filterVal]) => {
            if (!filterVal || filterVal === 'all') return true;
            const toolVal = tool[key]?.toString().toLowerCase() || "";
            return toolVal.includes(filterVal.toLowerCase());
        });
    });

    const totalPages = Math.ceil(filteredTools.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTools = filteredTools.slice(startIndex, startIndex + itemsPerPage);

    const downloadCSV = () => {
        if (filteredTools.length === 0) return;

        const headers = [
            "S.No", "Tool ID", "Tool Name", "QR Code", "Make (Year)", "Capacity", "SWL",
            "Purchaser Name", "Purchaser Contact", "Supplier Code", "Date of Supply",
            "Last Inspection", "Inspection Result", "Usability %", "Validity (Yrs)", "Expiry Date",
            "Subcontractor", "Subcontractor Code", "Previous Site", "Current Site", "Next Site", "Status", "Remarks", "Test Certificate"
        ];

        const csvRows = [
            headers.join(','),
            ...filteredTools.map((tool, index) => [
                index + 1,
                tool.id || '',
                `"${tool.description?.replace(/"/g, '""') || ''}"`,
                `"${tool.qr_code || ''}"`,
                `"${tool.make || ''}"`,
                `"${tool.capacity || ''}"`,
                `"${tool.safe_working_load || ''}"`,
                `"${tool.purchaser_name || ''}"`,
                `"${tool.purchaser_contact || ''}"`,
                `"${tool.supplier_code || ''}"`,
                tool.date_of_supply ? new Date(tool.date_of_supply).toLocaleDateString() : '',
                tool.last_inspection_date ? new Date(tool.last_inspection_date).toLocaleDateString() : '',
                tool.inspection_result || '',
                tool.usability_percentage || '',
                tool.validity_period || '',
                tool.expiry_date ? new Date(tool.expiry_date).toLocaleDateString() : '',
                `"${tool.subcontractor_name || ''}"`,
                `"${tool.subcontractor_code || ''}"`,
                `"${tool.previous_site || ''}"`,
                `"${tool.current_site || ''}"`,
                `"${tool.next_site || ''}"`,
                tool.status || '',
                `"${tool.remarks || ''}"`,
                tool.test_certificate ? `"https://lntqrcode.com/api/${tool.test_certificate}"` : ''
            ].join(','))
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tools_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const downloadPDF = () => {
        if (filteredTools.length === 0) return;

        const doc = new jsPDF('landscape');

        doc.setFontSize(18);
        doc.text("Tool Inventory Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        const tableColumn = [
            "S.No", "Tool Name", "QR Code", "Make", "Capacity", "SWL", "Purchaser",
            "Supply Date", "Last Insp.", "Result", "Subcon", "Site", "Status"
        ];

        const tableRows = filteredTools.map((tool, index) => [
            index + 1,
            tool.description,
            tool.qr_code,
            tool.make,
            tool.capacity,
            tool.safe_working_load,
            tool.purchaser_name,
            tool.date_of_supply ? new Date(tool.date_of_supply).toLocaleDateString() : '-',
            tool.last_inspection_date ? new Date(tool.last_inspection_date).toLocaleDateString() : '-',
            tool.inspection_result,
            tool.subcontractor_name,
            tool.current_site,
            tool.status
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 58, 138] }, // #1E3A8A
        });

        doc.save(`tools_report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="max-w-[95vw] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-[#0F172A]">Tool Inventory Report</h1>
                    <p className="text-gray-500 mt-1">Comprehensive list of all tools and their details.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={clearFilters} title="Clear all filters">
                        <X className="w-4 h-4 mr-2" />
                        Clear Filters
                    </Button>
                    <Button onClick={downloadPDF} variant="outline" className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-blue-50">
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                    </Button>
                    <Button onClick={downloadCSV} className="bg-[#1E3A8A]">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Global Search..."
                        className="pl-9 bg-white"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Detailed Inventory ({filteredTools.length} tools)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table className="min-w-max">
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="min-w-[150px]">Tool Name</TableHead>
                                    <TableHead className="min-w-[100px]">QR Code</TableHead>
                                    <TableHead className="min-w-[100px]">Make</TableHead>
                                    <TableHead className="min-w-[100px]">Capacity</TableHead>
                                    <TableHead className="min-w-[100px]">SWL</TableHead>
                                    <TableHead className="min-w-[150px]">Purchaser</TableHead>
                                    <TableHead className="min-w-[100px]">Supply Date</TableHead>
                                    <TableHead className="min-w-[100px]">Last Insp.</TableHead>
                                    <TableHead className="min-w-[100px]">Result</TableHead>
                                    <TableHead className="min-w-[150px]">Subcontractor</TableHead>
                                    <TableHead className="min-w-[150px]">Current Site</TableHead>
                                    <TableHead className="min-w-[100px]">Status</TableHead>
                                    <TableHead className="min-w-[100px]">Certificate</TableHead>
                                </TableRow>
                                {/* Column Filters Row */}
                                <TableRow className="bg-gray-50 hover:bg-gray-50">
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Name" value={filters.description || ''} onChange={e => handleFilterChange('description', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter QR" value={filters.qr_code || ''} onChange={e => handleFilterChange('qr_code', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Make" value={filters.make || ''} onChange={e => handleFilterChange('make', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Cap" value={filters.capacity || ''} onChange={e => handleFilterChange('capacity', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter SWL" value={filters.safe_working_load || ''} onChange={e => handleFilterChange('safe_working_load', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Purchaser" value={filters.purchaser_name || ''} onChange={e => handleFilterChange('purchaser_name', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Supply Date" value={filters.date_of_supply || ''} onChange={e => handleFilterChange('date_of_supply', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Insp Date" value={filters.last_inspection_date || ''} onChange={e => handleFilterChange('last_inspection_date', e.target.value)} /></TableCell>
                                    <TableCell className="p-2">
                                        <Select value={filters.inspection_result || 'all'} onValueChange={val => handleFilterChange('inspection_result', val)}>
                                            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="usable">Usable</SelectItem>
                                                <SelectItem value="not-usable">Non Usable</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Subcon" value={filters.subcontractor_name || ''} onChange={e => handleFilterChange('subcontractor_name', e.target.value)} /></TableCell>
                                    <TableCell className="p-2"><Input className="h-8 text-xs bg-white" placeholder="Filter Site" value={filters.current_site || ''} onChange={e => handleFilterChange('current_site', e.target.value)} /></TableCell>
                                    <TableCell className="p-2">
                                        <Select value={filters.status || 'all'} onValueChange={val => handleFilterChange('status', val)}>
                                            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="usable">Usable</SelectItem>
                                                <SelectItem value="under-repair">Under Repair</SelectItem>
                                                <SelectItem value="scrap">Scrap</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="p-2"></TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedTools.length > 0 ? (
                                    paginatedTools.map((tool, index) => (
                                        <TableRow key={tool.id} className="hover:bg-gray-50/50">
                                            <TableCell className="font-medium text-[#1E3A8A]">
                                                {tool.description}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{tool.qr_code}</TableCell>
                                            <TableCell>{tool.make}</TableCell>
                                            <TableCell>{tool.capacity}</TableCell>
                                            <TableCell>{tool.safe_working_load}</TableCell>
                                            <TableCell>{tool.purchaser_name || '-'}</TableCell>
                                            <TableCell>{tool.date_of_supply ? new Date(tool.date_of_supply).toLocaleDateString() : '-'}</TableCell>
                                            <TableCell>{tool.last_inspection_date ? new Date(tool.last_inspection_date).toLocaleDateString() : '-'}</TableCell>
                                            <TableCell className="capitalize">{tool.inspection_result || '-'}</TableCell>
                                            <TableCell>{tool.subcontractor_name || '-'}</TableCell>
                                            <TableCell>{tool.current_site || '-'}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${tool.status === 'usable' ? 'bg-green-100 text-green-700' : tool.status === 'under-repair' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {tool.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {tool.test_certificate ? (
                                                    <a
                                                        href={`https://lntqrcode.com/api/${tool.test_certificate}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                    >
                                                        <Download className="w-3 h-3 mr-1" />
                                                        Download
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={13} className="h-24 text-center">
                                            No tools found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {filteredTools.length > 0 && (
                        <div className="flex items-center justify-between gap-4 mt-4 px-2">
                            <span className="text-sm text-gray-500">
                                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTools.length)} of {filteredTools.length} tools
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm font-medium">
                                    Page {currentPage} of {totalPages || 1}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>


            {
                hoveredTool && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center isolate" onClick={() => setHoveredTool(null)}>
                        {/* Backdrop Blur - Smooth Fade In */}
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-500 ease-out"
                            aria-hidden="true"
                        />

                        {/* Centered Card - Smart Spring Animation */}
                        <div className="relative z-50 w-96 p-6 bg-white/95 shadow-[0_20px_50px_rgba(8,_112,_184,_0.7)] rounded-xl border border-white/40 
                        animate-in fade-in zoom-in-90 slide-in-from-bottom-8 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                            <div className="space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-[#1E3A8A] flex items-center gap-2">
                                            {hoveredTool.description}
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{hoveredTool.qr_code}</Badge>
                                        </h4>
                                        <p className="text-sm text-gray-500 mt-1">{hoveredTool.make} • {hoveredTool.capacity} • SWL {hoveredTool.safe_working_load}</p>
                                    </div>
                                    <div className="p-2 bg-white rounded-lg border shadow-sm shrink-0">
                                        <QRCodeCanvas
                                            value={`${window.location.origin}/view-tool/${hoveredTool.qr_code}`}
                                            size={64}
                                            level={"H"}
                                            includeMargin={true}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm border-t border-b py-4">
                                    <div>
                                        <span className="text-gray-500 block text-xs">Supplier</span>
                                        <span className="font-medium">{hoveredTool.purchaser_name || '-'}</span>
                                        {hoveredTool.supplier_code && <span className="block text-gray-400 text-[10px]">Code: {hoveredTool.supplier_code}</span>}
                                        {hoveredTool.purchaser_contact && <span className="block text-gray-400 text-[10px]">Contact: {hoveredTool.purchaser_contact}</span>}
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Date of Receipt</span>
                                        <span className="font-medium">{hoveredTool.date_of_supply ? new Date(hoveredTool.date_of_supply).toLocaleDateString() : '-'}</span>
                                        {hoveredTool.validity_period && <span className="block text-gray-400 text-[10px]">Validity: {hoveredTool.validity_period} Years</span>}
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Last Inspection</span>
                                        <span className="font-medium">{hoveredTool.last_inspection_date ? new Date(hoveredTool.last_inspection_date).toLocaleDateString() : '-'}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold capitalize ${hoveredTool.inspection_result === 'usable' ? 'text-green-600' : 'text-red-500'}`}>
                                                {hoveredTool.inspection_result}
                                            </span>
                                            {hoveredTool.usability_percentage && <span className="text-[10px] text-gray-500">({hoveredTool.usability_percentage}%)</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Valid Until</span>
                                        <span className="font-medium">{hoveredTool.expiry_date ? new Date(hoveredTool.expiry_date).toLocaleDateString() : '-'}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm border-b py-4">
                                    <div>
                                        <span className="text-gray-500 block text-xs">Job Code</span>
                                        <span className="font-medium">{hoveredTool.job_code || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Job Description</span>
                                        <span className="font-medium truncate" title={hoveredTool.job_description}>{hoveredTool.job_description || '-'}</span>
                                    </div>
                                </div>

                                {hoveredTool.debit_to && (
                                    <div className="py-2 border-b bg-red-50 px-3 rounded mb-2">
                                        <span className="text-red-600 font-semibold block text-xs">Liability / Debit</span>
                                        <span className="text-sm font-bold text-red-800">{hoveredTool.debit_to}</span>
                                    </div>
                                )}

                                <div className="text-sm space-y-2">
                                    <p className="font-semibold text-gray-700">Site Movement History</p>
                                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                                        <div className="bg-gray-100 p-2 rounded">
                                            <span className="block text-gray-500 text-[10px] uppercase">Previous</span>
                                            {hoveredTool.previous_site || '-'}
                                        </div>
                                        <div className="bg-blue-50 text-blue-800 p-2 rounded ring-1 ring-blue-100">
                                            <span className="block text-blue-400 text-[10px] uppercase">Current</span>
                                            <span className="font-bold">{hoveredTool.current_site || '-'}</span>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded border border-dashed">
                                            <span className="block text-gray-400 text-[10px] uppercase">Next</span>
                                            <span className="text-gray-600">{hoveredTool.next_site || '-'}</span>
                                        </div>
                                    </div>
                                    {hoveredTool.subcontractor_name && (
                                        <div className="mt-1 pt-1 border-t border-dashed text-xs">
                                            <span className="text-gray-500">Sub-contractor: </span>
                                            <span className="font-medium">{hoveredTool.subcontractor_name}</span>
                                            {hoveredTool.subcontractor_code && <span className="text-gray-400"> ({hoveredTool.subcontractor_code})</span>}
                                        </div>
                                    )}
                                </div>

                                {(hoveredTool.remarks || hoveredTool.test_certificate) && (
                                    <div className="pt-2 text-xs space-y-2 border-t mt-2">
                                        {hoveredTool.remarks && (
                                            <div>
                                                <span className="text-gray-500 font-semibold">Remarks: </span>
                                                <span className="text-gray-700">{hoveredTool.remarks}</span>
                                            </div>
                                        )}
                                        {hoveredTool.test_certificate && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-gray-500 font-semibold">Certificate: </span>
                                                <a
                                                    href={`https://lntqrcode.com/api/${hoveredTool.test_certificate}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Download className="w-3 h-3 mr-1" />
                                                    Download PDF
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
