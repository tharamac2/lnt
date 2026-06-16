import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from '../App';
import api from '../services/api';
import {
  LayoutDashboard,
  Package,
  QrCode,
  ClipboardCheck,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  Wrench,
  ChevronDown,
  UserCircle,
  UserPlus,
  Truck,
  History,
  ScrollText,
  ClipboardList,
  Building2,
  Sliders,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';

interface LayoutProps {
  children: ReactNode;
  user: User;
  onLogout: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['admin', 'management'],
  },
  {
    path: '/tool-master',
    label: 'Tool Master',
    icon: <Package className="w-5 h-5" />,
    roles: ['admin', 'data_entry'],
  },
  {
    path: '/tool-config',
    label: 'Tool Config',
    icon: <Sliders className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    path: '/store-view',
    label: 'QR Scanner',
    icon: <QrCode className="w-5 h-5" />,
    roles: ['store'],
  },
  {
    path: '/store-inventory',
    label: 'Store Inventory',
    icon: <Package className="w-5 h-5" />,
    roles: ['store'],
  },
  {
    path: '/tools-movements',
    label: 'Tools Movements',
    icon: <Truck className="w-5 h-5" />,
    roles: ['store'],
  },
  {
    path: '/tools-movement-history',
    label: 'Tools Movement History',
    icon: <History className="w-5 h-5" />,
    roles: ['store'],
  },
  {
    path: '/inspector/profile',
    label: 'Profile',
    icon: <Building2 className="w-5 h-5" />,
    roles: ['inspector'],
  },
  {
    path: '/inspector',
    label: 'Inspection',
    icon: <ClipboardCheck className="w-5 h-5" />,
    roles: ['inspector', 'inspection_employee'],
  },
  {
    path: '/inspector/results',
    label: 'Inspection Results',
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ['inspector', 'inspection_employee'],
  },
  {
    path: '/inspector/add-employee',
    label: 'Add Employee',
    icon: <UserPlus className="w-5 h-5" />,
    roles: ['inspector'],
  },
  {
    path: '/worker',
    label: 'Tool Scan',
    icon: <Wrench className="w-5 h-5" />,
    roles: ['worker'],
  },
  {
    path: '/split-tool',
    label: 'Split Tool Check',
    icon: <QrCode className="w-5 h-5" />,
    roles: ['worker'],
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ['admin', 'management'],
  },
  {
    path: '/alerts',
    label: 'Alerts',
    icon: <Bell className="w-5 h-5" />,
    roles: ['admin', 'management'],
  },
  {
    path: '/dealers',
    label: 'Add Dealers',
    icon: <Truck className="w-5 h-5" />,
    roles: ['admin', 'store'],
  },
  {
    path: '/users',
    label: 'User Management',
    icon: <Users className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    path: '/audit-log',
    label: 'Audit Log',
    icon: <ScrollText className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    path: '/inspection-employees',
    label: 'Inspection Employees',
    icon: <UserCircle className="w-5 h-5" />,
    roles: ['admin', 'store'],
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    roles: ['admin'],
  },
];

const Layout = ({ children, user, onLogout }: LayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchLayoutAlerts = async () => {
    try {
      const response = await api.get('/alerts/');
      setAlerts(response.data);
    } catch (error) {
      console.error("Layout failed to fetch alerts", error);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'management')) {
      fetchLayoutAlerts();
      const interval = setInterval(fetchLayoutAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleNotificationClick = async (alertId: number, isRead: boolean) => {
    if (isRead) return;
    try {
      await api.post(`/alerts/${alertId}/read`);
      fetchLayoutAlerts();
    } catch (error) {
      console.error("Failed to mark alert as read", error);
    }
  };

  const layoutNotifications = alerts.slice(0, 5);
  const unreadCount = alerts.filter((a: any) => !a.is_read).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#CFDBFF]">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1E3A8A] rounded-lg flex items-center justify-center shrink-0">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="hidden xs:block">
                <h1 className="font-semibold text-[#0F172A] text-sm sm:text-base">Tool Management System</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Industrial & Construction</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-[#DC2626] text-white text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(320px,90vw)]">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <Badge variant="secondary">{unreadCount} New</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[300px]">
                  {layoutNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-3 py-3 hover:bg-gray-50 cursor-pointer border-b ${!notification.is_read ? 'bg-blue-50' : ''}`}
                      onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${!notification.is_read ? 'bg-[#1E3A8A]' : 'bg-gray-300'}`} />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.date).toLocaleDateString()} {new Date(notification.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {layoutNotifications.length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No notifications
                    </div>
                  )}
                </ScrollArea>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Link to="/alerts">
                    <Button variant="ghost" className="w-full text-sm">
                      View All Notifications
                    </Button>
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-gray-100">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-[#0F172A]">{user.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {user.role} {user.site && (user.role === 'store' || user.role === 'inspector' || user.role === 'inspection_employee' || user.role === 'data_entry') ? `- ${user.site}` : ''}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white font-medium">
                    {(user.name || user.id || '?').charAt(0)}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(224px,90vw)]">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {user?.role} {user?.site && (user?.role === 'store' || user?.role === 'inspector' || user?.role === 'inspection_employee' || user?.role === 'data_entry') ? `- ${user.site}` : ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside
          className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide ${sidebarOpen ? 'w-64' : 'w-20'
            }`}
        >
          <nav className="p-4 space-y-1 flex-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${sidebarOpen ? 'px-4' : 'justify-center px-2'} ${isActive
                    ? 'bg-[#1E3A8A] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {item.icon}
                  <span className={sidebarOpen ? '' : 'hidden'}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {sidebarOpen && (
            <div className="p-4 border-t border-gray-100 text-center">
              <p className="text-[10px] text-gray-400 font-medium">UJ Enterprises & Tharamac &copy; 2026<br />QR Tool Management System</p>
            </div>
          )}
        </aside>

        {/* Sidebar - Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
            <aside className="w-64 bg-white h-full flex flex-col overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
              <nav className="p-4 space-y-1 flex-1">
                {filteredNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                        ? 'bg-[#1E3A8A] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-gray-100 text-center mt-auto">
                <p className="text-[10px] text-gray-400 font-medium">UJ Enterprises & Tharamac &copy; 2026<br />QR Tool Management System</p>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;