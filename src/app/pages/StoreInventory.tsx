import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  MapPin,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  X,
  Download,
  Store,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import api from '../services/api';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const StoreInventory = () => {
  const navigate = useNavigate();
  const [storeLocation, setStoreLocation] = useState<string>('Store');
  const [inventoryTools, setInventoryTools] = useState<any[]>([]);

  // Search & filters
  const [inventorySearch, setInventorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');
  const [selectedToolIds, setSelectedToolIds] = useState<Set<number>>(new Set());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'usable': return 'bg-[#16A34A] text-white';
      case 'scrap': return 'bg-red-100 text-red-700';
      case 'under-repair': return 'bg-amber-100 text-amber-700';
      case 'missing': return 'bg-orange-100 text-orange-700';
      case 'stolen': return 'bg-red-900 text-white';
      case 'scrapped': return 'bg-neutral-800 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const uniqueMakes = useMemo(() => {
    const makes = new Set<string>();
    inventoryTools.forEach((tool) => {
      if (tool.make) makes.add(tool.make);
    });
    return Array.from(makes).sort();
  }, [inventoryTools]);

  const filteredInventoryTools = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    return inventoryTools.filter((tool) => {
      if (statusFilter !== 'all' && tool.status !== statusFilter) return false;
      if (makeFilter !== 'all' && tool.make !== makeFilter) return false;
      if (!query) return true;
      return (
        (tool.description || '').toLowerCase().includes(query) ||
        (tool.qr_code || '').toLowerCase().includes(query) ||
        (tool.make || '').toLowerCase().includes(query) ||
        (tool.capacity || '').toLowerCase().includes(query)
      );
    });
  }, [inventoryTools, inventorySearch, statusFilter, makeFilter]);

  const toggleToolSelection = (toolId: number) => {
    setSelectedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const allFilteredSelected = filteredInventoryTools.length > 0 &&
    filteredInventoryTools.every((tool) => selectedToolIds.has(tool.id));

  const toggleSelectAll = () => {
    setSelectedToolIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredInventoryTools.forEach((tool) => next.delete(tool.id));
        return next;
      }
      const next = new Set(prev);
      filteredInventoryTools.forEach((tool) => next.add(tool.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedToolIds(new Set());

  const selectedTools = useMemo(
    () => inventoryTools.filter((tool) => selectedToolIds.has(tool.id)),
    [inventoryTools, selectedToolIds]
  );

  const goToMovements = (mode: 'in' | 'out') => {
    navigate('/tools-movements', { state: { selectedTools, mode } });
  };

  const exportSelectedInventoryPDF = () => {
    if (selectedTools.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(`${storeLocation} Inventory - Selected Items`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    autoTable(doc, {
      head: [['Description', 'QR / Tracking', 'Make', 'Capacity', 'Status']],
      body: selectedTools.map((tool) => [
        tool.description,
        tool.qr_code,
        tool.make,
        tool.capacity,
        tool.status,
      ]),
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(`${storeLocation}_Selected_Inventory_${Date.now()}.pdf`);
    toast.success(`Exported ${selectedTools.length} item(s) to PDF`);
  };

  const refreshInventory = async () => {
    try {
      const userRes = await api.get('/users/me');
      const site = userRes.data.site;
      if (site) {
        setStoreLocation(site);
        const toolsRes = await api.get(`/tools/?site=${site}&limit=10000000`);
        setInventoryTools(toolsRes.data);
      } else {
        setStoreLocation('Store');
      }
    } catch (err) {
      console.error("Failed to fetch user site or inventory", err);
    }
  };

  useEffect(() => {
    refreshInventory();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Store Inventory</h1>
          <p className="text-gray-500 mt-1">Search, filter, and manage tools stationed at your site</p>
        </div>
      </div>

      <Card className="animate-in fade-in slide-in-from-top-4 duration-500">
        <CardHeader className="bg-gray-50 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <MapPin className="text-[#1E3A8A] w-5 h-5" />
              {storeLocation} Inventory
            </CardTitle>
            <CardDescription>
              Tools actively stationed at {storeLocation}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
            {filteredInventoryTools.length} of {inventoryTools.length} {inventoryTools.length === 1 ? 'Item' : 'Items'}
          </Badge>
        </CardHeader>

        {/* Search & Filters */}
        {inventoryTools.length > 0 && (
          <div className="p-3 border-b border-gray-100 flex flex-col md:flex-row gap-2 md:items-center bg-white">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by description, QR code, make or capacity..."
                className="pl-8 h-9"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
              />
              {inventorySearch && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setInventorySearch('')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full md:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="usable">Usable</SelectItem>
                <SelectItem value="under-repair">Under Repair</SelectItem>
                <SelectItem value="scrap">Scrap</SelectItem>
                <SelectItem value="scrapped">Scrapped</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="stolen">Stolen</SelectItem>
              </SelectContent>
            </Select>
            <Select value={makeFilter} onValueChange={setMakeFilter}>
              <SelectTrigger className="h-9 w-full md:w-[150px]">
                <SelectValue placeholder="Make" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Makes</SelectItem>
                {uniqueMakes.map((make) => (
                  <SelectItem key={make} value={make}>{make}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Bulk Selection Toolbar */}
        {selectedToolIds.size > 0 && (
          <div className="sticky top-16 z-20 px-3 py-2 border-b border-blue-100 bg-blue-50 flex items-center justify-between gap-2 flex-wrap shadow-sm">
            <span className="text-sm text-blue-800 font-medium">
              {selectedToolIds.size} item{selectedToolIds.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                className="h-8 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => goToMovements('in')}
              >
                <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" />
                Receipt (IN)
              </Button>
              <Button
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => goToMovements('out')}
              >
                <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" />
                Dispatch (OUT)
              </Button>
              <Button size="sm" variant="outline" className="h-8 bg-white" onClick={exportSelectedInventoryPDF}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export List
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-gray-500" onClick={clearSelection}>
                <X className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {inventoryTools.length > 0 ? (
            filteredInventoryTools.length > 0 ? (
              <div className="max-h-[500px] overflow-auto [&>div]:overflow-visible">
                <Table className="border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 border-b border-gray-100 z-10 shadow-sm [&_th]:bg-white">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>QR / Tracking</TableHead>
                      <TableHead>Make & Capacity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventoryTools.map((tool) => (
                      <TableRow key={tool.id} className="hover:bg-blue-50/20 cursor-pointer" onClick={() => navigate('/store-view', { state: { qrCode: tool.qr_code } })}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedToolIds.has(tool.id)}
                            onCheckedChange={() => toggleToolSelection(tool.id)}
                            aria-label={`Select ${tool.description}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-[#1E3A8A]">{tool.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-gray-500">{tool.qr_code}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {tool.make} <span className="text-xs text-gray-400 block">{tool.capacity}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase whitespace-nowrap ${getStatusColor(tool.status)}`}>
                            {tool.status}
                          </span>
                          {tool.subcontractor_name && (
                            <span className="block text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]" title={tool.subcontractor_name}>
                              held by: {tool.subcontractor_name}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <Search className="w-12 h-12 text-gray-200 mb-2" />
                <p>No tools match your search or filters.</p>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Store className="w-12 h-12 text-gray-200 mb-2" />
              <p>This location has no tools currently registered.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreInventory;
