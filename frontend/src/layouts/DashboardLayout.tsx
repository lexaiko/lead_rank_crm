import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { LeadDetailDrawer } from '../components/LeadDetailDrawer';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground transition-all duration-200">
      
      {/* Collapsible Left Navigation */}
      <Sidebar />

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 pb-16 md:pb-0">
        <div className="flex-1 px-4 md:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Slide-out details drawer overlays */}
      <LeadDetailDrawer />

    </div>
  );
};
