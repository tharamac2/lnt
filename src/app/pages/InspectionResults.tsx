import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { ClipboardList, Search, X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const InspectionResults = () => {
  const [siteName, setSiteName] = useState<string>('');
  const [inspections, setInspections] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const userRes = await api.get('/users/me');
        setSiteName(userRes.data.site || '');

        const res = await api.get('/inspections/results?limit=200');
        setInspections(res.data);
      } catch (err) {
        console.error("Failed to fetch inspection results", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const filteredInspections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inspections;
    return inspections.filter((i) => {
      const tool = i.tool || {};
      return (
        (tool.description || '').toLowerCase().includes(query) ||
        (tool.qr_code || '').toLowerCase().includes(query) ||
        (i.result || '').toLowerCase().includes(query) ||
        (i.remarks || '').toLowerCase().includes(query) ||
        (i.inspector?.full_name || i.inspector?.username || '').toLowerCase().includes(query)
      );
    });
  }, [inspections, search]);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'pass':
        return (
          <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold uppercase">
            <CheckCircle className="w-3.5 h-3.5" /> Pass
          </span>
        );
      case 'fail':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 text-xs font-semibold uppercase">
            <XCircle className="w-3.5 h-3.5" /> Fail
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold uppercase">
            <AlertTriangle className="w-3.5 h-3.5" /> {result || '-'}
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Inspection Results</h1>
          <p className="text-gray-500 mt-1">
            Recorded inspection outcomes for tools at {siteName || 'your site'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <ClipboardList className="text-[#1E3A8A] w-5 h-5" />
              Inspection History
            </CardTitle>
            <CardDescription>Latest inspections recorded for tools at {siteName || 'your site'}</CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
            {filteredInspections.length} of {inspections.length} {inspections.length === 1 ? 'Record' : 'Records'}
          </Badge>
        </CardHeader>

        {inspections.length > 0 && (
          <div className="p-3 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by tool, QR code, result or remarks..."
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
            <div className="p-8 text-center text-gray-400">Loading inspection results...</div>
          ) : inspections.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <ClipboardList className="w-12 h-12 text-gray-200 mb-2" />
              <p>No inspection results found for {siteName || 'your site'}.</p>
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Search className="w-12 h-12 text-gray-200 mb-2" />
              <p>No inspections match your search.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
              <Table>
                <TableHeader className="bg-white sticky top-0 border-b border-gray-100 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Usability %</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Inspected By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInspections.map((i) => (
                    <TableRow key={i.id} className="hover:bg-blue-50/20">
                      <TableCell className="font-medium text-[#1E3A8A]">
                        {i.tool?.description || '-'}
                        <Badge variant="outline" className="ml-2 text-[10px] text-gray-500">{i.tool?.qr_code}</Badge>
                      </TableCell>
                      <TableCell>{getResultBadge(i.result)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {i.usability_percentage !== null && i.usability_percentage !== undefined ? `${i.usability_percentage}%` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-[240px] truncate" title={i.remarks}>{i.remarks || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{i.inspector?.full_name || i.inspector?.username || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {i.date ? new Date(i.date).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InspectionResults;
