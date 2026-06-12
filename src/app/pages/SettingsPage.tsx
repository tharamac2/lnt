import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import {
  Building2,
  Bell,
  Shield,
  Database,
  Mail,
  Phone,
  Save,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

const SettingsPage = () => {
  const [companyName, setCompanyName] = useState('Industrial Tools Co.');
  const [companyEmail, setCompanyEmail] = useState('admin@industrialtools.com');
  const [companyPhone, setCompanyPhone] = useState('');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    expiry: true,
    inspection: true,
  });

  // --- Validation helpers ---
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const isValidPhone = (phone: string) => {
    if (!phone.trim()) return true; // phone is optional
    return /^(\+?\d{1,4}[\s-]?)?\d{10}$/.test(phone.trim().replace(/[\s\-().]/g, ''));
  };

  const [settingsErrors, setSettingsErrors] = useState<{ email?: string; phone?: string }>({});

  const handleSaveSettings = () => {
    const errors: { email?: string; phone?: string } = {};
    if (!isValidEmail(companyEmail))
      errors.email = 'Please enter a valid email address (e.g. admin@company.com).';
    if (!isValidPhone(companyPhone))
      errors.phone = 'Enter a valid 10-digit phone number (optionally with country code).';
    if (Object.keys(errors).length > 0) {
      setSettingsErrors(errors);
      return;
    }
    setSettingsErrors({});
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Settings</h1>
        <p className="text-gray-500 mt-1">Manage system preferences and configurations</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="data">Data & Backup</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Update your company details and system preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Company Name <span className="text-red-600">*</span></Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Company Email <span className="text-red-600">*</span></Label>
                <Input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => {
                    setCompanyEmail(e.target.value);
                    setSettingsErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className={settingsErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  required
                />
                {settingsErrors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <Mail className="w-3 h-3" />{settingsErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input placeholder="Enter company address" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 9876543210 or +91 9876543210"
                  value={companyPhone}
                  onChange={(e) => {
                    setCompanyPhone(e.target.value);
                    setSettingsErrors(prev => ({ ...prev, phone: undefined }));
                  }}
                  className={settingsErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {settingsErrors.phone && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />{settingsErrors.phone}
                  </p>
                )}
              </div>
              <Separator />
              <Button className="bg-[#1E3A8A]" onClick={handleSaveSettings}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how you receive alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-gray-500">Receive push notifications in browser</p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Expiry Alerts</p>
                  <p className="text-sm text-gray-500">Alert when tools are about to expire</p>
                </div>
                <Switch
                  checked={notifications.expiry}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, expiry: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Inspection Reminders</p>
                  <p className="text-sm text-gray-500">Remind when inspections are due</p>
                </div>
                <Switch
                  checked={notifications.inspection}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, inspection: checked })
                  }
                />
              </div>
              <Separator />
              <Button className="bg-[#1E3A8A]" onClick={handleSaveSettings}>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" placeholder="Enter current password" />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" placeholder="Enter new password" />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" placeholder="Confirm new password" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <Button className="bg-[#1E3A8A]" onClick={handleSaveSettings}>
                <Save className="w-4 h-4 mr-2" />
                Update Security
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Backup Settings */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Manage data backup and export settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Automatic Backups</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Daily Backups</p>
                    <p className="text-sm text-gray-500">Automatically backup data every day</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-medium">Data Export</h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={async () => {
                    const toastId = toast.loading('Generating Full Data PDF...');
                    try {
                      // Use configured API instance which handles base URL and Auth headers
                      const response = await api.get('/export/full-data-pdf', {
                        responseType: 'blob'
                      });

                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `System_Export_${new Date().toISOString().slice(0, 10)}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);

                      toast.success('Export completed successfully', { id: toastId });
                    } catch (error) {
                      console.error(error);
                      toast.error('Failed to export data. Please check connection.', { id: toastId });
                    }
                  }}>
                    Export All Data
                  </Button>
                  <Button variant="outline">
                    Export Reports
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-medium">Manual Backup</h3>
                <Button className="bg-[#1E3A8A]">
                  <Database className="w-4 h-4 mr-2" />
                  Create Backup Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;