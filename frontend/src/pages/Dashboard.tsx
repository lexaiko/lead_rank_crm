import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { DashboardWidget } from '../components/DashboardWidget';
import { 
  LeadsOverTimeChart, 
  ReferralChart 
} from '../components/Charts';
import { DateRangePicker } from '../components/DateRangePicker';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { fetchDashboard, fetchAIQueue, dashboardData, setSelectedLeadId } = useStore();

  const getInitialThisMonthRange = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return {
      firstDayStr: `${y}-${m}-01`,
      todayStr: `${y}-${m}-${d}`
    };
  };

  const { firstDayStr, todayStr } = getInitialThisMonthRange();
  const [startDate, setStartDate] = useState<string>(firstDayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [presetType, setPresetType] = useState<string>('THIS_MONTH');

  // Local Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const handleDateChange = (start: string, end: string, preset: string) => {
    setStartDate(start);
    setEndDate(end);
    setPresetType(preset);
    setCurrentPage(1);
    fetchDashboard({ date_from: start, date_to: end });
  };

  useEffect(() => {
    fetchDashboard({ date_from: startDate, date_to: endDate });
    fetchAIQueue();
  }, []);

  if (!dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const recentLeads = dashboardData.recentLeads || [];
  const totalLeadsCount = recentLeads.length;
  const totalPages = Math.ceil(totalLeadsCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLeads = recentLeads.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
      case 'PROSPECT': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'QUALIFIED': return 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20';
      case 'HOT': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'CLOSED WON': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'CLOSED LOST': return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Welcome Banner & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
            Dashboard Utama
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Ringkasan metrik pelacakan WhatsApp, analisis kualifikasi AI, dan performa lead.
          </p>
        </div>

        {/* DateRangePicker Filter Component */}
        <div className="w-full sm:w-64 shrink-0">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            presetType={presetType}
            onChange={handleDateChange}
          />
        </div>
      </div>

      {/* Widgets Grid */}
      <DashboardWidget presetType={presetType} />

      {/* Charts Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Line Chart: Leads Over Time */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Lead Acquisition Timeline (7 Hari Terakhir)
          </span>
          <div className="h-72">
            <LeadsOverTimeChart />
          </div>
        </div>

        {/* Doughnut Chart: Lead Source / Channel */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Distribusi Channel Source Lead
          </span>
          <div className="min-h-[350px] flex flex-col justify-center">
            <ReferralChart />
          </div>
        </div>

      </div>

      {/* Tabel Lead Masuk Terfilter (Desain Seragam dengan Leads Directory) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Daftar Lead Terfilter ({totalLeadsCount} Data)
            </span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
            Klik baris untuk melihat detail kualifikasi &amp; obrolan WA
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Kode Lead
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Customer Contact
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                    Tanggal Lead
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                    Order Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm font-semibold">
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-xs text-muted-foreground">
                      Belum ada data lead pada periode ini.
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => (
                    <tr 
                      key={lead.id} 
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-sm text-primary font-mono">
                        {lead.kode_lead}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-sm text-foreground leading-tight">
                            {lead.customerNama || 'Pelanggan WA'}
                          </span>
                          {(lead.customerHp || (lead as any).customer?.nomor_hp) ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                              {lead.customerHp || (lead as any).customer?.nomor_hp}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center text-xs text-muted-foreground font-medium font-mono">
                        {formatDate(lead.createdAt || lead.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                          {lead.status_lead}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-heading font-extrabold text-xs text-orange-600 dark:text-orange-400">
                        {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View Card List */}
        <div className="sm:hidden flex flex-col gap-2.5">
          {paginatedLeads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Belum ada data lead pada periode ini.
            </div>
          ) : (
            paginatedLeads.map((lead) => (
              <div 
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 shadow-xs flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {lead.kode_lead}
                  </span>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${getStatusBadge(lead.status_lead)}`}>
                    {lead.status_lead}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-foreground truncate">
                      {lead.customerNama || 'Pelanggan WA'}
                    </span>
                    {lead.customerHp && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {lead.customerHp}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {formatDate(lead.createdAt || lead.updatedAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop & Mobile Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 px-1 bg-card">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground font-semibold">
              Menampilkan <strong className="text-foreground">{totalLeadsCount > 0 ? startIndex + 1 : 0}</strong>–
              <strong className="text-foreground">{Math.min(startIndex + pageSize, totalLeadsCount)}</strong> dari{' '}
              <strong className="text-foreground">{totalLeadsCount.toLocaleString('id-ID')}</strong> leads
            </span>
            <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Tampil:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs border border-border bg-card rounded-lg focus:outline-none focus:border-primary text-foreground font-bold cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${currentPage === p
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
