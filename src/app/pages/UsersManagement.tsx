import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { UserPlus, Edit, Trash2, Search, Mail, Phone, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  site: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  isInspectionEmployee?: boolean;
}

import { useEffect } from 'react';
import api from '../services/api';

const UsersManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [storeLocations, setStoreLocations] = useState<string[]>([]);

  const fetchStores = async () => {
    try {
      const res = await api.get('/users/stores');
      setStoreLocations(res.data.stores || []);
    } catch (err) {
      console.error('Failed to fetch stores', err);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users/');
        const fetchedUsers = response.data.map((u: any) => ({
          id: u.id.toString(),
          name: u.full_name || u.username,
          email: u.email,
          phone: u.phone || 'N/A',
          role: u.role,
          site: u.site || 'N/A',
          status: u.status,
          lastLogin: new Date().toISOString()
        }));

        let inspectionEmployees: User[] = [];
        try {
          const empRes = await api.get('/inspectors/');
          inspectionEmployees = empRes.data.map((emp: any) => ({
            id: `insp-${emp.id}`,
            name: emp.name,
            email: emp.email,
            phone: emp.contact_number || 'N/A',
            role: 'inspection_employee',
            site: emp.site || 'N/A',
            status: emp.status === 'verified' ? 'active' : 'inactive',
            lastLogin: emp.created_at,
            isInspectionEmployee: true,
          }));
        } catch (err) {
          console.error("Failed to fetch inspection employees", err);
        }

        setUsers([...fetchedUsers, ...inspectionEmployees]);
      } catch (error) {
        console.error("Failed to fetch users", error);
        toast.error("Failed to load users");
      }
    };
    fetchUsers();
    fetchStores();
  }, []);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: '',
    site: ''
  });

  // --- Email OTP verification state ---
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // --- Validation helpers ---
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const isValidPhone = (phone: string) => {
    if (!phone.trim()) return true; // phone is optional
    // Accepts: 10-digit numbers, optionally prefixed with +91, +1, etc.
    return /^(\+?\d{1,4}[\s-]?)?\d{10}$/.test(phone.trim().replace(/[\s\-().]/g, ''));
  };

  // Add-user form errors
  const [addErrors, setAddErrors] = useState<{ email?: string; phone?: string }>({});
  // Edit-user form errors
  const [editErrors, setEditErrors] = useState<{ email?: string; phone?: string }>({});

  const handleInputChange = (field: string, value: string) => {
    setNewUser(prev => {
      const updated = { ...prev, [field]: value };
      // When role changes, reset site so user must re-pick
      if (field === 'role') updated.site = '';
      return updated;
    });
    if (field === 'email' || field === 'phone') {
      setAddErrors(prev => ({ ...prev, [field]: undefined }));
    }
    // If the email is changed after verification, require re-verification
    if (field === 'email') {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode('');
    }
  };

  const handleSendOtp = async () => {
    if (!isValidEmail(newUser.email)) {
      setAddErrors(prev => ({ ...prev, email: 'Please enter a valid email address (e.g. user@company.com).' }));
      return;
    }
    setSendingOtp(true);
    try {
      await api.post('/users/send-otp', { email: newUser.email });
      setOtpSent(true);
      setOtpVerified(false);
      setOtpCode('');
      toast.success('Verification code sent to ' + newUser.email);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error('Please enter the verification code');
      return;
    }
    setVerifyingOtp(true);
    try {
      await api.post('/users/verify-otp', { email: newUser.email, otp: otpCode.trim() });
      setOtpVerified(true);
      toast.success('Email verified successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Invalid or expired verification code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleAddUser = async () => {
    try {
      const missingFields = [];
      if (!newUser.name) missingFields.push("Name");
      if (!newUser.email) missingFields.push("Email");
      if (!newUser.password) missingFields.push("Password");
      if (!newUser.role) missingFields.push("Role");
      if (!newUser.site) missingFields.push("Site Location");

      if (missingFields.length > 0) {
        toast.error(`Please fill in: ${missingFields.join(', ')}`);
        return;
      }

      // Field-level format validation
      const newAddErrors: { email?: string; phone?: string } = {};
      if (!isValidEmail(newUser.email))
        newAddErrors.email = 'Please enter a valid email address (e.g. user@company.com).';
      if (newUser.phone && !isValidPhone(newUser.phone))
        newAddErrors.phone = 'Enter a valid 10-digit mobile number (optionally with country code).';
      if (Object.keys(newAddErrors).length > 0) {
        setAddErrors(newAddErrors);
        return;
      }

      if (!otpVerified) {
        toast.error('Please verify the email address before adding the user');
        return;
      }

      const payload = {
        username: newUser.email, // Using email as username
        email: newUser.email,
        full_name: newUser.name,
        password: newUser.password,
        role: newUser.role,
        site: newUser.site,
        phone: newUser.phone,
        status: 'active'
      };

      const res = await api.post('/users/', payload);

      // Add the new user to the local list immediately (optimistic update or re-fetch)
      const createdUser: User = {
        id: res.data.id.toString(),
        name: res.data.full_name || res.data.username,
        email: res.data.email,
        phone: newUser.phone, // Backend might not return this if not in UserRead
        role: res.data.role,
        site: res.data.site || 'N/A',
        status: res.data.status as 'active' | 'inactive',
        lastLogin: new Date().toISOString()
      };

      setUsers(prev => [...prev, createdUser]);

      toast.success('User added successfully');
      setIsAddUserOpen(false);

      // If a Store Manager was added, refresh store list so the new location appears in the dropdown
      if (newUser.role === 'store') {
        fetchStores();
      }

      // Reset form
      setNewUser({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: '',
        site: ''
      });
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode('');

    } catch (error: any) {
      console.error("Failed to add user", error);
      if (error.response && error.response.data && error.response.data.detail) {
        toast.error(`Error: ${error.response.data.detail}`);
      } else {
        toast.error("Failed to add user");
      }
    }
  };

  /* Edit User State */
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: '',
    site: '',
    phone: '',
    password: '' // Optional for edit
  });

  const handleEditClick = (user: User) => {
    setEditingUserId(user.id);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      site: user.site,
      phone: user.phone,
      password: ''
    });
    setIsEditUserOpen(true);
  };

  const handleUpdateUser = async () => {
    try {
      if (!editingUserId) return;

      // Field-level format validation for edit form
      const newEditErrors: { email?: string; phone?: string } = {};
      if (editFormData.email && !isValidEmail(editFormData.email))
        newEditErrors.email = 'Please enter a valid email address (e.g. user@company.com).';
      if (editFormData.phone && !isValidPhone(editFormData.phone))
        newEditErrors.phone = 'Enter a valid 10-digit mobile number (optionally with country code).';
      if (Object.keys(newEditErrors).length > 0) {
        setEditErrors(newEditErrors);
        return;
      }

      const payload: any = {
        full_name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role,
        site: editFormData.site,
        phone: editFormData.phone
      };

      if (editFormData.password) {
        payload.password = editFormData.password;
      }

      await api.patch(`/users/${editingUserId}`, payload);

      setUsers(users.map(u =>
        u.id === editingUserId
          ? { ...u, ...editFormData, name: editFormData.name } // partial update local state
          : u
      ));

      toast.success('User updated successfully');
      setIsEditUserOpen(false);
    } catch (error: any) {
      console.error("Failed to update user", error);
      if (error.response && error.response.data && error.response.data.detail) {
        toast.error(`Error: ${error.response.data.detail}`);
      } else {
        toast.error("Failed to update user");
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      if (userId.startsWith('insp-')) {
        await api.delete(`/inspectors/${userId.replace('insp-', '')}`);
      } else {
        await api.delete(`/users/${userId}`);
      }
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error("Failed to delete user", error);
      toast.error("Failed to delete user");
    }
  };

  const toggleUserStatus = async (userId: string) => {
    const userToToggle = users.find(u => u.id === userId);
    if (!userToToggle) return;

    const newStatus = userToToggle.status === 'active' ? 'inactive' : 'active';

    if (userToToggle.isInspectionEmployee) {
      const inspectorId = userId.replace('insp-', '');
      try {
        await api.patch(`/inspectors/${inspectorId}/${newStatus === 'active' ? 'verify' : 'unverify'}`);
        setUsers(users.map(u => (u.id === userId ? { ...u, status: newStatus } : u)));
        toast.success('Employee verification status updated');
      } catch (error) {
        console.error("Failed to update employee status", error);
        toast.error('Failed to update employee status');
      }
      return;
    }

    try {
      await api.patch(`/users/${userId}`, { status: newStatus });
      setUsers(users.map(u =>
        u.id === userId
          ? { ...u, status: newStatus }
          : u
      ));
      toast.success('User status updated');
    } catch (error) {
      console.error("Failed to update user status", error);
      toast.error('Failed to update user status');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Badge className="bg-purple-600">Admin</Badge>;
      case 'management':
        return <Badge className="bg-amber-600">Management</Badge>;
      case 'inspector':
        return <Badge className="bg-blue-600">Inspector</Badge>;
      case 'store':
      case 'store manager':
        return <Badge className="bg-green-600">Store Manager</Badge>;
      case 'worker':
        return <Badge className="bg-gray-600">Worker</Badge>;
      case 'data_entry':
        return <Badge className="bg-teal-600">Data Entry</Badge>;
      case 'inspection_employee':
        return <Badge className="bg-emerald-600">Inspection Employee</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">User Management</h1>
          <p className="text-gray-500 mt-1">Manage system users and permissions</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E3A8A]">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name <span className="text-red-600">*</span></Label>
                <Input
                  id="add-name"
                  placeholder="Enter user name"
                  value={newUser.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email <span className="text-red-600">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="user@company.com"
                    value={newUser.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={addErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    disabled={otpVerified}
                    required
                  />
                  {otpVerified ? (
                    <Badge className="bg-green-600 whitespace-nowrap self-center">Verified</Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || !newUser.email}
                      className="whitespace-nowrap"
                    >
                      {sendingOtp ? 'Sending...' : otpSent ? 'Resend Code' : 'Send Code'}
                    </Button>
                  )}
                </div>
                {addErrors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <Mail className="w-3 h-3" />{addErrors.email}
                  </p>
                )}
                {otpSent && !otpVerified && (
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || !otpCode.trim()}
                      className="whitespace-nowrap"
                    >
                      {verifyingOtp ? 'Verifying...' : 'Verify'}
                    </Button>
                  </div>
                )}
                {otpSent && !otpVerified && (
                  <p className="text-xs text-gray-500">Enter the verification code sent to {newUser.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone Number</Label>
                <Input
                  id="add-phone"
                  type="tel"
                  placeholder="e.g. 9876543210 or +91 9876543210"
                  value={newUser.phone}
                  onChange={(e) => {
                    handleInputChange('phone', e.target.value);
                    setAddErrors(prev => ({ ...prev, phone: undefined }));
                  }}
                  className={addErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {addErrors.phone && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />{addErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-password">Password <span className="text-red-600">*</span></Label>
                <div className="relative">
                  <Input
                    id="add-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={newUser.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-role">Role <span className="text-red-600">*</span></Label>
                <Select onValueChange={(val) => handleInputChange('role', val)} required>
                  <SelectTrigger id="add-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspector">Inspector</SelectItem>
                    <SelectItem value="store">Store Manager</SelectItem>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="data_entry">Data Entry</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Smart Site Location Field */}
              {newUser.role === 'store' ? (
                <div className="space-y-2">
                  <Label htmlFor="add-site">
                    New Store Location <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="add-site"
                    placeholder="Enter new store / location name"
                    value={newUser.site}
                    onChange={(e) => handleInputChange('site', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">This will create a new store and add it to the location list.</p>
                </div>
              ) : newUser.role === 'management' ? (
                <div className="space-y-2">
                  <Label>Store Location</Label>
                  <p className="text-xs text-gray-500 border border-gray-100 bg-gray-50 rounded px-2.5 py-2">
                    Global oversight. No store assignment needed.
                  </p>
                </div>
              ) : newUser.role && ['worker', 'inspector', 'data_entry'].includes(newUser.role) ? (
                <div className="space-y-2">
                  <Label htmlFor="add-site">
                    Assign Store Location <span className="text-red-600">*</span>
                  </Label>
                  {storeLocations.length === 0 ? (
                    <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-md px-3 py-2">
                      ⚠️ No stores created yet. Please add a Store Manager first to create a location.
                    </p>
                  ) : (
                    <Select
                      value={newUser.site}
                      onValueChange={(val) => handleInputChange('site', val)}
                    >
                      <SelectTrigger id="add-site">
                        <SelectValue placeholder="Select a store location" />
                      </SelectTrigger>
                      <SelectContent>
                        {storeLocations.map((store) => (
                          <SelectItem key={store} value={store}>{store}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddUserOpen(false);
                setOtpSent(false);
                setOtpVerified(false);
                setOtpCode('');
              }}>
                Cancel
              </Button>
              <Button className="bg-[#1E3A8A]" onClick={handleAddUser} disabled={!otpVerified} title={!otpVerified ? 'Verify the email address first' : undefined}>
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, email: e.target.value });
                    setEditErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className={editErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {editErrors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <Mail className="w-3 h-3" />{editErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 9876543210 or +91 9876543210"
                  value={editFormData.phone}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, phone: e.target.value });
                    setEditErrors(prev => ({ ...prev, phone: undefined }));
                  }}
                  className={editErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {editErrors.phone && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />{editErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(val) => setEditFormData({ ...editFormData, role: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                    <SelectItem value="inspector">Inspector</SelectItem>
                    <SelectItem value="store">Store Manager</SelectItem>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="data_entry">Data Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site Location</Label>
                {['admin', 'management'].includes(editFormData.role) ? (
                  <p className="text-xs text-gray-500 border border-gray-100 bg-gray-50 rounded px-2.5 py-2">
                    Global oversight. No store assignment needed.
                  </p>
                ) : editFormData.role === 'store' ? (
                  <Input
                    placeholder="Store / location name"
                    value={editFormData.site}
                    onChange={(e) => setEditFormData({ ...editFormData, site: e.target.value })}
                  />
                ) : storeLocations.length > 0 ? (
                  <Select
                    value={editFormData.site}
                    onValueChange={(val) => setEditFormData({ ...editFormData, site: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a store location" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeLocations.map((store) => (
                        <SelectItem key={store} value={store}>{store}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="No stores available — type manually"
                    value={editFormData.site}
                    onChange={(e) => setEditFormData({ ...editFormData, site: e.target.value })}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>New Password (Optional)</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
              <Button className="bg-[#1E3A8A]" onClick={handleUpdateUser}>Update User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-3xl font-semibold mt-2">{users.length}</p>
              </div>
              <Shield className="w-8 h-8 text-[#1E3A8A]" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Users</p>
                <p className="text-3xl font-semibold mt-2">
                  {users.filter(u => u.status === 'active').length}
                </p>
              </div>
              <Shield className="w-8 h-8 text-[#16A34A]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono">{index + 1}</TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{user.site}</TableCell>
                  <TableCell>
                    <Switch
                      checked={user.status === 'active'}
                      onCheckedChange={() => toggleUserStatus(user.id)}
                      title={user.isInspectionEmployee ? (user.status === 'active' ? 'Verified - click to unverify' : 'Pending - click to verify') : undefined}
                    />
                  </TableCell>
                  <TableCell>{new Date(user.lastLogin).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!user.isInspectionEmployee && (
                        <Button size="sm" variant="ghost" onClick={() => handleEditClick(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersManagement;