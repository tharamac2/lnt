import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { UserCircle, Search, X, ShieldCheck, Clock, Undo2, Wrench } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';

interface InspectorEntry {
  id: number;
  name: string;
  employee_id: string;
  email?: string | null;
  designation?: string | null;
  department?: string | null;
  contact_number?: string | null;
  status: string;
  created_at: string;
}

const InspectionEmployees = () => {
  const [employees, setEmployees] = useState<InspectorEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<InspectorEntry | null>(null);
  const [employeeInspections, setEmployeeInspections] = useState<any[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/inspectors/');
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch inspection employees', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((emp) => {
      return (
        (emp.name || '').toLowerCase().includes(query) ||
        (emp.employee_id || '').toLowerCase().includes(query) ||
        (emp.email || '').toLowerCase().includes(query) ||
        (emp.designation || '').toLowerCase().includes(query) ||
        (emp.department || '').toLowerCase().includes(query)
      );
    });
  }, [employees, search]);

  const handleVerify = async (id: number) => {
    try {
      await api.patch(`/inspectors/${id}/verify`);
      setEmployees((prev) => prev.map((emp) => (emp.id === id ? { ...emp, status: 'verified' } : emp)));
      toast.success('Employee verified');
    } catch (err) {
      console.error('Failed to verify employee', err);
      toast.error('Failed to verify employee');
    }
  };

  const handleUnverify = async (id: number) => {
    try {
      await api.patch(`/inspectors/${id}/unverify`);
      setEmployees((prev) => prev.map((emp) => (emp.id === id ? { ...emp, status: 'pending' } : emp)));
      toast.success('Employee moved back to pending');
    } catch (err) {
      console.error('Failed to update employee', err);
      toast.error('Failed to update employee');
    }
  };

  const handleViewInspections = async (emp: InspectorEntry) => {
    setSelectedEmployee(emp);
    setLoadingInspections(true);
    try {
      const res = await api.get(`/inspectors/${emp.id}/inspections`);
      setEmployeeInspections(res.data);
    } catch (err) {
      console.error('Failed to fetch inspections for employee', err);
      toast.error('Failed to load inspections for this employee');
    } finally {
      setLoadingInspections(false);
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'pass':
      case 'usable':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Pass</Badge>;
      case 'conditional':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Conditional</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Fail</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Inspection Employees</h1>
          <p className="text-gray-500 mt-1">
            Verify inspector employee profiles before they can submit inspections
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <UserCircle className="text-[#1E3A8A] w-5 h-5" />
              Employee Profiles
            </CardTitle>
            <CardDescription>Inspector employee details submitted for verification</CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shadow-sm text-sm py-1 px-3">
            {filteredEmployees.length} of {employees.length} {employees.length === 1 ? 'Record' : 'Records'}
          </Badge>
        </CardHeader>

        {employees.length > 0 && (
          <div className="p-3 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, employee ID, designation or department..."
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
            <div className="p-8 text-center text-gray-400">Loading employee profiles...</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <UserCircle className="w-12 h-12 text-gray-200 mb-2" />
              <p>No inspection employee profiles have been added yet.</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Search className="w-12 h-12 text-gray-200 mb-2" />
              <p>No employee profiles match your search.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto [&>div]:overflow-visible">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="sticky top-0 border-b border-gray-100 z-10 shadow-sm [&_th]:bg-white">
                  <TableRow>
                    <TableHead>Inspector Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-blue-50/20">
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-[#1E3A8A] hover:underline"
                          onClick={() => handleViewInspections(emp)}
                        >
                          {emp.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{emp.employee_id}</TableCell>
                      <TableCell className="text-sm text-gray-600">{emp.email || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{emp.designation || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{emp.department || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{emp.contact_number || '-'}</TableCell>
                      <TableCell>
                        {emp.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-semibold uppercase bg-green-50 text-green-700 border-green-200">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-semibold uppercase bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.status === 'verified' ? (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => handleUnverify(emp.id)}>
                            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                            Unverify
                          </Button>
                        ) : (
                          <Button size="sm" className="h-8 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white" onClick={() => handleVerify(emp.id)}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                            Verify
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#1E3A8A]" />
              Tools Inspected by {selectedEmployee?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee?.employee_id} &middot; {employeeInspections.length} {employeeInspections.length === 1 ? 'inspection' : 'inspections'} recorded
            </DialogDescription>
          </DialogHeader>

          {loadingInspections ? (
            <div className="p-8 text-center text-gray-400">Loading inspections...</div>
          ) : employeeInspections.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <Wrench className="w-12 h-12 text-gray-200 mb-2" />
              <p>This employee has not submitted any inspections yet.</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto [&>div]:overflow-visible">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="sticky top-0 border-b border-gray-100 z-10 shadow-sm [&_th]:bg-white">
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Usability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeInspections.map((insp) => (
                    <TableRow key={insp.id} className="hover:bg-blue-50/20">
                      <TableCell className="font-medium text-[#1E3A8A]">{insp.tool?.description || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <Badge variant="outline" className="text-[10px] text-gray-500">{insp.tool?.qr_code || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {insp.date ? new Date(insp.date).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>{getResultBadge(insp.result)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {insp.usability_percentage != null ? `${insp.usability_percentage}%` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InspectionEmployees;
