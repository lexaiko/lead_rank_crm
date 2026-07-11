import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Customers } from './pages/Customers';
import { AIQueue } from './pages/AIQueue';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
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
        <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20 mb-4 animate-pulse">
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
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'leads':
        return <Leads />;
      case 'customers':
        return <Customers />;
      case 'ai-queue':
        return <AIQueue />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return <DashboardLayout>{renderActivePage()}</DashboardLayout>;
};

export default App;
