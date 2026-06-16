import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Wrench, Sliders, Trash2, Search, PlusCircle, AlertCircle, FileSpreadsheet, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

interface ToolInConfig {
  id: number;
  qr_code: string;
  is_printed: boolean;
  current_site: string | null;
  status: string;
}

interface ToolConfig {
  id: number;
  tool_name: string;
  item_code: string;
  is_verified: boolean;
  tools: ToolInConfig[];
  has_printed_tools: boolean;
}

const ToolConfigPage = () => {
  const [configs, setConfigs] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toolName, setToolName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<number[]>([]);

  // Verification & Import States
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/toolconfig/');
      setConfigs(response.data);
    } catch (error: any) {
      console.error('Failed to fetch tool configurations', error);
      toast.error('Failed to load tool configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleAddConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName.trim() || !itemCode.trim()) {
      toast.error('Please enter both Tool Name and Item Code');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/toolconfig/', {
        tool_name: toolName.trim(),
        item_code: itemCode.trim(),
      });
      toast.success('Tool configuration added successfully (Pending Verification)');
      setToolName('');
      setItemCode('');
      fetchConfigs();
    } catch (error: any) {
      console.error('Failed to add tool configuration', error);
      const detail = error.response?.data?.detail || 'Failed to add tool configuration';
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfig = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the configuration for "${name}"?\n\nWARNING: Doing so will also automatically delete all tools with this description in Tool Master (cascading delete)!`)) {
      return;
    }

    try {
      const response = await api.delete(`/toolconfig/${id}`);
      const deletedTools = response.data.cascaded_deleted_tools || 0;
      toast.success(`Tool configuration deleted successfully. ${deletedTools} matching tools soft-deleted in Tool Master.`);
      setSelectedIds(prev => prev.filter(rowId => rowId !== id));
      fetchConfigs();
    } catch (error: any) {
      console.error('Failed to delete tool configuration', error);
      toast.error(error.response?.data?.detail || 'Failed to delete tool configuration');
    }
  };

  const toggleRow = (id: number) => {
    if (expandedRowIds.includes(id)) {
      setExpandedRowIds(prev => prev.filter(rId => rId !== id));
    } else {
      setExpandedRowIds(prev => [...prev, id]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all filtered IDs
      setSelectedIds(filteredConfigs.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const handleVerifySelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('No configurations selected');
      return;
    }

    setIsVerifying(true);
    try {
      await api.post('/toolconfig/verify', { ids: selectedIds });
      toast.success('Selected tool configurations verified successfully!');
      setSelectedIds([]);
      fetchConfigs();
    } catch (error: any) {
      console.error('Failed to verify tool configurations', error);
      toast.error('Failed to verify configurations');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsImporting(true);
    try {
      const response = await api.post('/toolconfig/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success(response.data.message || 'Excel file imported successfully (Pending Verification)');
      fetchConfigs();
    } catch (error: any) {
      console.error('Failed to import Excel file', error);
      const detail = error.response?.data?.detail || 'Failed to import Excel file';
      toast.error(detail);
    } finally {
      setIsImporting(false);
      e.target.value = ''; // Reset input
    }
  };

  const filteredConfigs = configs.filter(
    (config) =>
      config.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.item_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected = filteredConfigs.length > 0 && filteredConfigs.every(c => selectedIds.includes(c.id));
  const someSelected = filteredConfigs.some(c => selectedIds.includes(c.id)) && !allSelected;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] flex items-center gap-2">
            <Sliders className="w-8 h-8 text-blue-600" />
            Tool Config
          </h1>
          <p className="text-gray-500 mt-1">
            Manage custom tool mappings. Upload bulk configurations via Excel, verify entries, or cascade deletions to Tool Master.
          </p>
        </div>

        {/* Bulk Import Button */}
        <div className="flex items-center gap-2">
          <Input
            id="import-excel"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileImport}
            className="hidden"
            disabled={isImporting}
          />
          <Label
            htmlFor="import-excel"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg cursor-pointer transition-colors duration-200"
          >
            <FileSpreadsheet className="w-5 h-5" />
            {isImporting ? 'Importing...' : 'Bulk Import Excel'}
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="xl:col-span-1">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-[#1E293B]">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                Add New Tool Config
              </CardTitle>
              <CardDescription>
                Define a new tool mapping manually. It will require verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddConfig} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="toolName" className="text-sm font-medium text-gray-700">
                    Tool Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="toolName"
                    placeholder="e.g. D SHACKLE 25T"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value.toUpperCase())}
                    className="w-full"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemCode" className="text-sm font-medium text-gray-700">
                    Item Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="itemCode"
                    placeholder="e.g. 2T11M05V3025000"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                    className="w-full"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {submitting ? 'Adding...' : 'Add Configuration'}
                </Button>
              </form>

              <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <span className="font-semibold block">Workflow Rules:</span>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Added/imported tools are marked as **Pending** first.</li>
                    <li>Select checkbox(es) and click **Verify Selected** to activate them.</li>
                    <li>Only verified tools will show up in the Tool Master form.</li>
                    <li>Deleting a config soft-deletes all matching tools in Tool Master.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: List Table Card */}
        <div className="xl:col-span-2">
          <Card className="border border-gray-100 shadow-sm h-full flex flex-col">
            <CardHeader className="border-b border-gray-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-medium text-[#1E293B]">
                    <Wrench className="w-5 h-5 text-blue-600" />
                    Tool List & Verification
                  </CardTitle>
                  <CardDescription>
                    Select unverified tools and click Verify to activate them.
                  </CardDescription>
                </div>
                {/* Verify Button */}
                {selectedIds.length > 0 && (
                  <Button
                    onClick={handleVerifySelected}
                    disabled={isVerifying}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-3 rounded-lg flex items-center gap-1.5 transition-all duration-200 animate-pulse text-xs h-8"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isVerifying ? 'Verifying...' : `Verify Selected (${selectedIds.length})`}
                  </Button>
                )}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tool or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 w-full h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col justify-between">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></span>
                  Loading tool configurations...
                </div>
              ) : filteredConfigs.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-100 rounded-lg">
                  <Sliders className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium text-gray-700">No configurations found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {searchQuery ? 'Try matching another search query' : 'Create your first tool mapping using the form or Excel.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[60px] font-semibold text-gray-600">S.No</TableHead>
                        <TableHead className="font-semibold text-gray-600">Tool Name</TableHead>
                        <TableHead className="font-semibold text-gray-600">Item Code</TableHead>
                        <TableHead className="font-semibold text-gray-600">Status</TableHead>
                        <TableHead className="w-[80px] text-right font-semibold text-gray-600">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConfigs.map((config, index) => {
                        const isSelected = selectedIds.includes(config.id);
                        const isExpanded = expandedRowIds.includes(config.id);
                        return (
                          <Fragment key={config.id}>
                            <TableRow className={`hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                                  checked={isSelected}
                                  onChange={(e) => handleSelectRow(config.id, e.target.checked)}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleRow(config.id)}
                                  className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                  title="View Associated Tools"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                              <TableCell className="font-semibold text-gray-800">{config.tool_name}</TableCell>
                              <TableCell className="font-mono text-xs text-blue-600 font-medium">{config.item_code}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={config.is_verified ? 'success' : 'warning'}
                                  className={
                                    config.is_verified
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-200'
                                  }
                                >
                                  {config.is_verified ? 'Verified' : 'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteConfig(config.id, config.tool_name)}
                                  disabled={config.has_printed_tools}
                                  className={`${
                                    config.has_printed_tools
                                      ? 'text-gray-300 cursor-not-allowed hover:bg-transparent'
                                      : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                  } transition-colors`}
                                  title={
                                    config.has_printed_tools
                                      ? 'Cannot delete configuration: matching tools have been printed'
                                      : 'Delete Configuration'
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-gray-50/40 hover:bg-gray-50/40">
                                <TableCell colSpan={7} className="p-4">
                                  <div className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                        <Wrench className="w-3.5 h-3.5 text-blue-600" />
                                        Associated Tools ({config.tools?.length || 0})
                                      </h4>
                                      {config.has_printed_tools && (
                                        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] py-0 px-2 font-normal">
                                          Contains Printed Tools (Deletion Blocked)
                                        </Badge>
                                      )}
                                    </div>
                                    {!config.tools || config.tools.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic pl-5">No tools generated yet for this configuration.</p>
                                    ) : (
                                      <div className="overflow-x-auto rounded-md border border-gray-100">
                                        <Table className="min-w-full">
                                          <TableHeader className="bg-gray-50/60">
                                            <TableRow>
                                              <TableHead className="py-2 text-[10px] font-semibold text-gray-500 w-[60px]">S.No</TableHead>
                                              <TableHead className="py-2 text-[10px] font-semibold text-gray-500">QR Code</TableHead>
                                              <TableHead className="py-2 text-[10px] font-semibold text-gray-500">Location</TableHead>
                                              <TableHead className="py-2 text-[10px] font-semibold text-gray-500">Status</TableHead>
                                              <TableHead className="py-2 text-[10px] font-semibold text-gray-500 w-[100px]">Printed</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {config.tools.map((tool, idx) => (
                                              <TableRow key={tool.id} className="hover:bg-gray-50/20">
                                                <TableCell className="py-1.5 text-xs text-gray-500">{idx + 1}</TableCell>
                                                <TableCell className="py-1.5 text-xs font-mono font-medium text-gray-800">{tool.qr_code}</TableCell>
                                                <TableCell className="py-1.5 text-xs text-gray-600">{tool.current_site || '-'}</TableCell>
                                                <TableCell className="py-1.5 text-xs">
                                                  <Badge
                                                    variant={tool.status === 'usable' ? 'success' : 'destructive'}
                                                    className={`text-[9px] px-1.5 py-0 ${
                                                      tool.status === 'usable'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50'
                                                        : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-50'
                                                    }`}
                                                  >
                                                    {tool.status}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs">
                                                  <Badge
                                                    variant={tool.is_printed ? 'success' : 'secondary'}
                                                    className={`text-[9px] px-1.5 py-0 ${
                                                      tool.is_printed
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50'
                                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                  >
                                                    {tool.is_printed ? 'Printed' : 'Unprinted'}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ToolConfigPage;
