import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  FileSpreadsheet, Calendar, Filter, Search, Download, Loader2, 
  CheckCircle2, Sparkles, User, Briefcase, Database, AlertTriangle, X, Check
} from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';

interface CustomNotice {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

const getDefaultDates = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    start: formatDateString(firstDayOfMonth),
    end: formatDateString(today)
  };
};

export const ExportData: React.FC = () => {
  const { user, admins, fetchAdmins } = useStore();

  // Local filter states for export (defaults to THIS_MONTH range: 1st of month to today)
  const defaultDates = getDefaultDates();
  const [dateFrom, setDateFrom] = useState<string>(defaultDates.start);
  const [dateTo, setDateTo] = useState<string>(defaultDates.end);
  const [presetType, setPresetType] = useState<string>('THIS_MONTH');
  const [status, setStatus] = useState<string>('ALL');
  const [adminId, setAdminId] = useState<string>('');
  const [referral, setReferral] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Loading & Preview state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  // Custom Toast / Modal Notification (No browser alert)
  const [notice, setNotice] = useState<CustomNotice | null>(null);

  const isOwnScope = user?.data_scope === 'own';

  useEffect(() => {
    if (!isOwnScope) {
      fetchAdmins();
    } else if (user?.id) {
      setAdminId(String(user.id));
    }
  }, [isOwnScope, user?.id]);

  // Auto hide notification after 6 seconds
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  // Fetch preview count whenever filters change
  useEffect(() => {
    const fetchPreviewCount = async () => {
      setIsLoadingPreview(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('page', '1');
        queryParams.append('limit', '1');
        if (search) queryParams.append('search', search);
        if (status) queryParams.append('status', status);
        if (adminId) queryParams.append('admin_id', adminId);
        if (referral) queryParams.append('referral', referral);
        if (dateFrom) queryParams.append('date_from', dateFrom);
        if (dateTo) queryParams.append('date_to', dateTo);

        const res = await fetch(`/api/leads?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.meta) {
            setPreviewTotal(json.meta.total);
          }
        }
      } catch (err) {
        console.error('Failed to fetch lead count preview', err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    const timer = setTimeout(fetchPreviewCount, 300);
    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, status, adminId, referral, search]);

  const handleExportXLSX = async () => {
    try {
      setIsExporting(true);
      setNotice(null);

      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status) queryParams.append('status', status);
      if (adminId) queryParams.append('admin_id', adminId);
      if (referral) queryParams.append('referral', referral);
      if (dateFrom) queryParams.append('date_from', dateFrom);
      if (dateTo) queryParams.append('date_to', dateTo);

      const response = await fetch(`/api/leads/export?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errJson.error || 'Gagal mengeksport data Excel. Periksa kembali hak akses role Anda.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nowStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
      a.download = `Data_Leads_TripBwi_${nowStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setNotice({
        type: 'success',
        title: 'Berhasil Dieksport!',
        message: `File Excel Data_Leads_TripBwi_${nowStr}.xlsx berhasil diunduh ke perangkat Anda.`
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        title: 'Gagal Mengeksport Data',
        message: err.message || 'Terjadi kesalahan saat memproses file Excel. Pastikan koneksi dan hak akses role Anda sesuai.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    const { start, end } = getDefaultDates();
    setDateFrom(start);
    setDateTo(end);
    setPresetType('THIS_MONTH');
    setStatus('ALL');
    setAdminId(isOwnScope && user?.id ? String(user.id) : '');
    setReferral('ALL');
    setSearch('');
    setNotice(null);
  };

  return (
    <div className="flex flex-col gap-6 w-full relative">

      {/* Custom Notification Dialog / Toast (No Native Alert) */}
      {notice && (
        <div className={`flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-lg transition-all animate-fade-in ${
          notice.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : notice.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            : 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
        }`}>
          <div className="flex items-start gap-3">
            {notice.type === 'success' ? (
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col text-xs font-semibold">
              <strong className="font-bold text-sm tracking-tight">{notice.title}</strong>
              <p className="mt-0.5 opacity-90 leading-relaxed">{notice.message}</p>
            </div>
          </div>

          <button
            onClick={() => setNotice(null)}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
              <FileSpreadsheet size={22} />
            </div>
            <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
              Export Data Prospek (.xlsx)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-semibold mt-1">
            Unduh rekapitulasi data prospek (Leads) dalam format Microsoft Excel sesuai filter waktu kustom dan status bisnis.
          </p>
        </div>

        <button
          onClick={handleResetFilters}
          className="self-start md:self-auto text-xs font-bold text-muted-foreground hover:text-foreground px-3.5 py-2 border border-border/80 rounded-xl bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs"
        >
          Reset Filter
        </button>
      </div>

      {/* Main Form & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Filter Panel */}
        <div className="lg:col-span-2 flex flex-col gap-5 bg-card border border-border/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Filter size={16} className="text-orange-500" />
            <h2 className="font-heading font-bold text-sm text-foreground">Parameter &amp; Filter Data</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Custom Date Range Filter */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar size={13} className="text-orange-500" />
                Filter Rentang Waktu (A s/d X)
              </label>
              <DateRangePicker
                startDate={dateFrom}
                endDate={dateTo}
                presetType={presetType}
                onChange={(start, end, preset) => {
                  setDateFrom(start);
                  setDateTo(end);
                  setPresetType(preset);
                }}
              />
              <span className="text-[10px] text-muted-foreground font-semibold">
                Pilih preset cepat atau tentukan rentang tanggal kustom untuk merekap data prospek.
              </span>
            </div>

            {/* Status Lead Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Briefcase size={13} className="text-orange-500" />
                Status Lead
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-orange-500 transition-all"
              >
                <option value="ALL">Semua Status Prospek</option>
                <option value="ACTIVE">Prospek Aktif (Non-Closed)</option>
                <option value="NEW">NEW (Baru Masuk)</option>
                <option value="QUALIFIED">QUALIFIED (Sudah Ditanya Kebutuhan)</option>
                <option value="PROSPECT">PROSPECT (Sudah Dikirim Penawaran)</option>
                <option value="HOT">HOT (Sangat Minat)</option>
                <option value="CLOSED WON">CLOSED WON (Deal / Booking)</option>
                <option value="CLOSED LOST">CLOSED LOST (Batal / Gagal)</option>
              </select>
            </div>

            {/* Admin CS Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <User size={13} className="text-orange-500" />
                Assigned Admin CS
              </label>
              {isOwnScope ? (
                <select
                  value={String(user?.id)}
                  disabled
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-border/80 rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
                >
                  <option value={String(user?.id)}>{user?.nama_admin} (Akun Saya)</option>
                </select>
              ) : (
                <select
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-orange-500 transition-all"
                >
                  <option value="">Semua Admin CS</option>
                  {admins.map((adm) => (
                    <option key={adm.id} value={String(adm.id)}>
                      {adm.nama_admin}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Referral Source Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={13} className="text-orange-500" />
                Source Referral
              </label>
              <select
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-orange-500 transition-all"
              >
                <option value="ALL">Semua Source</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="website">Website</option>
                <option value="rekomendasi">Rekomendasi</option>
                <option value="facebook">Facebook</option>
                <option value="lainnya">Lainnya</option>
                <option value="tidak diketahui">Tidak Diketahui</option>
              </select>
            </div>

            {/* Keyword Search Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Search size={13} className="text-orange-500" />
                Kata Kunci (Pencarian)
              </label>
              <input
                type="text"
                placeholder="Kode Lead, nama, HP, destinasi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>

          </div>
        </div>

        {/* Right 1 Column: Preview Summary & Download Trigger */}
        <div className="flex flex-col gap-5 bg-gradient-to-br from-card to-card/60 border border-border/80 rounded-3xl p-6 shadow-sm justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Database size={16} className="text-orange-500" />
              <h2 className="font-heading font-bold text-sm text-foreground">Ringkasan Export</h2>
            </div>

            {/* Summary Stat Box with Orange Theme */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Baris Prospek Siap Diterbitkan:</span>
              <div className="flex items-baseline gap-2">
                {isLoadingPreview ? (
                  <Loader2 size={24} className="animate-spin text-orange-500 my-1" />
                ) : (
                  <span className="font-heading font-black text-3xl text-orange-600 dark:text-orange-300">
                    {previewTotal !== null ? previewTotal.toLocaleString('id-ID') : 0}
                  </span>
                )}
                <span className="text-xs font-semibold">baris data</span>
              </div>
            </div>

            {/* List of Included Columns Header Specification */}
            <div className="flex flex-col gap-2 text-xs text-muted-foreground font-semibold border-t border-border/40 pt-3">
              <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Struktur Headers Excel:</span>
              <div className="flex flex-wrap gap-1">
                {['KODE', 'TANGGAL', 'NAMA', 'WHATSAPP', 'SOURCE', 'AGEN', 'STATUS', 'PAKET / DESTINASI', 'TANGGAL TRIP', 'PAX', 'ESTIMASI NILAI ORDER', 'KETERANGAN'].map((col) => (
                  <span key={col} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/50">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Download Action Button with Orange Theme */}
          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={isExporting || previewTotal === 0}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            {isExporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Mengeksport ke Excel...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Unduh File Excel (.xlsx)</span>
              </>
            )}
          </button>

        </div>

      </div>

    </div>
  );
};
