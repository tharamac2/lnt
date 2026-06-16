import { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  History,
  Search,
  Package,
  ArrowRightLeft,
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  X,
  Clock,
  User,
  Activity,
  ArrowDownCircle,
  TrendingDown
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';

interface Tool {
  id: number;
  description: string;
  make: string;
  capacity: string;
  safe_working_load: string;
  tool_type: string;
  metal_type: string;
  tool_variant: string;
  item_code: string | null;
  purchaser_name: string | null;
  purchaser_contact: string | null;
  supplier_code: string | null;
  test_certificate: string | null;
  date_of_supply: string | null;
  last_inspection_date: string | null;
  inspection_result: string;
  usability_percentage: number | null;
  validity_period: number | null;
  subcontractor_name: string | null;
  subcontractor_code: string | null;
  subcontractor_mobile: string | null;
  remarks: string | null;
  previous_site: string | null;
  current_site: string | null;
  next_site: string | null;
  job_code: string | null;
  job_description: string | null;
  qr_code: string;
  status: string;
  expiry_date: string | null;
  debit_to: string | null;
  created_at: string;
  created_by_id: number | null;
  is_printed: boolean;
}

interface Movement {
  id: number;
  tool_id: number;
  from_site: string | null;
  to_site: string | null;
  timestamp: string;
  remarks: string | null;
  user_id: number | null;
  user?: {
    username: string;
    full_name: string | null;
  } | null;
}

interface Inspection {
  id: number;
  tool_id: number;
  date: string;
  result: string;
  usability_percentage: number | null;
  remarks: string | null;
  inspector_id: number;
  inspector?: {
    username: string;
    full_name: string | null;
  } | null;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'registration' | 'movement' | 'inspection' | 'status_change';
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  details: React.ReactNode;
  remarks: string | null;
}

const ToolHistoryPage = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Lifecycle detail modal state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchTools = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tools/');
      setTools(response.data);
    } catch (error) {
      console.error("Failed to fetch tools list", error);
      toast.error("Failed to load tools directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleTrackTool = async (tool: Tool) => {
    setSelectedTool(tool);
    setLoadingHistory(true);
    setIsDetailOpen(true);
    try {
      const [movementsRes, inspectionsRes] = await Promise.all([
        api.get(`/movements/${tool.id}`),
        api.get(`/inspections/tool/${tool.id}`)
      ]);
      setMovements(movementsRes.data);
      setInspections(inspectionsRes.data);
    } catch (error) {
      console.error("Failed to load tool history details", error);
      toast.error("Failed to fetch tool timeline details");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Compile unified chronological timeline events
  const getTimelineEvents = (tool: Tool): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // 1. Tool Registration Event
    events.push({
      id: `reg-${tool.id}`,
      timestamp: new Date(tool.created_at),
      type: 'registration',
      title: 'Tool Registered',
      icon: <Package className="w-4 h-4 text-white" />,
      colorClass: 'bg-blue-600',
      details: (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            Initial registration site: <strong className="text-gray-700">{tool.current_site || 'Store'}</strong>
          </p>
          <p className="text-xs text-gray-500">
            Status: <span className="text-green-700 font-semibold uppercase">{tool.status}</span>
          </p>
          {tool.is_printed && (
            <Badge className="bg-green-500 text-[10px] scale-90 origin-left">QR Code Printed</Badge>
          )}
        </div>
      ),
      remarks: tool.remarks || 'Tool added to inventory database.'
    });

    // 2. Movements / Site Transfers / Subcontractor Issue-Return
    movements.forEach((mov) => {
      let title = 'Site Movement';
      let icon = <ArrowRightLeft className="w-4 h-4 text-white" />;
      let colorClass = 'bg-[#1E3A8A]'; // dark blue
      let detailsText = '';

      const isSubconTo = mov.to_site?.toLowerCase().includes('sub-contractor');
      const isSubconFrom = mov.from_site?.toLowerCase().includes('sub-contractor');

      if (isSubconTo) {
        title = 'Issued to Sub-contractor';
        icon = <User className="w-4 h-4 text-white" />;
        colorClass = 'bg-indigo-600';
        detailsText = `Issued to ${mov.to_site} from ${mov.from_site || 'Store'}`;
      } else if (isSubconFrom) {
        title = 'Returned from Sub-contractor';
        icon = <ArrowDownCircle className="w-4 h-4 text-white" />;
        colorClass = 'bg-emerald-600';
        detailsText = `Returned to ${mov.to_site || 'Store'} from ${mov.from_site}`;
      } else {
        detailsText = `Transferred from ${mov.from_site || '-'} to ${mov.to_site || '-'}`;
      }

      events.push({
        id: `mov-${mov.id}`,
        timestamp: new Date(mov.timestamp),
        type: 'movement',
        title,
        icon,
        colorClass,
        details: (
          <div className="space-y-1">
            <p className="text-xs text-gray-700 font-medium">{detailsText}</p>
            {mov.user && (
              <p className="text-[11px] text-gray-405">
                Action by: {mov.user.full_name || mov.user.username}
              </p>
            )}
          </div>
        ),
        remarks: mov.remarks
      });
    });

    // 3. Inspections
    inspections.forEach((ins) => {
      let icon = <ClipboardCheck className="w-4 h-4 text-white" />;
      let colorClass = 'bg-green-600';
      if (ins.result === 'fail' || ins.result === 'scrap') {
        colorClass = 'bg-red-600';
      } else if (ins.result === 'repair' || ins.result === 'conditional') {
        colorClass = 'bg-amber-500';
      }

      events.push({
        id: `ins-${ins.id}`,
        timestamp: new Date(ins.date),
        type: 'inspection',
        title: 'Safety Inspection',
        icon,
        colorClass,
        details: (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Result:</span>
              <Badge className={`text-[10px] capitalize ${
                ins.result === 'pass' ? 'bg-green-600' : ins.result === 'repair' ? 'bg-amber-500' : 'bg-red-600'
              }`}>
                {ins.result}
              </Badge>
              {ins.usability_percentage !== null && (
                <span className="text-xs text-gray-500">({ins.usability_percentage}% Usability)</span>
              )}
            </div>
            {ins.inspector && (
              <p className="text-[11px] text-gray-405">
                Inspected by: {ins.inspector.full_name || ins.inspector.username}
              </p>
            )}
          </div>
        ),
        remarks: ins.remarks
      });
    });

    // Sort chronologically descending (latest events first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'usable': return 'bg-green-100 text-green-800 border-green-200';
      case 'under-repair': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'scrap':
      case 'scrapped': return 'bg-red-100 text-red-800 border-red-200';
      case 'missing': return 'bg-orange-100 text-orange-850 border-orange-200';
      case 'stolen': return 'bg-neutral-800 text-white';
      default: return 'bg-gray-150 text-gray-700';
    }
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch =
      tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.qr_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tool.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A] flex items-center gap-2">
          <History className="w-8 h-8 text-[#1E3A8A]" />
          Tool History
        </h1>
        <p className="text-gray-500 mt-1">
          Trace the complete chronological tracking lifecycle of inventory tools, from registration to current site status, subcontractor liability, inspections, and disposal.
        </p>
      </div>

      {/* Filter and List Card */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="border-b border-gray-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-medium text-[#1E293B]">Tools Inventory Lifecycle Directory</CardTitle>
            <CardDescription>Click on any tool to open overall tracking timeline.</CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search description or QR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 h-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] w-full sm:w-40"
            >
              <option value="all">All Statuses</option>
              <option value="usable">Usable</option>
              <option value="under-repair">Under Repair</option>
              <option value="scrap">Scrap</option>
              <option value="scrapped">Scrapped</option>
              <option value="missing">Missing</option>
              <option value="stolen">Stolen</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A8A] mb-4"></span>
              Loading tools directory...
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-lg">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No tools found</p>
              <p className="text-sm text-gray-400 mt-1">Try matching another search query or filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[60px] font-semibold text-gray-600">S.No</TableHead>
                    <TableHead className="font-semibold text-gray-600">Tool Name</TableHead>
                    <TableHead className="font-semibold text-gray-600">QR Code</TableHead>
                    <TableHead className="font-semibold text-gray-600">Make / Capacity</TableHead>
                    <TableHead className="font-semibold text-gray-600">Current Site / Subcontractor</TableHead>
                    <TableHead className="font-semibold text-gray-600">Status</TableHead>
                    <TableHead className="w-[140px] text-right font-semibold text-gray-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map((tool, index) => (
                    <TableRow key={tool.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-gray-800">{tool.description}</TableCell>
                      <TableCell className="font-mono text-xs text-indigo-600 font-semibold">{tool.qr_code}</TableCell>
                      <TableCell className="text-sm text-gray-650">
                        {tool.make} • {tool.capacity}
                      </TableCell>
                      <TableCell className="text-sm text-gray-655 font-medium">
                        <div>{tool.current_site || '-'}</div>
                        {tool.subcontractor_name && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Subcon: <span className="font-medium text-gray-600">{tool.subcontractor_name}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`font-semibold capitalize border ${getStatusBadgeColor(tool.status)}`}
                        >
                          {tool.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-medium flex items-center gap-1.5 ml-auto"
                          onClick={() => handleTrackTool(tool)}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          Track Lifecycle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>      {/* Lifecycle Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-6xl sm:max-w-6xl w-[90vw] max-h-[90vh] overflow-y-auto bg-slate-50">
          <DialogHeader className="bg-white p-6 border-b border-gray-150 rounded-t-lg -mx-6 -mt-6">
            <DialogTitle className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <History className="w-5.5 h-5.5 text-[#1E3A8A]" />
                <div className="text-left">
                  <h2 className="text-lg font-bold text-gray-800 leading-tight">Lifecycle Tracking Timeline</h2>
                  <p className="text-xs text-gray-400 font-medium">QR: <span className="font-mono font-bold text-indigo-600">{selectedTool?.qr_code}</span></p>
                </div>
              </div>
              {selectedTool && (
                <Badge className={`mr-6 capitalize text-xs px-3 py-1 font-bold border ${getStatusBadgeColor(selectedTool.status)}`}>
                  Status: {selectedTool.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <span className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1E3A8A] mb-4"></span>
              Compiling tool history and records...
            </div>
          ) : selectedTool ? (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Tool Specs Card */}
              <div className="lg:col-span-1 space-y-4">
                {/* Specs Card */}
                <Card className="border border-gray-100 shadow-sm bg-white">
                  <CardHeader className="bg-gray-50/50 pb-3 border-b border-gray-100">
                    <CardTitle className="text-sm font-bold text-gray-750 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#1E3A8A]" />
                      Tool Parameters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3.5 text-xs text-gray-650">
                    <div>
                      <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Name / Description</span>
                      <span className="font-bold text-gray-800 text-sm block mt-0.5">{selectedTool.description}</span>
                    </div>

                    <div className="space-y-2.5 pt-2.5 border-t border-dashed">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Make</span>
                        <span className="font-bold text-gray-800">{selectedTool.make}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Capacity</span>
                        <span className="font-bold text-gray-800">{selectedTool.capacity}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">SWL</span>
                        <span className="font-bold text-[#1E3A8A]">{selectedTool.safe_working_load}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Expiry Date</span>
                        <span className="font-bold text-gray-800">{selectedTool.expiry_date ? new Date(selectedTool.expiry_date).toLocaleDateString() : '-'}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-dashed space-y-1">
                      <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Supplier Name</span>
                      <span className="font-semibold text-gray-800 block">{selectedTool.purchaser_name || '-'}</span>
                      {selectedTool.supplier_code && (
                        <span className="block text-[10px] text-gray-450">Code: {selectedTool.supplier_code}</span>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-dashed space-y-2">
                      <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Site Locations</span>
                      <div className="flex flex-col gap-2">
                        <div className="bg-gray-50/70 p-2 rounded border border-gray-100 flex justify-between items-center gap-4">
                          <span className="text-gray-400 text-[9px] uppercase font-bold">Previous Site</span>
                          <span className="font-semibold text-gray-700 truncate">{selectedTool.previous_site || '-'}</span>
                        </div>
                        <div className="bg-blue-50/50 text-blue-900 p-2 rounded border border-blue-100 flex justify-between items-center gap-4">
                          <span className="text-blue-450 text-[9px] uppercase font-bold">Current Site</span>
                          <span className="font-bold truncate">{selectedTool.current_site || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {selectedTool.subcontractor_name && (
                      <div className="pt-2.5 border-t border-dashed bg-slate-50/50 p-2.5 rounded border border-slate-100 space-y-1.5">
                        <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Current Holder (Sub-contractor)</span>
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-gray-800">{selectedTool.subcontractor_name}</span>
                          {selectedTool.subcontractor_code && (
                            <span className="text-[10px] font-mono text-gray-450 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                              {selectedTool.subcontractor_code}
                            </span>
                          )}
                        </div>
                        {selectedTool.subcontractor_mobile && (
                          <div className="flex justify-between items-center text-[10px] text-gray-450 pt-1 border-t border-slate-200/50">
                            <span>Contact</span>
                            <span className="font-medium text-gray-600">{selectedTool.subcontractor_mobile}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* QR Code Card */}
                <Card className="border border-gray-100 shadow-sm bg-white flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">QR Label Reference</span>
                  <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-xs">
                    <QRCodeCanvas
                      value={`${window.location.origin}/view-tool/${selectedTool.qr_code}`}
                      size={110}
                      level={"H"}
                      includeMargin={true}
                    />
                  </div>
                  <span className="font-mono text-xs text-gray-505 font-bold mt-2">{selectedTool.qr_code}</span>
                </Card>
              </div>

              {/* Right Column: Timeline Box */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Missing Status Alert */}
                {(selectedTool.status.toLowerCase() === 'missing' || selectedTool.status.toLowerCase() === 'stolen') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-sm text-red-900 uppercase tracking-wide">⚠️ Tool Reported {selectedTool.status}</h4>
                      <p className="text-xs text-red-700 mt-1 leading-relaxed">
                        This tool was not returned to the store and is currently missing. 
                        Liability has been officially debited to: <strong className="text-red-950 underline">{selectedTool.debit_to || selectedTool.subcontractor_name || 'Unspecified Entity'}</strong>.
                      </p>
                      {selectedTool.subcontractor_name && (
                        <p className="text-[11px] text-red-600 mt-1.5 font-medium">
                          Last Contractor Possession: {selectedTool.subcontractor_name} 
                          {selectedTool.subcontractor_mobile && ` (Phone: ${selectedTool.subcontractor_mobile})`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline Card */}
                <Card className="border border-gray-100 shadow-sm bg-white flex-1">
                  <CardHeader className="bg-gray-50/50 pb-3 border-b border-gray-100">
                    <CardTitle className="text-sm font-bold text-gray-750 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1E3A8A]" />
                      Chronological Lifecycle Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="relative pl-6 border-l border-gray-200 ml-3 space-y-8">
                      {getTimelineEvents(selectedTool).map((event) => (
                        <div key={event.id} className="relative group animate-in fade-in slide-in-from-left-2 duration-300">
                          {/* Event Icon Pin */}
                          <span className={`absolute -left-[34px] top-0.5 rounded-full p-1.5 flex items-center justify-center shadow-sm ${event.colorClass} border border-white ring-4 ring-white`}>
                            {event.icon}
                          </span>

                          {/* Event Info Card */}
                          <div className="bg-slate-50/50 hover:bg-slate-55 p-4.5 rounded-xl border border-gray-150 transition-colors shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-gray-100/60 mb-2.5">
                              <h5 className="font-bold text-sm text-gray-800">{event.title}</h5>
                              <span className="text-[10.5px] text-gray-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {event.timestamp.toLocaleString()}
                              </span>
                            </div>

                            <div className="text-xs text-gray-650">
                              {event.details}
                            </div>

                            {event.remarks && (
                              <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200/80 bg-white/60 p-2 rounded">
                                <span className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remarks</span>
                                <p className="text-[11.5px] text-gray-600 italic leading-relaxed">
                                  &ldquo;{event.remarks}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ToolHistoryPage;
