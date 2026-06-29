import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User } from '../App';
import { QrCode, Shield, Store, HardHat, UserCog, ArrowLeft, Camera, Eye, EyeOff, ClipboardCheck } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import ltLogo from '../../assets/lt-logo.png';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [username, setUsername] = useState(''); // Will bet set based on role selection
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Login OTP state ---
  const [otpRequired, setOtpRequired] = useState(false);
  const [loginOtp, setLoginOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');

  const handleRoleSelect = (role: string) => {
    if (role === 'worker') {
      handleWorkerAccess();
    } else {
      setSelectedRole(role);
      if (role === 'store' || role === 'inspector' || role === 'data_entry' || role === 'inspection_employee' || role === 'management' || role === 'admin') {
        setUsername(''); // Do not auto-fill for store, inspector, inspection employee, management and admin
      } else {
        setUsername(role); // Auto-fill username based on role for simplicity in this flow
      }
      setPassword(''); // Clear password
    }
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setUsername('');
    setPassword('');
    setScannedQr(null);
    setOtpRequired(false);
    setLoginOtp('');
    setOtpEmail('');
  };

  const handleNavigation = (role: string, extraState = {}) => {
    switch (role) {
      case 'admin':
        navigate('/tool-master', { state: extraState });
        break;
      case 'inspector':
      case 'inspection_employee':
        navigate('/inspector');
        break;
      case 'store':
        navigate('/store-view');
        break;
      case 'management':
        navigate('/dashboard');
        break;
      case 'data_entry':
        navigate('/tool-master', { state: { view: 'new', mode: 'create', ...extraState } });
        break;
      default:
        navigate('/');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setScanning(true);
    const html5QrCode = new Html5Qrcode("reader-hidden-login");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      let code = decodedText;
      if (decodedText.includes('/view-tool/')) {
        code = decodedText.split('/view-tool/')[1];
      }
      setScannedQr(code);
      toast.success("QR Code Scanned! Enter Password to proceed.");
    } catch (err) {
      console.error("Error scanning file", err);
      toast.error("Could not read QR code");
    } finally {
      setScanning(false);
      html5QrCode.clear();
    }
  };

  const handleLogin = async () => {
    setSubmitting(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username.trim());
      formData.append('password', password);

      const response = await api.post('/users/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.data.otp_required) {
        setOtpRequired(true);
        let destination = '';
        if (response.data.phone) {
          const sender = response.data.sender_phone ? ` from ${response.data.sender_phone}` : '';
          destination = `phone ${response.data.phone}${sender}`;
        } else {
          destination = `email ${response.data.email}`;
        }
        setOtpEmail(destination);
        toast.success(`Verification code sent to ${destination}`);
        return;
      }

      const { access_token, role } = response.data;

      // Role enforcement: Check if the user's role matches the selected portal
      // Exception: allow 'admin' to access any portal
      if (selectedRole && role !== selectedRole && role !== 'admin') {
        toast.error('Invalid username or password');
        return;
      }

      sessionStorage.setItem('token', access_token);

      // Fetch full profile from backend to guarantee latest fields (name, site)
      const profileRes = await api.get('/users/me');
      const profile = profileRes.data;

      const user: User = {
        id: profile.username || username,
        name: profile.full_name || profile.username || username,
        role: profile.role as User['role'],
        site: profile.site
      };

      onLogin(user);
      toast.success('Login successful');
      handleNavigation(role, scannedQr ? { qrCode: scannedQr } : {});
    } catch (error: any) {
      console.error('Login failed', error);
      if (error.response && error.response.data && error.response.data.detail) {
        toast.error(error.response.data.detail);
      } else if (error.response && error.response.status === 401) {
        toast.error('No users found. Please check your credentials.');
      } else if (error.message === "Network Error" || !error.response) {
        toast.error('Server is unreachable. Please try again later.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyLoginOtp = async () => {
    if (!loginOtp.trim()) {
      toast.error('Please enter the verification code');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.post('/users/token/verify-otp', {
        username: username.trim(),
        otp: loginOtp.trim(),
      });

      const { access_token, role } = response.data;

      // Role enforcement: Check if the user's role matches the selected portal
      // Exception: allow 'admin' to access any portal
      if (selectedRole && role !== selectedRole && role !== 'admin') {
        toast.error('Invalid username or password');
        return;
      }

      sessionStorage.setItem('token', access_token);

      // Fetch full profile from backend to guarantee latest fields (name, site)
      const profileRes = await api.get('/users/me');
      const profile = profileRes.data;

      const user: User = {
        id: profile.username || username,
        name: profile.full_name || profile.username || username,
        role: profile.role as User['role'],
        site: profile.site
      };

      onLogin(user);
      toast.success('Login successful');
      handleNavigation(role, scannedQr ? { qrCode: scannedQr } : {});
    } catch (error: any) {
      console.error('OTP verification failed', error);
      if (error.response && error.response.data && error.response.data.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Verification failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleWorkerAccess = () => {
    const workerUser: User = {
      id: 'worker-guest',
      name: 'Guest Worker',
      role: 'worker'
    };
    onLogin(workerUser);
    toast.success('Entered as Guest Worker');
    navigate('/worker');
  };

  const roleCards = [
    {
      id: 'admin',
      title: 'Admin',
      description: 'Manage tools & generate QRs',
      icon: UserCog,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      id: 'store',
      title: 'Store',
      description: 'Update site locations',
      icon: Store,
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      id: 'inspector',
      title: 'Inspection', // Display Name
      roleValue: 'inspector', // Actual role value
      description: 'Verify condition & safety',
      icon: Shield,
      color: 'bg-green-50 text-green-600'
    },
    {
      id: 'inspection_employee',
      title: 'Inspection Employee',
      description: 'Perform tool inspections',
      icon: ClipboardCheck,
      color: 'bg-emerald-50 text-emerald-600'
    },
    { // Added Management Role to cards
      id: 'management',
      title: 'Management',
      description: 'View Dashboard & Reports',
      icon: UserCog, // Using UserCog for now, or maybe a Chart icon if available
      color: 'bg-purple-50 text-purple-600'
    },
    {
      id: 'data_entry',
      title: 'Data Entry',
      description: 'Inventory & QR Generation',
      icon: UserCog,
      color: 'bg-teal-50 text-teal-600'
    },
    {
      id: 'worker',
      title: 'Worker',
      description: 'Check status & compatibility',
      icon: HardHat,
      color: 'bg-orange-50 text-orange-600',
      noLogin: true
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">

      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-50 z-0"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* Dynamic Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[128px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full mix-blend-screen filter blur-[128px]"></div>

      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 z-0"></div>

      <div className="w-full max-w-[450px] relative z-10 transition-all duration-500">
        {/* Logo/Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#134377] p-5 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-[0_0_25px_rgba(19,67,119,0.4)] mb-5 w-40 h-28">
            <img
              src={ltLogo}
              alt="L&T Construction Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">QR Tool MS</h1>
          <p className="text-blue-400/80 text-xs font-semibold tracking-[0.2em] uppercase">Enterprise Access</p>
        </div>

        <div className="bg-neutral-900/60 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Internal subtle glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

          {!selectedRole ? (
            // Role Selection View 
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Select Role</h2>
                <p className="text-sm text-neutral-400">Choose your portal to continue</p>
              </div>

              <div className="space-y-3">
                {roleCards.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className="w-full flex items-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left group"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mr-3 border border-white/5`}>
                      <role.icon className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{role.title}</h3>
                      <p className="text-xs text-neutral-500">{role.description}</p>
                    </div>
                    {role.noLogin ? (
                      <span className="text-[10px] text-orange-400/90 font-medium px-2 py-0.5 border border-orange-500/20 rounded bg-orange-500/10">Guest</span>
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-neutral-500 group-hover:text-white rotate-180 transition-colors" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Login Form View 
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 relative">

              <button
                onClick={handleBackToRoles}
                className="absolute -top-2 -left-2 text-neutral-400 hover:text-white flex items-center text-xs font-medium transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
              </button>

              <div className="text-center mb-8 mt-6">
                <div className="w-12 h-12 mx-auto bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mb-3">
                  {(() => {
                    const Icon = roleCards.find(r => r.id === selectedRole)?.icon || UserCog;
                    return <Icon className="w-6 h-6 text-blue-400" />;
                  })()}
                </div>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight capitalize">{selectedRole === 'inspector' ? 'Inspection' : selectedRole === 'inspection_employee' ? 'Inspection Employee' : selectedRole} Portal</h2>
                <p className="text-neutral-400 text-sm font-medium">Authenticate your session</p>
              </div>

              <div className="space-y-5">

                 {(selectedRole === 'store' || selectedRole === 'inspector' || selectedRole === 'data_entry' || selectedRole === 'inspection_employee' || selectedRole === 'management' || selectedRole === 'admin') && (
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">User ID / Mail ID / Phone number</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <UserCog className="h-4 w-4 text-neutral-500" />
                      </div>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter User ID, Mail ID, or Phone number"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-12 w-full pl-10 pr-3 rounded-xl border-white/10 bg-black/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-inner transition-all text-white placeholder:text-neutral-600"
                        autoFocus={selectedRole === 'store' || selectedRole === 'inspector' || selectedRole === 'data_entry' || selectedRole === 'inspection_employee' || selectedRole === 'management' || selectedRole === 'admin'}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Password</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Shield className="h-4 w-4 text-neutral-500" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !otpRequired && handleLogin()}
                      className="h-12 w-full pl-10 pr-10 rounded-xl border-white/10 bg-black/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-inner transition-all text-white placeholder:text-neutral-600"
                      autoFocus={selectedRole !== 'store' && selectedRole !== 'inspector' && selectedRole !== 'data_entry' && selectedRole !== 'inspection_employee' && selectedRole !== 'management' && selectedRole !== 'admin'}
                      disabled={otpRequired}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {otpRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="login-otp" className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Verification Code</Label>
                    <Input
                      id="login-otp"
                      type="text"
                      placeholder={`Enter the code sent to ${otpEmail}`}
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyLoginOtp()}
                      maxLength={6}
                      className="h-12 w-full px-3 rounded-xl border-white/10 bg-black/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-inner transition-all text-white placeholder:text-neutral-600"
                      autoFocus
                    />
                    <p className="text-xs text-neutral-500">A verification code was sent to {otpEmail}.</p>
                    <button
                      type="button"
                      onClick={() => { setOtpRequired(false); setLoginOtp(''); }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                      &larr; Use a different account
                    </button>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 transition-all duration-200"
                    onClick={otpRequired ? handleVerifyLoginOtp : handleLogin}
                    disabled={submitting}
                  >
                    {submitting ? 'Please wait...' : otpRequired ? 'Verify & Sign In' : 'Sign In'}
                  </Button>
                </div>
              </div>

            </div>
          )}

        </div>

        <div className="mt-6 text-center text-xs text-white font-medium">
          UJ Enterprises & Tharamac &copy; 2026 QR Tool Management System
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileUpload}
      />
    </div>
  );
};

export default LoginPage;