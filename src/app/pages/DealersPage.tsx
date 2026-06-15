import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Truck, Users, Trash2, Search, PlusCircle, AlertCircle, FileSpreadsheet, UploadCloud, Building2, Mail, Phone, MapPin, Hash } from 'lucide-react';
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
}

const DealersPage = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
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
  const [submitting, setSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  useEffect(() => {
    fetchDealers();
  }, []);

  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !companyName.trim() || !dealerCode.trim()) {
      toast.error('Please fill in Name, Company Name, and Dealer Code');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/dealers/', {
        category,
        name: name.trim(),
        company_name: companyName.trim(),
        dealer_code: dealerCode.trim().toUpperCase(),
        email: email.trim() || null,
        contact_number: contactNumber.trim() || null,
        address: address.trim() || null,
        gst_number: gstNumber.trim() || null,
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
              <TableHead className="w-[60px] font-semibold text-gray-600">S.No</TableHead>
              <TableHead className="font-semibold text-gray-600">Name</TableHead>
              <TableHead className="font-semibold text-gray-600">Company</TableHead>
              <TableHead className="font-semibold text-gray-600">Dealer Code</TableHead>
              <TableHead className="font-semibold text-gray-600">GST Number</TableHead>
              <TableHead className="font-semibold text-gray-600">Contact</TableHead>
              <TableHead className="w-[80px] text-right font-semibold text-gray-600">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((dealer, index) => (
              <TableRow key={dealer.id} className="hover:bg-gray-50/50 transition-colors">
                <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                <TableCell className="font-semibold text-gray-800">{dealer.name}</TableCell>
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
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteDealer(dealer.id, dealer.name)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    title="Delete Dealer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
                  <Label htmlFor="dealerName" className="text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
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
                  <Label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                    Company Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. ABC Tech Solutions"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealerCode" className="text-sm font-medium text-gray-700">
                    Dealer Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dealerCode"
                    placeholder="e.g. SUBCON101"
                    value={dealerCode}
                    onChange={(e) => setDealerCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mailId" className="text-sm font-medium text-gray-700">
                    Mail ID
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
                  <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700">
                    Contact Number
                  </Label>
                  <Input
                    id="contactNumber"
                    placeholder="e.g. +91 9876543210"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Address
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
                    GST Number
                  </Label>
                  <Input
                    id="gstNumber"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  />
                </div>

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
