import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { UserPlus, ShieldCheck, Clock, UserCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const InspectorEmployeeProfile = () => {
  const [employeeRecords, setEmployeeRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    employeeId: '',
    email: '',
    password: '',
    confirmPassword: '',
    designation: '',
    department: '',
    contactNumber: '',
  });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const fetchEmployeeRecords = async () => {
    try {
      const res = await api.get('/inspectors/me');
      setEmployeeRecords(res.data);
    } catch (error) {
      console.error('Failed to fetch employee profile', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeRecords();
  }, []);

  const verifiedEmployee = employeeRecords.find((e) => e.status === 'verified');
  const latestEmployee = employeeRecords[0];

  const resetEmployeeForm = () => {
    setNewEmployee({ name: '', employeeId: '', email: '', password: '', confirmPassword: '', designation: '', department: '', contactNumber: '' });
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
  };

  const handleSendOtp = async () => {
    if (!newEmployee.email) {
      toast.error('Enter an email address first');
      return;
    }
    setSendingOtp(true);
    try {
      await api.post('/users/send-otp', { email: newEmployee.email });
      setOtpSent(true);
      toast.success('Verification code sent to your email');
    } catch (error: any) {
      console.error('Failed to send OTP', error);
      toast.error(error?.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      toast.error('Enter the verification code sent to your email');
      return;
    }
    setVerifyingOtp(true);
    try {
      await api.post('/users/verify-otp', { email: newEmployee.email, otp });
      setOtpVerified(true);
      toast.success('Email verified');
    } catch (error: any) {
      console.error('Failed to verify OTP', error);
      toast.error(error?.response?.data?.detail || 'Invalid or expired verification code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.employeeId || !newEmployee.email || !newEmployee.password) {
      toast.error('Inspector Name, Employee ID, Email and Password are required');
      return;
    }
    if (!otpVerified) {
      toast.error('Please verify your email address with the code sent to it');
      return;
    }
    if (newEmployee.password !== newEmployee.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSavingEmployee(true);
    try {
      await api.post('/inspectors/', {
        name: newEmployee.name,
        employee_id: newEmployee.employeeId,
        email: newEmployee.email,
        password: newEmployee.password,
        designation: newEmployee.designation || null,
        department: newEmployee.department || null,
        contact_number: newEmployee.contactNumber || null,
      });
      toast.success('Employee details submitted for admin verification');
      resetEmployeeForm();
      setIsAddEmployeeOpen(false);
      fetchEmployeeRecords();
    } catch (error: any) {
      console.error('Failed to add employee', error);
      toast.error(error?.response?.data?.detail || 'Failed to save employee details');
    } finally {
      setSavingEmployee(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Add Employee</h1>
          <p className="text-gray-500 mt-1">
            Submit your employee details for admin verification before you can submit inspections
          </p>
        </div>

        <Dialog open={isAddEmployeeOpen} onOpenChange={(open) => { setIsAddEmployeeOpen(open); if (!open) resetEmployeeForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E3A8A]">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Inspection Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emp-name">Inspector Name <span className="text-red-600">*</span></Label>
                <Input
                  id="emp-name"
                  placeholder="Enter inspector name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-id">Employee ID <span className="text-red-600">*</span></Label>
                <Input
                  id="emp-id"
                  placeholder="Enter employee ID"
                  value={newEmployee.employeeId}
                  onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-email">Email <span className="text-red-600">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="emp-email"
                    type="email"
                    placeholder="Enter email address"
                    value={newEmployee.email}
                    disabled={otpVerified}
                    onChange={(e) => {
                      setNewEmployee({ ...newEmployee, email: e.target.value });
                      setOtpSent(false);
                      setOtpVerified(false);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={!newEmployee.email || sendingOtp || otpVerified}
                    onClick={handleSendOtp}
                  >
                    <Send className="w-4 h-4 mr-1.5" />
                    {sendingOtp ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </Button>
                </div>
              </div>
              {otpSent && !otpVerified && (
                <div className="space-y-2">
                  <Label htmlFor="emp-otp">Verification Code <span className="text-red-600">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      id="emp-otp"
                      placeholder="Enter the 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                    <Button type="button" variant="outline" className="shrink-0" disabled={verifyingOtp} onClick={handleVerifyOtp}>
                      {verifyingOtp ? 'Verifying...' : 'Verify'}
                    </Button>
                  </div>
                </div>
              )}
              {otpVerified && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Email verified</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="emp-password">Password <span className="text-red-600">*</span></Label>
                <Input
                  id="emp-password"
                  type="password"
                  placeholder="Create a password"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-confirm-password">Confirm Password <span className="text-red-600">*</span></Label>
                <Input
                  id="emp-confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={newEmployee.confirmPassword}
                  onChange={(e) => setNewEmployee({ ...newEmployee, confirmPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-designation">Designation</Label>
                <Input
                  id="emp-designation"
                  placeholder="Enter designation"
                  value={newEmployee.designation}
                  onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-department">Department</Label>
                <Input
                  id="emp-department"
                  placeholder="Enter department"
                  value={newEmployee.department}
                  onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-contact">Contact Number</Label>
                <Input
                  id="emp-contact"
                  placeholder="Enter contact number"
                  value={newEmployee.contactNumber}
                  onChange={(e) => setNewEmployee({ ...newEmployee, contactNumber: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>Cancel</Button>
              <Button className="bg-[#1E3A8A]" onClick={handleAddEmployee} disabled={savingEmployee}>
                {savingEmployee ? 'Saving...' : 'Submit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {latestEmployee && (
        verifiedEmployee ? (
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-200 bg-green-50 text-green-700 text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Employee profile verified: {verifiedEmployee.name} ({verifiedEmployee.employee_id})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-sm">
            <Clock className="w-4 h-4" />
            <span>Employee profile pending admin verification: {latestEmployee.name} ({latestEmployee.employee_id}). You cannot submit inspections until verified.</span>
          </div>
        )
      )}

      <Card>
        <CardHeader className="bg-gray-50 pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <UserCircle className="text-[#1E3A8A] w-5 h-5" />
            My Employee Profiles
          </CardTitle>
          <CardDescription>Employee details submitted for admin verification</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading employee profile...</div>
          ) : employeeRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <UserCircle className="w-12 h-12 text-gray-200 mb-2" />
              <p>No employee profile submitted yet. Click "Add Employee" to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inspector Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeRecords.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium text-[#1E3A8A]">{emp.name}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InspectorEmployeeProfile;
