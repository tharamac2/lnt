import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  AlertTriangle,
  Clock,
  Wrench,
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';

import { useState, useEffect } from 'react';
import api from '../services/api';

// ... imports

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";

const Alerts = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/alerts/');
      setAlerts(response.data);
    } catch (error) {
      console.error("Failed to fetch alerts", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const sortedAlerts = [...alerts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const criticalAlerts = sortedAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = sortedAlerts.filter(a => a.severity === 'warning');
  const infoAlerts = sortedAlerts.filter(a => a.severity === 'info');
  const unreadCount = (list: any[]) => list.filter(a => !a.is_read).length;

  // Format date/time helper if needed, assuming backend returns ISO date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-[#DC2626] bg-red-50';
      case 'warning':
        return 'border-l-[#F59E0B] bg-amber-50';
      case 'info':
        return 'border-l-[#1E3A8A] bg-blue-50';
      default:
        return 'border-l-gray-300 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-[#DC2626]" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />;
      case 'info':
        return <CheckCircle className="w-5 h-5 text-[#1E3A8A]" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-[#DC2626]">Scrapped</Badge>;
      case 'warning':
        return <Badge className="bg-[#F59E0B]">Warning</Badge>;
      case 'info':
        return <Badge className="bg-[#1E3A8A]">Info</Badge>;
      default:
        return <Badge variant="secondary">Notice</Badge>;
    }
  };

  const handleMarkAsRead = async (id: number) => {
    // Optimistic update
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));

    // Only call API for persistent alerts (positive IDs)
    if (id > 0) {
      try {
        await api.post(`/alerts/${id}/read`);
        toast.success('Alert marked as read');
      } catch (error) {
        console.error("Failed to mark as read", error);
      }
    }
  };

  const handleResolve = (id: number) => {
    toast.success('Alert resolved');
  };

  const handleMarkAllAsRead = () => {
    toast.success('All alerts marked as read');
  };

  const handleViewDetails = (alert: any) => {
    setSelectedAlert(alert);
  };

  const AlertCard = ({ alert }: { alert: any }) => (
    <Card className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            {getSeverityIcon(alert.severity)}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[#0F172A]">{alert.title}</h3>
                  {getSeverityBadge(alert.severity)}
                </div>
                <p className="text-sm text-gray-600">{alert.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Wrench className="w-4 h-4" />
                <span className="font-mono">{alert.tool_id ? `Tool #${alert.tool_id}` : 'System'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{alert.site || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{formatDate(alert.date)} {formatTime(alert.date)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              {!alert.is_read && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkAsRead(alert.id)}
                >
                  Mark as Read
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => handleViewDetails(alert)}>
                View Details
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderPaginatedList = (list: any[]) => {
    const totalPages = Math.ceil(list.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedList = list.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="space-y-4">
        {paginatedList.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
        {list.length === 0 && <p className="text-gray-500 text-sm py-4">No alerts found.</p>}
        {list.length > 0 && (
          <div className="flex items-center justify-between gap-4 mt-4 px-2">
            <span className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, list.length)} of {list.length} alerts
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Alerts & Notifications</h1>
          <p className="text-gray-500 mt-1">Monitor critical events and warnings</p>
        </div>
        <Button variant="outline" onClick={handleMarkAllAsRead}>
          <CheckCircle className="w-4 h-4 mr-2" />
          Mark All as Read
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[#DC2626]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Scrapped Tools</p>
                <p className="text-3xl font-semibold mt-2">{unreadCount(criticalAlerts)}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-[#DC2626]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#F59E0B]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Warnings</p>
                <p className="text-3xl font-semibold mt-2">{unreadCount(warningAlerts)}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#1E3A8A]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Info Alerts</p>
                <p className="text-3xl font-semibold mt-2">{unreadCount(infoAlerts)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#1E3A8A]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            All ({sortedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="critical" className="data-[state=active]:bg-[#DC2626] data-[state=active]:text-white">
            Scrapped ({criticalAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="warning" className="data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white">
            Warnings ({warningAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="info" className="data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white">
            Info ({infoAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderPaginatedList(sortedAlerts)}
        </TabsContent>

        <TabsContent value="critical" className="space-y-4">
          {renderPaginatedList(criticalAlerts)}
        </TabsContent>

        <TabsContent value="warning" className="space-y-4">
          {renderPaginatedList(warningAlerts)}
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          {renderPaginatedList(infoAlerts)}
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedAlert && getSeverityIcon(selectedAlert.severity)}
              {selectedAlert?.title}
            </DialogTitle>
            <DialogDescription>
              Details of the triggered alert.
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-gray-50 border space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-900">Message</h4>
                  {getSeverityBadge(selectedAlert.severity)}
                </div>
                <p className="text-gray-700 leading-relaxed">{selectedAlert.message}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-500 text-xs">Tool ID</label>
                  <p className="font-medium text-gray-900">{selectedAlert.tool_id ? `Tool #${selectedAlert.tool_id}` : 'System'}</p>
                </div>
                <div>
                  <label className="text-gray-500 text-xs">Site Location</label>
                  <p className="font-medium text-gray-900">{selectedAlert.site || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-gray-500 text-xs">Date</label>
                  <p className="font-medium text-gray-900">{formatDate(selectedAlert.date)}</p>
                </div>
                <div>
                  <label className="text-gray-500 text-xs">Time</label>
                  <p className="font-medium text-gray-900">{formatTime(selectedAlert.date)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
