import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ScrollText, Search, X, Plus, Pencil, Trash2, LogIn, ArrowLeftRight, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

interface AuditLogEntry {
  id: number;
  user_id?: number | null;
  username?: string | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  description: string;
  site?: string | null;
  timestamp: string;
}

const actionConfig: Record<string, { label: string; className: string; icon: JSX.Element }> = {
  create: { label: 'Create', className: 'bg-green-50 text-green-700 border-green-200', icon: <Plus className="w-3.5 h-3.5" /> },
  update: { label: 'Update', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Pencil className="w-3.5 h-3.5" /> },
  delete: { label: 'Delete', className: 'bg-red-50 text-red-700 border-red-200', icon: <Trash2 className="w-3.5 h-3.5" /> },
  login: { label: 'Login', className: 'bg-purple-50 text-purple-700 border-purple-200', icon: <LogIn className="w-3.5 h-3.5" /> },
  movement: { label: 'Movement', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
};

const getActionBadge = (action: string) => {
  const config = actionConfig[action] || { label: action, className: 'bg-gray-50 text-gray-700 border-gray-200', icon: <ClipboardCheck className="w-3.5 h-3.5" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-semibold uppercase ${config.className}`}>
      {config.icon} {config.label}
    </span>
  );
};

const LOGS_PER_PAGE = 50;

const AuditLogPage = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('L&T Audit Log Report', 14, 15);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 21);
      doc.text(`Total Records: ${filteredLogs.length}`, 14, 26);
      
      const tableData = filteredLogs.map((log) => [
        log.timestamp ? new Date(log.timestamp).toLocaleString() : '-',
        log.username || 'System',
        log.action.toUpperCase(),
        log.description || '-',
        log.site || '-',
      ]);
      
      autoTable(doc, {
        startY: 32,
        head: [['Date & Time', 'User', 'Action', 'Description', 'Site']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 90 },
          4: { cellWidth: 20 },
        },
      });
      
      doc.save(`audit_log_${Date.now()}.pdf`);
      toast.success('PDF report exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    }
  };

  const exportDOC = () => {
    try {
      let content = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <title>Audit Log Report</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
            h2 { color: #1E3A8A; }
            table { border-collapse: collapse; width: 100%; margin-top: 15px; }
            th { background-color: #1E3A8A; color: white; font-weight: bold; text-align: left; padding: 6px; border: 1px solid #ddd; }
            td { padding: 6px; border: 1px solid #ddd; font-size: 9.5pt; }
            .meta { margin-bottom: 10px; color: #555; font-size: 9pt; }
          </style>
        </head>
        <body>
          <h2>L&T Audit Log Report</h2>
          <div class="meta">
            <strong>Generated on:</strong> ${new Date().toLocaleString()}<br/>
            <strong>Total Records:</strong> ${filteredLogs.length}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%">Date & Time</th>
                <th style="width: 15%">User</th>
                <th style="width: 10%">Action</th>
                <th style="width: 45%">Description</th>
                <th style="width: 10%">Site</th>
              </tr>
            </thead>
            <tbody>
      `;

      filteredLogs.forEach((log) => {
        content += `
          <tr>
            <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
            <td>${log.username || 'System'}</td>
            <td style="text-transform: uppercase;">${log.action}</td>
            <td>${log.description || '-'}</td>
            <td>${log.site || '-'}</td>
          </tr>
        `;
      });

      content += `
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
      saveAs(blob, `audit_log_${Date.now()}.doc`);
      toast.success('Word report exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export DOC');
    }
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/audit-logs/?limit=5000');
        setLogs(res.data);
      } catch (err) {
        console.error('Failed to fetch audit logs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) => {
      return (
        (log.description || '').toLowerCase().includes(query) ||
        (log.username || '').toLowerCase().includes(query) ||
        (log.action || '').toLowerCase().includes(query) ||
        (log.entity_type || '').toLowerCase().includes(query) ||
        (log.site || '').toLowerCase().includes(query)
      );
    });
  }, [logs, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Audit Log</h1>
          <p className="text-gray-500 mt-1">
            A complete record of every action performed across the application
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <ScrollText className="text-[#1E3A8A] w-5 h-5" />
              Activity History
            </CardTitle>
            <CardDescription>Create, update, delete, login and movement events</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPDF}
              disabled={filteredLogs.length === 0}
              className="text-[#1E3A8A] border-[#1E3A8A] hover:bg-blue-50 h-8"
            >
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDOC}
              disabled={filteredLogs.length === 0}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8"
            >
              Export DOC
            </Button>
            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
              {filteredLogs.length} of {logs.length} {logs.length === 1 ? 'Record' : 'Records'}
            </Badge>
          </div>
        </CardHeader>

        {logs.length > 0 && (
          <div className="p-3 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by user, action, entity, site or description..."
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearch('')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading audit log...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <ScrollText className="w-12 h-12 text-gray-200 mb-2" />
              <p>No activity has been recorded yet.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Search className="w-12 h-12 text-gray-200 mb-2" />
              <p>No log entries match your search.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto [&>div]:overflow-visible">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="sticky top-0 border-b border-gray-100 z-10 shadow-sm [&_th]:bg-white">
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Site</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-blue-50/20">
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-[#1E3A8A]">{log.username || 'System'}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-[360px] truncate" title={log.description}>
                        {log.description}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{log.site || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {filteredLogs.length > 0 && (
          <div className="flex items-center justify-between gap-4 p-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * LOGS_PER_PAGE + 1}-
              {Math.min(currentPage * LOGS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditLogPage;
