import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { FollowUp } from './pages/FollowUp';
import { Customers } from './pages/Customers';
import { AIQueue } from './pages/AIQueue';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { ErrorLogs } from './pages/ErrorLogs';
import { AIConfig } from './pages/AIConfig';
import { ExportData } from './pages/ExportData';
import { Profile } from './pages/Profile';
import { Chat } from './pages/Chat';
import { Login } from './pages/Login';
import { Compass, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { activeTab, theme, setTheme, user, checkingAuth, checkAuth } = useStore();

  // Apply theme initial sync & check user authentication status
  useEffect(() => {
    setTheme(theme);
    checkAuth();
  }, []);

  // Show a full-screen dynamic loader during session check
  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#080c14] text-foreground">
        <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/20 mb-4 animate-pulse">
          <Compass size={24} className="animate-spin-slow" />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          <Loader2 size={12} className="animate-spin" />
          <span>Synchronizing Console Session...</span>
        </div>
      </div>
    );
  }

  // Redirect to Login if unauthenticated
  if (!user) {
    return <Login />;
  }

  const renderActivePage = () => {
    const permissions = user?.permissions || {};

    // Helper: cek apakah user punya akses ke suatu tab (bukan 'none')
    const canAccess = (permKey: string) => permissions[permKey] !== 'none';

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'chat':
        return (canAccess('chat') || canAccess('leads')) ? <Chat /> : <Dashboard />;
      case 'leads':
        return canAccess('leads') ? <Leads /> : <Dashboard />;
      case 'followup':
        return canAccess('leads') ? <FollowUp /> : <Dashboard />;
      case 'customers':
        return canAccess('customers') ? <Customers /> : <Dashboard />;
      case 'ai-queue':
        return canAccess('queue') ? <AIQueue /> : <Dashboard />;
      case 'ai-config':
        return canAccess('ai-config') ? <AIConfig /> : <Dashboard />;
      case 'reports':
        return canAccess('reports') ? <Reports /> : <Dashboard />;
      case 'settings':
        return canAccess('settings') ? <Settings /> : <Dashboard />;
      case 'users':
        return canAccess('users') ? <Users /> : <Dashboard />;
      case 'roles':
        return canAccess('roles') ? <Roles /> : <Dashboard />;
      case 'error-logs':
        return canAccess('error-logs') ? <ErrorLogs /> : <Dashboard />;
      case 'export':
        return (canAccess('export') || canAccess('leads')) ? <ExportData /> : <Dashboard />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard />;
    }
  };

  return <DashboardLayout>{renderActivePage()}</DashboardLayout>;
};

export default App;
