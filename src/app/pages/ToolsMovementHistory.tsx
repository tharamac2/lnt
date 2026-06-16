import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { ArrowDownCircle, ArrowUpCircle, Search, Truck, X } from 'lucide-react';
import api from '../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const ToolsMovementHistory = () => {
  const [storeLocation, setStoreLocation] = useState<string>('');
  const [movements, setMovements] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const userRes = await api.get('/users/me');
        const site = userRes.data.site;
        setStoreLocation(site || '');
        if (site) {
          const res = await api.get(`/movements/?site=${encodeURIComponent(site)}&limit=200`);
          setMovements(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch movement history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovements();
  }, []);

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return movements;
    return movements.filter((m) => {
      const tool = m.tool || {};
      return (
        (tool.description || '').toLowerCase().includes(query) ||
        (tool.qr_code || '').toLowerCase().includes(query) ||
        (m.from_site || '').toLowerCase().includes(query) ||
        (m.to_site || '').toLowerCase().includes(query) ||
        (m.remarks || '').toLowerCase().includes(query)
      );
    });
  }, [movements, search]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Tools Movement History</h1>
          <p className="text-gray-500 mt-1">
            Recent tool movements in and out of {storeLocation || 'your site'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Truck className="text-[#1E3A8A] w-5 h-5" />
              Movement History
            </CardTitle>
            <CardDescription>Tools received at or dispatched from {storeLocation || 'your site'}</CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
            {filteredMovements.length} of {movements.length} {movements.length === 1 ? 'Record' : 'Records'}
          </Badge>
        </CardHeader>

        {movements.length > 0 && (
          <div className="p-3 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by tool, QR code, site or remarks..."
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
            <div className="p-8 text-center text-gray-400">Loading movement history...</div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Truck className="w-12 h-12 text-gray-200 mb-2" />
              <p>No movement history found for {storeLocation || 'your site'}.</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Search className="w-12 h-12 text-gray-200 mb-2" />
              <p>No movements match your search.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
              <Table>
                <TableHeader className="bg-white sticky top-0 border-b border-gray-100 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((m) => {
                    const isInbound = m.to_site === storeLocation;
                    return (
                      <TableRow key={m.id} className="hover:bg-blue-50/20">
                        <TableCell className="font-medium text-[#1E3A8A]">
                          {m.tool?.description || '-'}
                          <Badge variant="outline" className="ml-2 text-[10px] text-gray-500">{m.tool?.qr_code}</Badge>
                        </TableCell>
                        <TableCell>
                          {isInbound ? (
                            <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold uppercase">
                              <ArrowDownCircle className="w-3.5 h-3.5" /> In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-semibold uppercase">
                              <ArrowUpCircle className="w-3.5 h-3.5" /> Out
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{m.from_site || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{m.to_site || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-[240px] truncate" title={m.remarks}>{m.remarks || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{m.user?.full_name || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {m.timestamp ? new Date(m.timestamp).toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ToolsMovementHistory;
