import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Truck,
  Users,
  Trash2,
  Search,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  Mail,
  Phone,
  MapPin,
  Sliders,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Plus,
  Trash,
  Upload,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

interface Dealer {
  id: number;
  category: string;
  name: string;
  company_name: string;
  dealer_code: string;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  gst_number: string | null;
  products_services: string | null;
  status: string;
  custom_fields: string | null; // JSON string of custom fields
}

// Category-specific labels for the "name"/"code" fields
const CATEGORY_LABELS: Record<string, { name: string; namePlaceholder: string; code: string; codePlaceholder: string }> = {
  sub_contractor: {
    name: 'Sub Contractor Name',
    namePlaceholder: 'e.g. ABC Erectors',
    code: 'Sub Contractor Code',
    codePlaceholder: 'e.g. SUBCON101',
  },
  supplier: {
    name: 'Supplier Name',
    namePlaceholder: 'e.g. ABC Tools Supplies',
    code: 'Supplier Code',
    codePlaceholder: 'e.g. SUP101',
  },
  scrap_dealer: {
    name: 'Scrap Vendor Name',
    namePlaceholder: 'e.g. ABC Scrap Traders',
    code: 'Scrap Vendor Code',
    codePlaceholder: 'e.g. SCRAP101',
  },
};

// Category-specific Products/Services dropdown options
const PRODUCTS_SERVICES_OPTIONS: Record<string, string[]> = {
  sub_contractor: ['Erection Work', 'Civil Work', 'Electrical Work', 'Mechanical Work', 'Painting', 'Scaffolding', 'Welding & Fabrication', 'Other'],
  supplier: ['Tools & Equipment', 'Spare Parts', 'Safety Equipment (PPE)', 'Consumables', 'Lubricants & Chemicals', 'Construction Materials', 'Other'],
  scrap_dealer: ['Ferrous Scrap', 'Non-Ferrous Scrap', 'E-Waste', 'Used Tools & Machinery', 'Mixed Scrap', 'Other'],
};

interface CustomFieldDef {
  id: number;
  name: string;
  field_type: 'text' | 'number' | 'file' | 'radio' | 'checkbox' | 'checkboxes';
  is_required: boolean;
  options: string | null;
}

