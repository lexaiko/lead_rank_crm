import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Shield, Loader2, LockKeyhole, Plus, X } from 'lucide-react';

const moduleLabels: Record<string, { title: string; desc: string }> = {
  dashboard: { 
    title: 'Dashboard Monitoring', 
    desc: 'Membuka tab Dashboard untuk melihat statistik performa bisnis dan grafik interaktif.' 
  },
  leads: { 
    title: 'Leads Directory (Data Prospek)', 
    desc: 'Mengakses direktori prospek (Leads), detail trip, serta riwayat obrolan Whatsapp.' 
  },
  customers: { 
    title: 'Customers Directory (Database Pelanggan)', 
    desc: 'Membuka data profil kontak seluruh pelanggan yang terdaftar di dalam sistem.' 
  },
  queue: { 
    title: 'AI Worker Queue (Antrean AI)', 
    desc: 'Memantau antrean pemrosesan ekstraksi chat otomatis oleh AI secara real-time.' 
  },
  reports: { 
    title: 'Analytics Reports (Laporan Analisis)', 
    desc: 'Membuka menu laporan analitik performa konversi penjualan per agen CS.' 
  },
  settings: { 
    title: 'WhatsApp Connections (Koneksi WA)', 
    desc: 'Mengontrol koneksi socket WhatsApp Web Baileys (menghubungkan & memutuskan nomor).' 
  },
  users: { 
    title: 'User Accounts (Manajemen User)', 
    desc: 'Membuka menu manajemen user untuk menambah, mengedit, mematikan status, atau menghapus akun CS/Admin.' 
  },
  roles: { 
    title: 'Role Permissions (Manajemen Role)', 
    desc: 'Mengakses menu kebijakan wewenang hak akses per modul dan menambahkan tipe role kustom.' 
  }
};

export const Roles: React.FC = () => {
  const { 
    roles, 
    fetchRoles, 
    updateRolePermissions, 
    createRole,
    user,
    isLoading 
  } = useStore();

  // Create Role Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [roleFormMsg, setRoleFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const success = await createRole(newRoleName);
    if (success) {
      setRoleFormMsg({ type: 'success', text: `Role "${newRoleName.toUpperCase()}" registered successfully!` });
      setNewRoleName('');
      setTimeout(() => {
        setIsModalOpen(false);
        setRoleFormMsg(null);
      }, 1500);
    } else {
      setRoleFormMsg({ type: 'error', text: 'Failed to create role. Check if role name is unique.' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Header Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
            Hak Akses & Role
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Atur kebijakan izin modul (none, read, write) untuk tiap tingkatan akun pengguna.
          </p>
        </div>
        
        {/* Create Role Trigger Button */}
        {user && user.role === 'ADMIN' && (
          <button
            onClick={() => {
              setNewRoleName('');
              setRoleFormMsg(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-all select-none cursor-pointer sm:self-center"
          >
            <Plus size={15} /> Add New Role
          </button>
        )}
      </div>

      {/* Role list panels */}
      <div className="flex flex-col gap-8">
        {roles.map((role) => (
          <div key={role.id} className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-5">
            
            {/* Role Title Section */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary animate-pulse" />
                <span className="text-sm font-bold text-foreground tracking-tight uppercase">
                  {role.name} Access Permissions
                </span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Role ID: #{role.id}
              </span>
            </div>

            {/* Modules matrix grid inside Role (One row list) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.keys(role.permissions || {}).map((module) => {
                const currentLevel = (role.permissions as any)[module] || 'none';
                const info = moduleLabels[module] || { 
                  title: module, 
                  desc: `Mengatur hak akses dan wewenang untuk modul ${module}.` 
                };
                
                return (
                  <div key={module} className="p-4 rounded-xl bg-card border border-border/70 flex flex-col justify-between gap-4 shadow-sm hover:border-primary/25 transition-all">
                    <div className="flex flex-col gap-1.5 text-left">
                      <span className="text-xs font-bold text-foreground font-sans">
                        {info.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-relaxed font-normal">
                        {info.desc}
                      </span>
                    </div>
                    
                    {/* Weight Controls */}
                    <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border border-border/40 w-full mt-2">
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
                            className={`flex-1 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer select-none text-center ${
                              isSelected
                                ? level === 'write'
                                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/10 font-black'
                                  : level === 'read'
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10 font-black'
                                  : 'bg-muted-foreground text-card shadow-sm font-black'
                                : 'text-muted-foreground hover:text-foreground hover:bg-card/45'
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

      {/* Create New Role Pop-up Dialog Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border py-4 px-5 bg-muted/30">
              <div className="flex items-center gap-2">
                <LockKeyhole size={16} className="text-primary" />
                <span className="font-bold text-sm text-foreground">Create New Access Role</span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateRoleSubmit} className="p-6 flex flex-col gap-4">
              {roleFormMsg && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold ${
                  roleFormMsg.type === 'success' 
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' 
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-500'
                }`}>
                  {roleFormMsg.text}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role Name</label>
                <input
                  type="text"
                  placeholder="e.g. SUPERVISOR, OUTSOURCING"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isLoading && <Loader2 size={12} className="animate-spin" />}
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Roles;
