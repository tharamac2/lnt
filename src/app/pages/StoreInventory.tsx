import { useState, useEffect, useMemo, useRef } from 'react';
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
  const lastSelectedIndexRef = useRef<number>(-1);

  // Pending Return Resolution State
  const [selectedPendingTool, setSelectedPendingTool] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<'returned' | 'missing' | 'pending'>('returned');
  const [resolveDays, setResolveDays] = useState<number>(40);
  const [resolveReason, setResolveReason] = useState<string>('');
  const [resolveSubmitting, setResolveSubmitting] = useState<boolean>(false);

  const getDaysRemaining = (returnDateStr: string) => {
    if (!returnDateStr) return 0;
    const returnDate = new Date(returnDateStr);
    const today = new Date();
    returnDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = returnDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleOpenResolveModal = (tool: any) => {
    setSelectedPendingTool(tool);
    setResolveAction('returned');
    setResolveDays(40);
    setResolveReason(tool.pending_reason || '');
  };

  const handleResolveSubmit = async () => {
    if (!selectedPendingTool) return;

    if (resolveAction === 'pending') {
      if (!resolveDays || resolveDays <= 0) {
        toast.error("Please enter a valid number of days");
        return;
      }
      if (!resolveReason || !resolveReason.trim()) {
        toast.error("Please enter a reason for extension");
        return;
      }
    }

    setResolveSubmitting(true);
    try {
      const payload: any = {};
      if (resolveAction === 'returned') {
        payload.status = 'usable';
        payload.current_site = storeLocation;
        payload.subcontractor_name = null;
        payload.subcontractor_code = null;
        payload.pending_return_date = null;
        payload.pending_reason = null;
        payload.remarks = `Resolved Pending Return: Returned to Store.`;
      } else if (resolveAction === 'missing') {
        payload.status = 'missing';
        payload.pending_return_date = null;
        payload.pending_reason = null;
        payload.remarks = `Resolved Pending Return: Marked as Missing.`;
      } else if (resolveAction === 'pending') {
        payload.status = 'pending';
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + resolveDays);
        payload.pending_return_date = returnDate.toISOString();
        payload.pending_reason = resolveReason;
        payload.remarks = `Extended Pending Return: ${resolveDays} days. Reason: ${resolveReason}.`;
      }

      await api.patch(`/tools/${selectedPendingTool.id}`, payload);
      toast.success("Tool status updated successfully");
      setSelectedPendingTool(null);
      refreshInventory();
    } catch (error) {
      console.error("Failed to resolve tool status", error);
      toast.error("Failed to resolve tool status");
    } finally {
      setResolveSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'usable': return 'bg-[#16A34A] text-white';
      case 'scrap': return 'bg-red-100 text-red-700';
      case 'under-repair': return 'bg-amber-100 text-amber-700';
      case 'missing': return 'bg-orange-100 text-orange-700';
      case 'stolen': return 'bg-red-900 text-white';
      case 'scrapped': return 'bg-neutral-800 text-white';
      case 'pending': return 'bg-amber-500 text-white';
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

  const pendingTools = useMemo(() => {
    return inventoryTools.filter((tool) => tool.status === 'pending');
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

  const toggleToolSelection = (toolId: number, shiftKey: boolean = false) => {
    const currentIndex = filteredInventoryTools.findIndex((t) => t.id === toolId);
    if (shiftKey && lastSelectedIndexRef.current >= 0) {
      const start = Math.min(lastSelectedIndexRef.current, currentIndex);
      const end = Math.max(lastSelectedIndexRef.current, currentIndex);
      setSelectedToolIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(filteredInventoryTools[i].id);
        }
        return next;
      });
    } else {
      setSelectedToolIds((prev) => {
        const next = new Set(prev);
        if (next.has(toolId)) {
          next.delete(toolId);
        } else {
          next.add(toolId);
        }
        return next;
      });
    }
    lastSelectedIndexRef.current = currentIndex;
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

      {pendingTools.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/10 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              Pending Returns & Reminders
              <Badge variant="outline" className="bg-amber-100/50 text-amber-800 border-amber-200">
                {pendingTools.length} Tool{pendingTools.length === 1 ? '' : 's'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Tools currently marked as pending return. Please resolve status for overdue tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="overflow-x-auto border rounded-lg bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold py-2">Tool Details</TableHead>
                    <TableHead className="text-xs font-semibold py-2">Subcontractor/Site</TableHead>
                    <TableHead className="text-xs font-semibold py-2">Expected Return Date</TableHead>
                    <TableHead className="text-xs font-semibold py-2">Days Left</TableHead>
                    <TableHead className="text-xs font-semibold py-2">Reason</TableHead>
                    <TableHead className="text-xs font-semibold py-2 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTools.map((tool) => {
                    const daysLeft = getDaysRemaining(tool.pending_return_date);
                    const isOverdue = daysLeft <= 0;
                    return (
                      <TableRow key={tool.id} className="hover:bg-slate-50/50">
                        <TableCell className="py-2.5">
                          <div className="font-semibold text-slate-800 text-xs">{tool.description}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tool.qr_code}</div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600">
                          {tool.subcontractor_name ? (
                            <div>
                              <span className="font-medium text-slate-700">{tool.subcontractor_name}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">Code: {tool.subcontractor_code}</span>
                            </div>
                          ) : (
                            <span>{tool.current_site || 'Store'}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-650">
                          {tool.pending_return_date ? new Date(tool.pending_return_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {isOverdue ? (
                            <Badge className="bg-red-100 hover:bg-red-150 text-red-700 border-red-200 text-[10px] py-0.5 font-bold uppercase">
                              Overdue by {Math.abs(daysLeft)} Day{Math.abs(daysLeft) === 1 ? '' : 's'}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 hover:bg-amber-150 text-amber-700 border-amber-200 text-[10px] py-0.5 font-bold uppercase">
                              {daysLeft} Day{daysLeft === 1 ? '' : 's'} left
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-550 max-w-[150px] truncate" title={tool.pending_reason}>
                          {tool.pending_reason || 'N/A'}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenResolveModal(tool)}
                            className="h-7 text-xs px-2.5 bg-[#1E3A8A] hover:bg-blue-800 text-white font-medium"
                          >
                            Resolve Status
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="stolen">Stolen</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
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
                Despatch (OUT)
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
              <div className="max-h-[500px] overflow-x-auto overflow-y-auto [&>div]:overflow-visible">
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
                            onCheckedChange={() => {
                              const nativeEvent = window.event as MouseEvent | undefined;
                              toggleToolSelection(tool.id, nativeEvent?.shiftKey ?? false);
                            }}
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

      {/* Resolve Status Modal */}
      {selectedPendingTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1E3A8A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Resolve Tool Return Status</h3>
              <button 
                onClick={() => setSelectedPendingTool(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                <div className="font-semibold text-slate-800">{selectedPendingTool.description}</div>
                <div className="font-mono text-slate-500 mt-0.5">{selectedPendingTool.qr_code}</div>
                <div className="text-slate-500 mt-1">
                  Current reason: <span className="font-medium text-slate-700">{selectedPendingTool.pending_reason || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Resolution Action</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveAction('returned')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all ${
                      resolveAction === 'returned'
                        ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-100'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Returned
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveAction('pending')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all ${
                      resolveAction === 'pending'
                        ? 'bg-amber-550 border-amber-550 text-white shadow-sm shadow-amber-100'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                    }`}
                  >
                    Extend
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveAction('missing')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all ${
                      resolveAction === 'missing'
                        ? 'bg-red-600 border-red-600 text-white shadow-sm shadow-red-100'
                        : 'bg-white border-slate-200 text-slate-605 hover:bg-slate-50'
                    }`}
                  >
                    Missing
                  </button>
                </div>
              </div>

              {resolveAction === 'pending' && (
                <div className="space-y-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100/50 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-900">Extend By Days</label>
                    <Input
                      type="number"
                      min={1}
                      value={resolveDays}
                      onChange={(e) => setResolveDays(parseInt(e.target.value) || 0)}
                      className="bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-900">Reason for Extension</label>
                    <Input
                      placeholder="e.g. Subcontractor still working..."
                      value={resolveReason}
                      onChange={(e) => setResolveReason(e.target.value)}
                      className="bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}

              {resolveAction === 'returned' && (
                <div className="p-3 bg-green-50/50 rounded-lg border border-green-100 text-xs text-green-800">
                  <strong>Action:</strong> Tool status will be reset to <b>Usable</b>. It will be returned to store (<b>{storeLocation}</b>) and the subcontractor assignment will be cleared.
                </div>
              )}

              {resolveAction === 'missing' && (
                <div className="p-3 bg-red-50/50 rounded-lg border border-red-100 text-xs text-red-800">
                  <strong>Action:</strong> Tool will be permanently marked as <b>Missing</b>. This will be reflected in the Admin Dashboard.
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t">
              <Button 
                variant="outline" 
                onClick={() => setSelectedPendingTool(null)}
                disabled={resolveSubmitting}
              >
                Cancel
              </Button>
              <Button 
                className="bg-[#1E3A8A] hover:bg-blue-800 text-white"
                onClick={handleResolveSubmit}
                disabled={resolveSubmitting}
              >
                {resolveSubmitting ? 'Saving...' : 'Confirm Resolution'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreInventory;
