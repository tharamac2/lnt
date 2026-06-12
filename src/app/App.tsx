import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout";
import ToolMaster from "./pages/ToolMaster";
import StoreView from "./pages/StoreView";
import InspectorView from "./pages/InspectorView";
import Dashboard from "./pages/Dashboard";
import WorkerView from "./pages/WorkerView";
import SplitToolMatching from "./pages/SplitToolMatching";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import UsersManagement from "./pages/UsersManagement";
import SettingsPage from "./pages/SettingsPage";
import ViewTool from "./pages/ViewTool";
import SplashScreen from "./components/SplashScreen";
import { Toaster } from "./components/ui/sonner";
import api from './services/api';

// QR Code-Based Tools Management & Inspection System
export interface User {
  id: string;
  name: string;
  role:
  | "admin"
  | "store"
  | "inspector"
  | "management"
  | "worker"
  | "data_entry";
  site?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const handleLogin = (user: User) => {
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/users/me');
          const userData = response.data;
          if (!userData.username || !userData.role) throw new Error('Invalid session');
          setUser({
            id: userData.username,
            name: userData.full_name || userData.username,
            role: userData.role as User['role'],
            site: userData.site
          });
        } catch (error) {
          console.error("Session restoration failed", error);
          localStorage.removeItem('token');
        }
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  if (showSplash || !authChecked) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Not logged in � show login page (ViewTool is public)
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  // Logged in � render all routes in a FLAT top-level Routes inside Layout
  // This avoids the React Router v6 descendant-route path matching bug
  // where nested <Routes> inside <Route path="/*"> matches paths relative
  // to the parent, causing absolute paths like /tool-master to never match.
  return (
    <BrowserRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {/* Public: QR view accessible when logged in too */}
          <Route path="/view-tool/:qrCode" element={<ViewTool />} />

          {/* -- Admin -- */}
          {user.role === "admin" && (
            <>
              <Route path="/" element={<Navigate to="/tool-master" replace />} />
              <Route path="/tool-master" element={<ToolMaster user={user} />} />
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/users" element={<UsersManagement />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}

          {/* -- Store -- */}
          {user.role === "store" && (
            <>
              <Route path="/" element={<Navigate to="/store-view" replace />} />
              <Route path="/store-view" element={<StoreView />} />
            </>
          )}

          {/* -- Inspector -- */}
          {user.role === "inspector" && (
            <>
              <Route path="/" element={<Navigate to="/inspector" replace />} />
              <Route path="/inspector" element={<InspectorView />} />
            </>
          )}

          {/* -- Management -- */}
          {user.role === "management" && (
            <>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/alerts" element={<Alerts />} />
            </>
          )}

          {/* -- Worker -- */}
          {user.role === "worker" && (
            <>
              <Route path="/" element={<Navigate to="/worker" replace />} />
              <Route path="/worker" element={<WorkerView />} />
              <Route path="/split-tool" element={<SplitToolMatching />} />
            </>
          )}

          {/* -- Data Entry -- */}
          {user.role === "data_entry" && (
            <>
              <Route path="/" element={<Navigate to="/tool-master" replace />} />
              <Route path="/tool-master" element={<ToolMaster user={user} />} />
            </>
          )}

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;