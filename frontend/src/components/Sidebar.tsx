import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  LayoutDashboard, 
  Database, 
  Users, 
  Bot, 
  BarChart3, 
  Settings, 
  Sun, 
  Moon, 
  RefreshCw, 
  Menu, 
  X,
  Compass,
  LogOut,
  UserCog,
  Shield,
  MoreHorizontal
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeTab, 
    setTab, 
    theme, 
    toggleTheme,
    user,
    logout
  } = useStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads Directory', shortLabel: 'Leads', icon: Database },
    { id: 'customers', label: 'Customers', shortLabel: 'Cust', icon: Users },
    { id: 'ai-queue', label: 'AI Worker Queue', shortLabel: 'Queue', icon: Bot },
    { id: 'users', label: 'User Accounts', shortLabel: 'Users', icon: UserCog },
    { id: 'roles', label: 'Role Permissions', shortLabel: 'Roles', icon: Shield },
    { id: 'settings', label: 'Settings', shortLabel: 'Setting', icon: Settings },
    { id: 'reports', label: 'Analytics Reports', shortLabel: 'Reports', icon: BarChart3 },
  ] as const;

  const sidebarContent = (
    <div className={`h-full flex flex-col justify-between py-6 bg-card border-r border-border text-foreground transition-all duration-200 w-full overflow-x-hidden ${
      isCollapsed ? 'px-2' : 'px-4'
    }`}>
      <div>
        {/* Sidebar Header Logo */}
        <div className="flex items-center justify-between px-2 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/20">
              <Compass size={22} />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col text-left">
                <span className="font-heading font-extrabold text-lg leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
                  TripBwi CRM
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-0.5 font-sans">
                  Core Console
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {menuItems
            .filter((item) => {
              if (!user) return false;
              const permissions = user.permissions || {};
              const permissionKey = item.id === 'ai-queue' ? 'queue' : item.id;
              return permissions[permissionKey] !== 'none';
            })
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTab(item.id);
                  }}
                  className={`flex items-center gap-3 py-3 rounded-xl font-medium text-sm transition-all duration-150 relative ${
                    isCollapsed ? 'px-2 justify-center' : 'px-3.5'
                  } ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  title={item.label}
                >
                  <Icon size={18} className="shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                  {isActive && !isCollapsed && (
                    <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  )}
                </button>
              );
            })}
        </nav>
      </div>

      {/* Sidebar Footer Actions */}
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        {/* User profile & Logout */}
        {user && (
          <div className="px-2">
            <div className={`flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border/50 ${isCollapsed ? 'flex-col py-2' : ''}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {/* User Avatar Initials */}
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-black text-xs uppercase flex items-center justify-center shrink-0 border border-primary/20">
                  {user.nama_admin.slice(0, 2)}
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[11px] font-black text-foreground leading-tight truncate" title={user.nama_admin}>
                      {user.nama_admin}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                      {user.role}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Logout Button */}
              <button
                onClick={() => logout()}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 active:scale-[0.95] transition-all cursor-pointer shrink-0"
                title="Logout from console"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Theme and Collapse Buttons */}
        <div className={`flex items-center px-2 border-t border-border/40 pt-4 ${isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:block p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold">
            <Compass size={18} />
          </div>
          <span className="font-heading font-extrabold text-md tracking-tight">TripBwi CRM</span>
        </div>
        
        {/* Mobile Header Quick Actions */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {(() => {
        const allowedItems = menuItems.filter((item) => {
          if (!user) return false;
          const permissions = user.permissions || {};
          const permissionKey = item.id === 'ai-queue' ? 'queue' : item.id;
          return permissions[permissionKey] !== 'none';
        });

        const useMoreMenu = allowedItems.length > 5;
        const primaryItems = useMoreMenu ? allowedItems.slice(0, 4) : allowedItems;
        const moreItems = useMoreMenu ? allowedItems.slice(4) : [];

        return (
          <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 flex items-center justify-around px-1 shadow-lg pb-safe">
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTab(item.id);
                      setShowMoreMenu(false);
                    }}
                    className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 relative select-none cursor-pointer ${
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} className="shrink-0 mb-0.5" />
                    <span className={`text-[9px] font-bold tracking-tight text-center ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}

              {useMoreMenu && (
                <button
                  onClick={() => setShowMoreMenu(prev => !prev)}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 relative select-none cursor-pointer ${
                    showMoreMenu ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <MoreHorizontal size={18} className="shrink-0 mb-0.5" />
                  <span className={`text-[9px] font-bold tracking-tight text-center ${
                    showMoreMenu ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    Lainnya
                  </span>
                </button>
              )}
            </div>

            {/* Mobile Drawer (Lainnya) Sheet */}
            {showMoreMenu && useMoreMenu && (
              <>
                {/* Backdrop overlay */}
                <div 
                  className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-45 transition-opacity duration-200"
                  onClick={() => setShowMoreMenu(false)}
                />
                {/* Slide-up sheet */}
                <div className="md:hidden fixed bottom-16 left-3 right-3 max-h-[70vh] overflow-y-auto bg-card border border-border/80 z-50 rounded-3xl shadow-2xl p-5 animate-slide-up flex flex-col gap-4">
                  {/* Header pull line */}
                  <div className="w-12 h-1 bg-border rounded-full mx-auto shrink-0" />
                  
                  <div className="flex items-center justify-between border-b border-border/40 pb-2.5 shrink-0">
                    <span className="font-heading font-black text-sm text-foreground tracking-tight">Menu Navigasi</span>
                    <button 
                      onClick={() => setShowMoreMenu(false)}
                      className="h-6 w-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* List of more items */}
                  <div className="flex flex-col gap-1 overflow-y-auto">
                    {moreItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setTab(item.id);
                            setShowMoreMenu(false);
                          }}
                          className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon size={16} className="shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* Desktop Persistent Sidebar */}
      <aside className={`hidden md:block shrink-0 h-screen sticky top-0 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}>
        {sidebarContent}
      </aside>
    </>
  );
};