const DealersPage = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('sub_contractor');

  // Form States
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dealerCode, setDealerCode] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [productsServices, setProductsServices] = useState('');
  const [dealerStatus, setDealerStatus] = useState('active');
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Custom Field Form state (for creating a custom field)
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'file' | 'radio' | 'checkbox' | 'checkboxes'>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [savingField, setSavingField] = useState(false);

  // UI States
  const [expandedDealerId, setExpandedDealerId] = useState<number | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const fetchDealers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dealers/');
      setDealers(response.data);
    } catch (error: any) {
      console.error('Failed to fetch dealers', error);
      toast.error('Failed to load dealers list');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFieldDefs = async () => {
    try {
      const response = await api.get('/dealers/custom-fields');
      setCustomFieldDefs(response.data);
    } catch (error) {
      console.error('Failed to fetch custom field definitions', error);
    }
  };

  useEffect(() => {
    fetchDealers();
    fetchCustomFieldDefs();
  }, []);

  // Reset Products/Services selection when the category changes (options differ per category)
  useEffect(() => {
    setProductsServices('');
  }, [category]);

  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !companyName.trim() || !dealerCode.trim()) {
      toast.error('Please fill in Name, Company Name, and Dealer Code');
      return;
    }

    // Validate required custom fields
    for (const fdef of customFieldDefs) {
      if (fdef.is_required && (!customValues[fdef.name] || !customValues[fdef.name].toString().trim())) {
        toast.error(`Custom field "${fdef.name}" is required`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payloadCustomFields = Object.keys(customValues).length > 0 ? JSON.stringify(customValues) : null;

      await api.post('/dealers/', {
        category,
        name: name.trim(),
        company_name: companyName.trim(),
        dealer_code: dealerCode.trim().toUpperCase(),
        email: email.trim() || null,
        contact_number: contactNumber.trim() || null,
        address: address.trim() || null,
        gst_number: gstNumber.trim() || null,
        products_services: productsServices || null,
        status: dealerStatus,
        custom_fields: payloadCustomFields
      });
      toast.success('Dealer registered successfully!');

      // Clear fields
      setName('');
      setCompanyName('');
      setDealerCode('');
      setEmail('');
      setContactNumber('');
      setAddress('');
      setGstNumber('');
      setProductsServices('');
      setDealerStatus('active');
      setCustomValues({});

      fetchDealers();
    } catch (error: any) {
      console.error('Failed to register dealer', error);
      const detail = error.response?.data?.detail || 'Failed to register dealer';
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDealer = async (id: number, dealerName: string) => {
    if (!window.confirm(`Are you sure you want to delete dealer "${dealerName}"?`)) {
      return;
    }

    try {
      await api.delete(`/dealers/${id}`);
      toast.success('Dealer deleted successfully.');
      if (expandedDealerId === id) {
        setExpandedDealerId(null);
      }
      fetchDealers();
    } catch (error: any) {
      console.error('Failed to delete dealer', error);
      toast.error('Failed to delete dealer');
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsImporting(true);
    try {
      const response = await api.post('/dealers/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success(response.data.message || 'Excel file imported successfully');
      fetchDealers();
    } catch (error: any) {
      console.error('Failed to import Excel file', error);
      const detail = error.response?.data?.detail || 'Failed to import Excel file';
      toast.error(detail);
    } finally {
      setIsImporting(false);
      e.target.value = ''; // Reset input
    }
  };

  // Custom Fields Builder Operations
  const handleCreateCustomField = async () => {
    if (!newFieldName.trim()) {
      toast.error('Field name is required');
      return;
    }
    const isMultiOption = newFieldType === 'radio' || newFieldType === 'checkboxes';
    if (isMultiOption && !newFieldOptions.trim()) {
      toast.error(`Options are required for ${newFieldType} fields`);
      return;
    }
    setSavingField(true);
    try {
      await api.post('/dealers/custom-fields', {
        name: newFieldName.trim(),
        field_type: newFieldType,
        is_required: newFieldRequired,
        options: isMultiOption ? newFieldOptions.trim() : null
      });
      toast.success('Custom field template added successfully');
      setNewFieldName('');
      setNewFieldRequired(false);
      setNewFieldOptions('');
      setShowFieldBuilder(false);
      fetchCustomFieldDefs();
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail || 'Failed to add custom field';
      toast.error(detail);
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteCustomField = async (id: number, fieldName: string) => {
    if (!window.confirm(`Are you sure you want to delete the custom field template "${fieldName}"?\nThis won't delete data already stored on existing dealers, but the field will no longer appear in the registration form.`)) {
      return;
    }
    try {
      await api.delete(`/dealers/custom-fields/${id}`);
      toast.success('Custom field template deleted successfully.');
      fetchCustomFieldDefs();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete custom field template');
    }
  };

  const handleCustomFileUpload = async (fieldName: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingField(fieldName);
    try {
      const response = await api.post('/upload/certificate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setCustomValues(prev => ({
        ...prev,
        [fieldName]: response.data.url
      }));
      toast.success(`${fieldName} uploaded successfully`);
    } catch (error) {
      console.error('Failed to upload file', error);
      toast.error(`Failed to upload ${fieldName}`);
    } finally {
      setUploadingField(null);
    }
  };

  const filteredDealers = dealers.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.dealer_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const subContractors = filteredDealers.filter(d => d.category === 'sub_contractor');
  const suppliers = filteredDealers.filter(d => d.category === 'supplier');
  const scrapDealers = filteredDealers.filter(d => d.category === 'scrap_dealer');

  const renderDealerTable = (list: Dealer[], categoryName: string) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-100 rounded-lg">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">No {categoryName} found</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery ? 'Try matching another search query' : `Register your first ${categoryName} manually or via Excel.`}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[60px] font-semibold text-gray-600">S.No</TableHead>
              <TableHead className="font-semibold text-gray-600">Contact Person</TableHead>
              <TableHead className="font-semibold text-gray-600">Name</TableHead>
              <TableHead className="font-semibold text-gray-600">Code</TableHead>
              <TableHead className="font-semibold text-gray-600">GST Number</TableHead>
              <TableHead className="font-semibold text-gray-600">Contact</TableHead>
              <TableHead className="font-semibold text-gray-600">Status</TableHead>
              <TableHead className="w-[80px] text-right font-semibold text-gray-600">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((dealer, index) => {
              const isExpanded = expandedDealerId === dealer.id;
              let customFieldsObj: Record<string, any> = {};
              if (dealer.custom_fields) {
                try {
                  customFieldsObj = JSON.parse(dealer.custom_fields);
                } catch (e) {
                  console.error('Failed to parse custom fields JSON', e);
                }
              }
              return (
                <Fragment key={dealer.id}>
                  <TableRow
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedDealerId(isExpanded ? null : dealer.id)}
                  >
                    <TableCell className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7"
                        onClick={() => setExpandedDealerId(isExpanded ? null : dealer.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                    <TableCell className="font-semibold text-gray-850">{dealer.name}</TableCell>
                    <TableCell className="text-gray-600 font-medium">{dealer.company_name}</TableCell>
                    <TableCell className="font-mono text-xs text-indigo-600 font-semibold">{dealer.dealer_code}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{dealer.gst_number || '-'}</TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {dealer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{dealer.email}</span>
                        </div>
                      )}
                      {dealer.contact_number && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{dealer.contact_number}</span>
                        </div>
                      )}
                      {!dealer.email && !dealer.contact_number && '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={dealer.status === 'inactive'
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-green-100 text-green-700'}
                      >
                        {dealer.status === 'inactive' ? 'Inactive' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDealer(dealer.id, dealer.name)}
                        className="text-red-500 hover:text-red-750 hover:bg-red-50 transition-colors"
                        title="Delete Dealer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableCell colSpan={9} className="p-4 border-t border-slate-100">
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          {/* Address & Products/Services details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start gap-2.5 text-xs text-slate-600">
                              <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-slate-700 block mb-0.5">Location</span>
                                {dealer.address || 'No location provided'}
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 text-xs text-slate-600">
                              <Truck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-slate-700 block mb-0.5">Products/Services</span>
                                {dealer.products_services || 'Not specified'}
                              </div>
                            </div>
                          </div>

                          {/* Custom Fields details */}
                          <div className="border-t border-slate-200/50 pt-3">
                            <span className="font-semibold text-slate-700 text-xs block mb-2.5">
                              Custom Field Parameters
                            </span>
                            {Object.keys(customFieldsObj).length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(customFieldsObj).map(([key, val]) => {
                                  const isFile = typeof val === 'string' && val.startsWith('/api/uploads/');
                                  return (
                                    <div
                                      key={key}
                                      className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                                          {key}
                                        </span>
                                        {isFile ? (
                                          <span className="text-xs text-indigo-600 font-medium truncate block max-w-[170px]" title={val.split('/').pop()}>
                                            {val.split('/').pop()}
                                          </span>
                                        ) : typeof val === 'boolean' ? (
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${val ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {val ? 'Yes' : 'No'}
                                          </span>
                                        ) : Array.isArray(val) ? (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {val.map((item) => (
                                              <span key={item} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-55 text-indigo-750 border border-indigo-100/60">
                                                {item}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-xs font-semibold text-slate-700 block truncate max-w-[170px]" title={String(val)}>
                                            {String(val)}
                                          </span>
                                        )}
                                      </div>
                                      {isFile && (
                                        <a
                                          href={val}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-md font-semibold transition-colors shrink-0 flex items-center gap-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          View File
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">No custom fields filled for this dealer.</p>
                            )}
                          </div>
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] flex items-center gap-2">
            <Building2 className="w-8 h-8 text-indigo-600" />
            Add Dealers
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your project sub-contractors, tool suppliers, and scrap dealers. Add them manually or import via Excel templates.
          </p>
        </div>

        {/* Bulk Import Button */}
        <div className="flex items-center gap-2">
          <Input
            id="import-excel-dealers"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileImport}
            className="hidden"
            disabled={isImporting}
          />
          <Label
            htmlFor="import-excel-dealers"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg cursor-pointer transition-colors duration-200"
          >
            <FileSpreadsheet className="w-5 h-5" />
            {isImporting ? 'Importing...' : 'Bulk Import Excel'}
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Panel */}
        <div className="lg:col-span-1">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-[#1E293B]">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                Register New Dealer
              </CardTitle>
              <CardDescription>
                Fill in the details to add a new contractor, supplier, or dealer.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddDealer} className="space-y-4">
                
                {/* Dynamic Google Forms Builder Card */}
                <div className="bg-slate-55 p-3 rounded-lg border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                      <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                      Add Custom Field
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFieldBuilder(!showFieldBuilder)}
                      className="text-xs h-7 px-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showFieldBuilder ? 'Close Builder' : 'New Field'}
                    </Button>
                  </div>

                  {showFieldBuilder && (
                    <div className="bg-white p-3 rounded-md border border-slate-100 shadow-xs space-y-3 animate-in fade-in duration-200">
                      <div className="space-y-1">
                        <Label htmlFor="customFieldName" className="text-xs font-semibold text-slate-600">Field Name</Label>
                        <Input
                          id="customFieldName"
                          placeholder="e.g. License Attachment"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="customFieldType" className="text-xs font-semibold text-slate-600">Type</Label>
                          <select
                            id="customFieldType"
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as any)}
                            className="w-full h-8 px-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            <option value="text">Alphabet / Text</option>
                            <option value="number">Numeric</option>
                            <option value="file">File / Image Upload</option>
                            <option value="radio">Radio Buttons (Single Select)</option>
                            <option value="checkbox">Checkbox (Toggle)</option>
                            <option value="checkboxes">Checkboxes (Multiple Select)</option>
                          </select>
                        </div>
                        <div className="flex items-center space-x-2 pt-6">
                          <input
                            type="checkbox"
                            id="customFieldRequired"
                            checked={newFieldRequired}
                            onChange={(e) => setNewFieldRequired(e.target.checked)}
                            className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <Label htmlFor="customFieldRequired" className="text-xs font-semibold text-slate-600 select-none cursor-pointer">
                            Required
                          </Label>
                        </div>
                      </div>
                      
                      {(newFieldType === 'radio' || newFieldType === 'checkboxes') && (
                        <div className="space-y-1">
                          <Label htmlFor="customFieldOptions" className="text-xs font-semibold text-slate-600">
                            Options (comma-separated) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="customFieldOptions"
                            placeholder="e.g. Option A, Option B, Option C"
                            value={newFieldOptions}
                            onChange={(e) => setNewFieldOptions(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      )}

                      <Button
                        type="button"
                        onClick={handleCreateCustomField}
                        disabled={savingField}
                        className="w-full h-8 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold rounded transition-colors"
                      >
                        {savingField ? 'Adding Field...' : 'Save Field Template'}
                      </Button>
                    </div>
                  )}

                  {/* Render list of defined fields */}
                  {customFieldDefs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Configured Fields</p>
                      <div className="flex flex-wrap gap-1">
                        {customFieldDefs.map((fdef) => (
                          <span
                            key={fdef.id}
                            className="inline-flex items-center gap-1 bg-white border border-slate-200 pl-2 pr-1 py-0.5 rounded text-[10.5px] font-medium text-slate-600 shadow-2xs"
                          >
                            <span>{fdef.name}</span>
                            <span className="text-[8.5px] text-indigo-500 font-mono">({fdef.field_type})</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomField(fdef.id, fdef.name)}
                              className="text-slate-400 hover:text-red-650 transition-colors ml-1 font-bold text-xs"
                              title="Delete Field"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Selector */}
                <div className="space-y-2">
                  <Label htmlFor="dealerCategory" className="text-sm font-medium text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="dealerCategory"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="sub_contractor">Sub Contractor</option>
                    <option value="supplier">Supplier</option>
                    <option value="scrap_dealer">Scrap Dealer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                    {CATEGORY_LABELS[category].name} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    placeholder={CATEGORY_LABELS[category].namePlaceholder}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealerCode" className="text-sm font-medium text-gray-700">
                    {CATEGORY_LABELS[category].code} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dealerCode"
                    placeholder={CATEGORY_LABELS[category].codePlaceholder}
                    value={dealerCode}
                    onChange={(e) => setDealerCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealerName" className="text-sm font-medium text-gray-700">
                    Contact Person <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dealerName"
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700">
                    Mobile No
                  </Label>
                  <Input
                    id="contactNumber"
                    placeholder="e.g. +91 9876543210"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mailId" className="text-sm font-medium text-gray-700">
                    Email ID
                  </Label>
                  <Input
                    id="mailId"
                    type="email"
                    placeholder="e.g. contact@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Location
                  </Label>
                  <Input
                    id="address"
                    placeholder="e.g. Mumbai, Maharashtra"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gstNumber" className="text-sm font-medium text-gray-700">
                    GST No
                  </Label>
                  <Input
                    id="gstNumber"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productsServices" className="text-sm font-medium text-gray-700">
                    Products/Services
                  </Label>
                  <select
                    id="productsServices"
                    value={productsServices}
                    onChange={(e) => setProductsServices(e.target.value)}
                    className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Products/Services</option>
                    {PRODUCTS_SERVICES_OPTIONS[category].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealerStatus" className="text-sm font-medium text-gray-700">
                    Status
                  </Label>
                  <select
                    id="dealerStatus"
                    value={dealerStatus}
                    onChange={(e) => setDealerStatus(e.target.value)}
                    className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Render Custom Fields dynamically in Dealer Form */}
                {customFieldDefs.length > 0 && (
                  <div className="border-t border-slate-100 pt-3.5 space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Fields</p>
                    {customFieldDefs.map((fdef) => {
                      const val = customValues[fdef.name] || '';
                      const isRequired = fdef.is_required;
                      return (
                        <div key={fdef.id} className="space-y-1.5">
                          <Label htmlFor={`custom-${fdef.id}`} className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                            <span>
                              {fdef.name} {isRequired && <span className="text-red-500">*</span>}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono capitalize">({fdef.field_type})</span>
                          </Label>

                          {fdef.field_type === 'text' && (
                            <Input
                              id={`custom-${fdef.id}`}
                              placeholder={`Enter ${fdef.name}`}
                              value={val}
                              onChange={(e) => setCustomValues(prev => ({ ...prev, [fdef.name]: e.target.value }))}
                              required={isRequired}
                              className="h-9 text-xs"
                            />
                          )}

                          {fdef.field_type === 'number' && (
                            <Input
                              id={`custom-${fdef.id}`}
                              type="number"
                              placeholder={`Enter ${fdef.name}`}
                              value={val}
                              onChange={(e) => setCustomValues(prev => ({ ...prev, [fdef.name]: e.target.value }))}
                              required={isRequired}
                              className="h-9 text-xs"
                            />
                          )}

                          {fdef.field_type === 'file' && (
                            <div className="space-y-1.5">
                              {val ? (
                                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-150 p-2 rounded-lg text-xs">
                                  <span className="font-semibold text-indigo-750 truncate max-w-[180px]">
                                    {val.split('/').pop()}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCustomValues(prev => {
                                      const copy = { ...prev };
                                      delete copy[fdef.name];
                                      return copy;
                                    })}
                                    className="h-6 px-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 text-[10px]"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`custom-${fdef.id}`}
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleCustomFileUpload(fdef.name, file);
                                    }}
                                    required={isRequired}
                                    disabled={uploadingField === fdef.name}
                                    className="text-xs h-9 cursor-pointer"
                                  />
                                  {uploadingField === fdef.name && (
                                    <span className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full shrink-0"></span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {fdef.field_type === 'checkbox' && (
                            <div className="flex items-center space-x-2 pt-1">
                              <input
                                type="checkbox"
                                id={`custom-${fdef.id}`}
                                checked={!!val}
                                onChange={(e) => setCustomValues(prev => ({ ...prev, [fdef.name]: e.target.checked }))}
                                required={isRequired && !val}
                                className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                              />
                              <span
                                className="text-xs text-slate-500 select-none cursor-pointer"
                                onClick={() => setCustomValues(prev => ({ ...prev, [fdef.name]: !val }))}
                              >
                                Toggle Yes / No
                              </span>
                            </div>
                          )}

                          {fdef.field_type === 'radio' && (
                            <div className="flex flex-wrap gap-4 pt-1">
                              {(fdef.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((opt) => (
                                <label key={opt} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`custom-radio-${fdef.id}`}
                                    value={opt}
                                    checked={val === opt}
                                    onChange={() => setCustomValues(prev => ({ ...prev, [fdef.name]: opt }))}
                                    required={isRequired && !val}
                                    className="h-4.5 w-4.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {fdef.field_type === 'checkboxes' && (
                            <div className="flex flex-wrap gap-4 pt-1">
                              {(fdef.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((opt) => {
                                const currentArray = Array.isArray(val) ? val : [];
                                const isChecked = currentArray.includes(opt);
                                return (
                                  <label key={opt} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        let nextArray;
                                        if (isChecked) {
                                          nextArray = currentArray.filter((item: string) => item !== opt);
                                        } else {
                                          nextArray = [...currentArray, opt];
                                        }
                                        setCustomValues(prev => ({ ...prev, [fdef.name]: nextArray }));
                                      }}
                                      className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {submitting ? 'Registering...' : 'Register Dealer'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tab Panels & Lists */}
        <div className="lg:col-span-2">
          <Card className="border border-gray-100 shadow-sm h-full flex flex-col">
            <CardHeader className="border-b border-gray-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-medium text-[#1E293B]">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Dealers Directory
                </CardTitle>
                <CardDescription>
                  List of registered entities categorized by their business role.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search name, company, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 w-full h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col justify-between">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></span>
                  Loading dealers directory...
                </div>
              ) : (
                <Tabs defaultValue="sub_contractors" className="w-full flex-1 flex flex-col justify-between">
                  <TabsList className="bg-gray-100/80 p-1 rounded-lg mb-6 w-full flex">
                    <TabsTrigger value="sub_contractors" className="flex-1 py-2 text-xs font-semibold rounded-md">
                      Sub Contractors ({subContractors.length})
                    </TabsTrigger>
                    <TabsTrigger value="suppliers" className="flex-1 py-2 text-xs font-semibold rounded-md">
                      Suppliers ({suppliers.length})
                    </TabsTrigger>
                    <TabsTrigger value="scrap_dealers" className="flex-1 py-2 text-xs font-semibold rounded-md">
                      Scrap Dealers ({scrapDealers.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1">
                    <TabsContent value="sub_contractors" className="mt-0">
                      {renderDealerTable(subContractors, "Sub Contractors")}
                    </TabsContent>
                    <TabsContent value="suppliers" className="mt-0">
                      {renderDealerTable(suppliers, "Suppliers")}
                    </TabsContent>
                    <TabsContent value="scrap_dealers" className="mt-0">
                      {renderDealerTable(scrapDealers, "Scrap Dealers")}
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DealersPage;
