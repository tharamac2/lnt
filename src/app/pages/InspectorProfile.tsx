import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Building2, FileText, Mail, Phone, Save, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

const InspectorProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [site, setSite] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      setUserId(res.data.id);
      setFullName(res.data.full_name || '');
      setEmail(res.data.email || '');
      setSite(res.data.site || '');
      setPhone(res.data.phone || '');
      setCompanyName(res.data.company_name || '');
      setGstNumber(res.data.gst_number || '');
    } catch (error) {
      console.error('Failed to fetch profile', error);
      toast.error('Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const isValidPhone = (value: string) => {
    if (!value.trim()) return true;
    return /^(\+?\d{1,4}[\s-]?)?\d{10}$/.test(value.trim().replace(/[\s\-().]/g, ''));
  };

  const handleSave = async () => {
    const newErrors: { email?: string; phone?: string } = {};
    if (!isValidEmail(email)) newErrors.email = 'Please enter a valid email address.';
    if (!isValidPhone(phone)) newErrors.phone = 'Enter a valid 10-digit phone number (optionally with country code).';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    if (!userId) return;
    setSaving(true);
    try {
      await api.patch(`/users/${userId}`, {
        full_name: fullName,
        email,
        site,
        phone,
        company_name: companyName,
        gst_number: gstNumber,
      });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Failed to update profile', error);
      toast.error(error?.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Profile</h1>
        <p className="text-gray-500 mt-1">View and update your company information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1E3A8A]" />
            Company Information
          </CardTitle>
          <CardDescription>Update your contact and site details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading profile...</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> Name
                </Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your name" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Company Name
                </Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Enter your company name" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone Number
                </Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  className={errors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g. 9876543210 or +91 9876543210"
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> GST Number
                </Label>
                <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="Enter your GST number" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Site / Company
                </Label>
                <Input value={site} disabled placeholder="Not assigned" />
              </div>
              <Separator />
              <Button className="bg-[#1E3A8A]" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InspectorProfile;
