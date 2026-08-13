import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../store/services/api';
import { 
  User, 
  Phone, 
  Key, 
  QrCode, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LogOut, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Loader2,
  Save
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, checkAuth, theme, fetchMyWaStatus } = useStore();
  const [waStatus, setWaStatus] = useState<{
    connected: boolean;
    qr: string | null;
    nomor_wa: string | null;
    connectedUser?: string;
  } | null>(null);
  
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit profile form state
  const [namaAdmin, setNamaAdmin] = useState(user?.nama_admin || '');
  const [nomorWa, setNomorWa] = useState(user?.nomor_wa || '');
  const [password, setPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setNamaAdmin(user.nama_admin);
      setNomorWa(user.nomor_wa || '');
    }
  }, [user]);

  const fetchWAStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.getMyWAStatus();
      if (res.success) {
        setWaStatus({
          connected: res.connected,
          qr: res.qr,
          nomor_wa: res.nomor_wa,
          connectedUser: res.connectedUser
        });
        fetchMyWaStatus();
      }
    } catch (e) {
      console.error('Error fetching WA status:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchWAStatus();

    // Auto-poll status every 4 seconds to detect QR scanning or disconnection
    const interval = setInterval(() => {
      api.getMyWAStatus().then(res => {
        if (res.success) {
          setWaStatus({
            connected: res.connected,
            qr: res.qr,
            nomor_wa: res.nomor_wa,
            connectedUser: res.connectedUser
          });
          fetchMyWaStatus();
        }
      }).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleStartSession = async () => {
    setActionLoading(true);
    setNotification(null);
    try {
      const res = await api.startMyWASession();
      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        await fetchWAStatus();
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal memulai sesi WhatsApp.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogoutSession = () => {
    setShowLogoutModal(true);
  };

  const confirmLogoutSession = async () => {
    setShowLogoutModal(false);
    setActionLoading(true);
    setNotification(null);
    try {
      const res = await api.logoutMyWASession();
      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        await fetchWAStatus();
      } else {
        setNotification({ type: 'error', message: 'Gagal memutuskan sesi WhatsApp.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearSession = async () => {
    setActionLoading(true);
    setNotification(null);
    try {
      const res = await api.clearMyWASession();
      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        await fetchWAStatus();
      } else {
        setNotification({ type: 'error', message: 'Gagal membersihkan data sesi.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setNotification(null);
    try {
      const payload: { nama_admin?: string; nomor_wa?: string; password?: string } = {
        nama_admin: namaAdmin,
        nomor_wa: nomorWa
      };
      if (password) payload.password = password;

      const res = await api.updateMyProfile(payload);
      if (res.success) {
        setNotification({ type: 'success', message: 'Profil Anda berhasil diperbarui!' });
        setPassword('');
        await checkAuth();
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal memperbarui profil.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan.' });
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header Profile Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-orange-500/20 border border-white/10 shrink-0">
            {user.nama_admin.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-heading font-black text-2xl tracking-tight text-foreground">
              Profil Saya &amp; Sesi WA
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Kelola informasi akun dan koneksi WhatsApp Anda secara mandiri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={14} />
            {user.role}
          </span>
        </div>
      </div>

      {/* Global Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 transition-all ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WhatsApp Connection Management (Main Card) */}
        <div className="lg:col-span-7 bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Phone size={20} />
                </div>
                <div>
                  <h2 className="font-heading font-black text-base text-foreground">Koneksi WhatsApp Mandiri</h2>
                  <p className="text-xs text-muted-foreground">Hubungkan akun WhatsApp Anda untuk tracking &amp; respon pelanggan</p>
                </div>
              </div>

              <button
                onClick={fetchWAStatus}
                disabled={loadingStatus}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
                title="Refresh Status WA"
              >
                <RefreshCw size={16} className={loadingStatus ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* WA Connection Status Badge */}
            {(() => {
              const currentWaNumber = nomorWa || user.nomor_wa || waStatus?.nomor_wa;
              const hasWaNumber = !!currentWaNumber && currentWaNumber.trim().length > 5;

              if (!hasWaNumber) {
                return (
                  <>
                    <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-semibold">Status Sesi WA:</span>
                            <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              BELUM DIATUR
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium mt-1">
                            Nomor Terdaftar: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">Belum Diisi</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col items-center justify-center p-8 border-2 border-dashed border-amber-500/30 rounded-3xl bg-amber-500/5 text-center">
                      <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                        <Phone size={24} />
                      </div>
                      <h3 className="text-sm font-bold text-foreground mb-1">Nomor WhatsApp Belum Diisi</h3>
                      <p className="text-xs text-muted-foreground max-w-md mb-2">
                        Fitur koneksi WhatsApp membutuhkan nomor WhatsApp terdaftar. Silakan masukkan nomor HP/WA Anda pada kolom form <b>Pengaturan Akun</b> di sebelah kanan, lalu klik <b>Simpan Perubahan Profil</b>.
                      </p>
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div className="mt-5 p-4 rounded-2xl bg-muted/40 border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {waStatus?.connected ? (
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                          <Wifi size={20} />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                          <WifiOff size={20} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-semibold">Status Sesi WA:</span>
                          <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            waStatus?.connected
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}>
                            {waStatus?.connected ? 'TERHUBUNG (ONLINE)' : 'TERPUTUS (OFFLINE)'}
                          </span>
                        </div>
                        {waStatus?.connected && waStatus.connectedUser && (
                          <p className="text-xs font-bold text-foreground mt-1">
                            Nomor Terhubung: <span className="font-mono text-emerald-500">{waStatus.connectedUser}</span>
                          </p>
                        )}
                        {!waStatus?.connected && (
                          <p className="text-[11px] text-muted-foreground font-medium mt-1">
                            Nomor Terdaftar: <span className="font-mono font-bold text-foreground">{waStatus?.nomor_wa || user.nomor_wa}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!waStatus?.connected ? (
                        <button
                          onClick={handleStartSession}
                          disabled={actionLoading}
                          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                          <span>{waStatus?.qr ? 'Refresh QR' : 'Hubungkan (Scan QR)'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleLogoutSession}
                          disabled={actionLoading}
                          className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                          <span>Putuskan Sesi</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* QR Scanner Frame Container */}
                  {!waStatus?.connected && (
                    <div className="mt-6 flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/80 rounded-3xl bg-muted/20 text-center">
                      <h3 className="text-sm font-bold text-foreground mb-1">Frame Scan QR WhatsApp</h3>
                      <p className="text-xs text-muted-foreground mb-4 max-w-md">
                        Buka aplikasi WhatsApp di HP Anda &gt; Perangkat Tertaut (Linked Devices) &gt; Tautkan Perangkat (Link a Device), lalu arahkan kamera ke QR berikut:
                      </p>

                      <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg bg-card p-2 w-[240px] h-[240px] flex items-center justify-center">
                        <iframe
                          src={`/api/admins/${user.id}/session?theme=${theme === 'dark' ? 'dark' : 'light'}`}
                          className="w-[220px] h-[220px] border-0 rounded-xl overflow-hidden"
                          title="WhatsApp QR Frame"
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-center gap-3">
                        <button
                          onClick={handleStartSession}
                          disabled={actionLoading}
                          className="px-3.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw size={13} className={actionLoading ? 'animate-spin' : ''} />
                          <span>Minta QR Baru</span>
                        </button>

                        <button
                          onClick={handleClearSession}
                          disabled={actionLoading}
                          className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Gunakan ini jika QR tidak muncul atau sesi macet"
                        >
                          <span>Bersihkan Sesi</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="text-[11px] text-muted-foreground font-medium border-t border-border/30 pt-3">
            💡 Sesi WhatsApp Anda tetap aktif di background. Jika tiba-tiba terputus, Anda bisa kembali ke halaman Profil ini untuk melakukan Reconnect kapan saja.
          </div>
        </div>

        {/* User Account Settings (Right Card) */}
        <div className="lg:col-span-5 bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-4">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
              <User size={20} />
            </div>
            <div>
              <h2 className="font-heading font-black text-base text-foreground">Pengaturan Akun</h2>
              <p className="text-xs text-muted-foreground">Perbarui data profil &amp; kata sandi akun Anda</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Username (ID Login)</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground text-xs font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Username tidak dapat diubah</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Nama Lengkap Admin / CS</label>
              <input
                type="text"
                value={namaAdmin}
                onChange={(e) => setNamaAdmin(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="Masukkan nama admin..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Nomor WhatsApp Terdaftar</label>
              <input
                type="text"
                value={nomorWa}
                onChange={(e) => setNomorWa(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono"
                placeholder="misal: 6281234567890"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Digunakan sebagai identitas nomor WA sesi Anda</span>
            </div>

            <div className="border-t border-border/40 pt-4">
              <label className="block text-xs font-bold text-foreground mb-1.5">Ubah Password Baru (Opsional)</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="Kosongkan jika tidak ingin diubah"
                />
                <Key size={14} className="absolute right-3.5 top-3 text-muted-foreground" />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 mt-4"
            >
              {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Simpan Perubahan Profil</span>
            </button>
          </form>
        </div>
      </div>

      {/* Custom Disconnect Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3.5 border-b border-border/40 pb-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-heading font-black text-lg text-foreground">Putuskan Sesi WhatsApp?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Konfirmasi Pemutusan Koneksi WhatsApp</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Apakah Anda yakin ingin memutuskan koneksi sesi WhatsApp akun ini? Setelah terputus, sistem tidak akan dapat menerima atau memproses pesan pesan masuk sampai Anda melakukan <b>Scan QR (Re-connect)</b> kembali.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmLogoutSession}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <LogOut size={15} />
                <span>Ya, Putuskan Sesi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
