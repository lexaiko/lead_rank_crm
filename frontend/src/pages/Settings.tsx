import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { UserPlus, ToggleLeft, ToggleRight, Wifi, WifiOff, RefreshCw, X, Loader2, Phone, Shield, ShieldAlert, LockKeyhole, Eye } from 'lucide-react';
import { api } from '../services/api';

export const Settings: React.FC = () => {
  const { 
    dashboardData, 
    fetchDashboard, 
    createAdmin, 
    toggleAdmin,
    isLoading,
    user,
    roles,
    fetchRoles,
    updateRolePermissions
  } = useStore();

  // Form State
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleIdInput, setRoleIdInput] = useState(2); // Default to CS (id: 2)
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // QR Modal State
  const [qrModalAdmin, setQrModalAdmin] = useState<{ id: number; name: string } | null>(null);
  const [qrStatusText, setQrStatusText] = useState('Initializing WhatsApp instance...');
  const [showIframe, setShowIframe] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetchDashboard();
    if (user && user.role === 'ADMIN') {
      fetchRoles();
    }
  }, []);

  // Poll connection status while QR modal is open
  useEffect(() => {
    if (!qrModalAdmin) return;
    
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await api.getAdminStatus(qrModalAdmin.id);
        if (res.success && res.connected && isMounted) {
          setIsConnected(true);
          setQrStatusText('WhatsApp Connected Successfully!');
          clearInterval(interval);
          
          // Close modal and refresh dashboard
          setTimeout(() => {
            if (isMounted) {
              setQrModalAdmin(null);
              fetchDashboard();
            }
          }, 2000);
        }
      } catch (e) {
        console.error('Status poll error', e);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [qrModalAdmin]);

  if (!dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const { admins } = dashboardData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput || !usernameInput || !passwordInput) return;
    
    const success = await createAdmin({
      nama_admin: nameInput,
      nomor_wa: phoneInput || undefined,
      username: usernameInput,
      password: passwordInput,
      role_id: roleIdInput
    });
    if (success) {
      setFormMsg({ type: 'success', text: 'Admin account registered successfully!' });
      setNameInput('');
      setPhoneInput('');
      setUsernameInput('');
      setPasswordInput('');
      setRoleIdInput(2);
    } else {
      setFormMsg({ type: 'error', text: 'Failed to create Admin. Check if username is unique.' });
    }
    setTimeout(() => setFormMsg(null), 3000);
  };

  const handleOpenQr = (id: number, name: string) => {
    setIsConnected(false);
    setShowIframe(false);
    setQrStatusText('Generating connection socket. Please scan QR Code once rendered.');
    setQrModalAdmin({ id, name });
    
    // Delay iframe load to let baileys instance spin up
    setTimeout(() => {
      setShowIframe(true);
    }, 3000);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 dark:from-teal-400 dark:to-emerald-400">
          CS Accounts & Settings
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Manage WhatsApp CS PIC accounts, link/re-scan QR code tokens, and check connection logs.
        </p>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Admin List Column */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            WhatsApp Connections CS Agents
          </span>

          {/* Desktop view table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ID</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agent Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">WhatsApp Number</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Database Active</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Socket Connection</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/55 text-sm font-semibold">
                {admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground font-mono">#{adm.id}</td>
                    <td className="px-4 py-3.5 text-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span>{adm.nama_admin}</span>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-wide uppercase">{adm.role}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground font-normal">
                      {adm.nomor_wa || <span className="text-xs text-muted-foreground/50 italic font-sans">No WA Assigned</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <button 
                        onClick={() => toggleAdmin(adm.id)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                      >
                        {adm.is_active ? (
                          <span className="flex items-center gap-1 text-emerald-500 font-bold text-xs uppercase">
                            <ToggleRight size={20} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground/60 font-bold text-xs uppercase">
                            <ToggleLeft size={20} /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      {!adm.nomor_wa ? (
                        <span className="text-xs text-muted-foreground/50 font-bold uppercase tracking-wider">N/A</span>
                      ) : adm.connected ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-bold">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          Disconnected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {adm.nomor_wa ? (
                        <button
                          onClick={() => handleOpenQr(adm.id, adm.nama_admin)}
                          className="px-3.5 py-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs rounded-lg transition-all cursor-pointer select-none"
                        >
                          Link / Scan QR
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 font-bold italic uppercase tracking-wider">Monitoring Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View Card List */}
          <div className="block md:hidden flex flex-col gap-3">
            {admins.map((adm) => (
              <div key={adm.id} className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{adm.nama_admin}</span>
                    <span className="text-[10px] text-muted-foreground font-bold tracking-wide uppercase mt-0.5">{adm.role}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">#{adm.id}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs font-mono font-normal text-muted-foreground">
                  <span>Phone: {adm.nomor_wa || 'No WA Assigned'}</span>
                  {!adm.nomor_wa ? (
                    <span className="text-[10px] text-muted-foreground/50 font-bold uppercase">N/A</span>
                  ) : adm.connected ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Disconnected
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1 gap-4">
                  <button 
                    onClick={() => toggleAdmin(adm.id)}
                    className="flex items-center gap-1 text-xs select-none cursor-pointer"
                  >
                    {adm.is_active ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold uppercase text-[10px]">
                        <ToggleRight size={18} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground/60 font-bold uppercase text-[10px]">
                        <ToggleLeft size={18} /> Inactive
                      </span>
                    )}
                  </button>

                  {adm.nomor_wa ? (
                    <button
                      onClick={() => handleOpenQr(adm.id, adm.nama_admin)}
                      className="px-3 py-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs rounded-lg transition-all cursor-pointer select-none"
                    >
                      Link / Scan QR
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 font-bold italic uppercase tracking-wider">Monitoring Only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add CS Agent Column */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus size={14} /> Add CS Account
          </span>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {formMsg && (
              <div className={`p-3.5 rounded-xl border text-xs font-bold ${
                formMsg.type === 'success' 
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' 
                  : 'border-rose-500/20 bg-rose-500/5 text-rose-500'
              }`}>
                {formMsg.text}
              </div>
            )}

            {/* Agent Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input
                type="text"
                placeholder="e.g. Amanda Putri"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Username</label>
              <input
                type="text"
                placeholder="e.g. amandaputri"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            {/* Role Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Access Role</label>
              <select
                value={roleIdInput}
                onChange={(e) => setRoleIdInput(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              >
                <option value={2}>CS (Customer Service)</option>
                <option value={1}>ADMIN (Full Access)</option>
              </select>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">WhatsApp Number (Optional)</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. 62896xxxx"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-semibold mt-1">
                Leave empty for monitoring-only accounts. For CS, include country code (e.g. 62).
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Register CS Admin
            </button>
          </form>
        </div>

      </div>

      {/* Role & Permissions Dynamic Matrix (Superadmins only) */}
      {user && user.role === 'ADMIN' && roles.length > 0 && (
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={14} className="text-primary" /> Role Permission Matrix
            </span>
            <p className="text-[11px] text-muted-foreground font-semibold">
              Dynamically adjust authorization levels per module. Changes will apply in real-time across the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((role) => (
              <div key={role.id} className="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-sm font-bold text-foreground tracking-tight">{role.name} Role</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Role ID: #{role.id}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {Object.keys(role.permissions || {}).map((module) => {
                    const currentLevel = (role.permissions as any)[module] || 'none';
                    return (
                      <div key={module} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border/40">
                        <span className="text-xs font-bold text-foreground capitalize font-sans">{module}</span>
                        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/40 self-start sm:self-auto">
                          {(['none', 'read', 'write'] as const).map((level) => {
                            const isSelected = currentLevel === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => {
                                  if (role.name === 'ADMIN' && module === 'settings' && level !== 'write') {
                                    alert('Cannot demote ADMIN settings permissions to prevent lockout!');
                                    return;
                                  }
                                  const updatedPerms = {
                                    ...role.permissions,
                                    [module]: level
                                  };
                                  updateRolePermissions(role.id, updatedPerms);
                                }}
                                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer select-none ${
                                  isSelected
                                    ? level === 'write'
                                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                                      : level === 'read'
                                      ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/10'
                                      : 'bg-muted-foreground text-card shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Link Modal */}
      {qrModalAdmin && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setQrModalAdmin(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border py-4.5 px-5 bg-muted/30">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">Link WhatsApp</span>
                <span className="text-xs text-muted-foreground font-semibold mt-0.5">Admin: {qrModalAdmin.name}</span>
              </div>
              <button 
                onClick={() => setQrModalAdmin(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col items-center gap-5 text-center">
              <span className={`text-xs font-bold leading-relaxed px-1 ${
                isConnected ? 'text-emerald-500' : 'text-muted-foreground animate-pulse'
              }`}>
                {qrStatusText}
              </span>

              {/* QR Image IFrame Loader */}
              {showIframe && !isConnected ? (
                <div className="w-[202px] h-[202px] border border-border bg-white rounded-xl overflow-hidden flex items-center justify-center shadow-sm relative shrink-0">
                  <iframe 
                    src={`/api/admins/${qrModalAdmin.id}/session?theme=light&raw=true`} 
                    style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden' }}
                    scrolling="no"
                  />
                </div>
              ) : (
                !isConnected && (
                  <div className="w-[202px] h-[202px] border border-border/80 bg-muted/40 rounded-xl flex items-center justify-center shrink-0">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                )
              )}

              {isConnected && (
                <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center shrink-0 animate-bounce">
                  <Wifi size={28} />
                </div>
              )}

              {!isConnected && (
                <button
                  onClick={() => handleOpenQr(qrModalAdmin.id, qrModalAdmin.name)}
                  className="px-3.5 py-1.5 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  Regenerate QR
                </button>
              )}

              <span className="text-[11px] leading-relaxed text-muted-foreground font-semibold">
                Open WhatsApp on your phone, go to Menu ➔ Linked Devices ➔ Link a Device, and scan the QR.
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
