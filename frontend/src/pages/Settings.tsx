import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { ToggleLeft, ToggleRight, Wifi, WifiOff, X, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export const Settings: React.FC = () => {
  const { 
    dashboardData, 
    fetchDashboard, 
    toggleAdmin,
    logoutAdmin,
    isLoading 
  } = useStore();

  // QR Modal State
  const [qrModalAdmin, setQrModalAdmin] = useState<{ id: number; name: string } | null>(null);
  const [qrStatusText, setQrStatusText] = useState('Initializing WhatsApp instance...');
  const [showIframe, setShowIframe] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [logoutConfirmAdmin, setLogoutConfirmAdmin] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    fetchDashboard();
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
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
          WhatsApp Connection Management
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Monitor WhatsApp Baileys active connection sockets, link or scan QR code tokens, and check connection logs.
        </p>
      </div>

      {/* Admin List Section */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          WhatsApp Sockets CS Agents
        </span>

        {/* Desktop view table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ID</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agent Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">WhatsApp Number</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-sans">Access Role</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Socket Connection</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/55 text-sm font-semibold">
              {admins.map((adm) => (
                <tr key={adm.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5 text-muted-foreground font-mono">#{adm.id}</td>
                  <td className="px-4 py-3.5 text-foreground">{adm.nama_admin}</td>
                  <td className="px-4 py-3.5 font-mono text-muted-foreground font-normal">
                    {adm.nomor_wa || <span className="text-xs text-muted-foreground/50 italic font-sans">No WA Assigned</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                      {adm.role}
                    </span>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenQr(adm.id, adm.nama_admin)}
                          className="px-3.5 py-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs rounded-lg transition-all cursor-pointer select-none whitespace-nowrap"
                        >
                          Link / Scan QR
                        </button>
                        {adm.connected && (
                          <button
                            onClick={() => setLogoutConfirmAdmin({ id: adm.id, name: adm.nama_admin })}
                            className="px-3.5 py-1.5 border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-bold text-xs rounded-lg transition-all cursor-pointer select-none whitespace-nowrap"
                          >
                            Logout WA
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 font-bold italic uppercase tracking-wider font-sans">Monitoring Only</span>
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
                {adm.nomor_wa ? (
                  <div className="flex items-center gap-2 w-full justify-end">
                    <button
                      onClick={() => handleOpenQr(adm.id, adm.nama_admin)}
                      className="px-3 py-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs rounded-lg transition-all cursor-pointer select-none whitespace-nowrap"
                    >
                      Link / Scan QR
                    </button>
                    {adm.connected && (
                      <button
                        onClick={() => setLogoutConfirmAdmin({ id: adm.id, name: adm.nama_admin })}
                        className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-bold text-xs rounded-lg transition-all cursor-pointer select-none whitespace-nowrap"
                      >
                        Logout WA
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/50 font-bold italic uppercase tracking-wider font-sans">Monitoring Only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                  className="px-3.5 py-1.5 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
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

      {/* Logout Confirmation Modal */}
      {logoutConfirmAdmin && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLogoutConfirmAdmin(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-up text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border py-4.5 px-5 bg-rose-500/10 dark:bg-rose-500/5">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-rose-500 flex items-center gap-2">
                  ⚠️ Peringatan Logout
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">Admin: {logoutConfirmAdmin.name}</span>
              </div>
              <button 
                onClick={() => setLogoutConfirmAdmin(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-4">
              <span className="text-sm font-bold leading-relaxed text-foreground">
                Apakah Anda yakin ingin memutuskan koneksi WhatsApp untuk agen ini?
              </span>
              <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                Sesi koneksi akan diputus secara permanen dari server. Anda harus memindai ulang QR Code untuk menghubungkannya kembali.
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-4 bg-muted/20 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setLogoutConfirmAdmin(null)}
                className="px-3.5 py-1.5 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  const adminId = logoutConfirmAdmin.id;
                  setLogoutConfirmAdmin(null);
                  await logoutAdmin(adminId);
                }}
                className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Ya, Logout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
