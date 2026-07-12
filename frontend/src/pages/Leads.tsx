import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Search, Filter, RefreshCw, X, MessageSquare, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';

export const Leads: React.FC = () => {
  const {
    dashboardData,
    leads,
    leadsMeta,
    leadsLoading,
    leadsParams,
    fetchLeads,
    setLeadsParams,
    resetLeadsParams,
    setSelectedLeadId,
  } = useStore();

  // Local debounced search input
  const [searchInput, setSearchInput] = useState(leadsParams.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile filter drawer
  const [isMobileFiltersExpanded, setIsMobileFiltersExpanded] = useState(false);

  // Date filter local state
  const [dateFilterType, setDateFilterType] = useState<string>('ALL');

  // Note modal
  const [activeNoteModal, setActiveNoteModal] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetchLeads();
  }, []);

  // Debounced search → trigger server fetch on change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLeads({ search: searchInput, page: 1 });
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const handleFilterChange = useCallback((partial: Record<string, any>) => {
    fetchLeads({ ...partial, page: 1 });
  }, []);

  const handleSort = (field: string) => {
    const isSame = leadsParams.sort_by === field;
    const newOrder = isSame && leadsParams.sort_order === 'desc' ? 'asc' : 'desc';
    fetchLeads({ sort_by: field, sort_order: newOrder, page: 1 });
  };

  const handlePageChange = (page: number) => {
    fetchLeads({ page });
  };

  const handleLimitChange = (limit: number) => {
    fetchLeads({ limit, page: 1 });
  };

  const handleReset = () => {
    setSearchInput('');
    setDateFilterType('ALL');
    resetLeadsParams();
    fetchLeads({ page: 1, limit: leadsParams.limit, search: '', status: '', admin_id: '', referral: '', date_from: '', date_to: '', sort_by: 'updatedAt', sort_order: 'desc' });
  };

  const hasActiveFilters =
    leadsParams.search ||
    leadsParams.status ||
    leadsParams.admin_id ||
    leadsParams.referral ||
    leadsParams.date_from ||
    leadsParams.date_to;

  const activeFiltersCount = [leadsParams.status, leadsParams.admin_id, leadsParams.referral, leadsParams.date_from || leadsParams.date_to]
    .filter(Boolean).length;

  const admins = dashboardData?.admins || [];

  const { total = 0, page = 1, limit = 20, totalPages = 1 } = leadsMeta || {};
  const startIndex = (page - 1) * limit;

  // Pagination page numbers (max 7 visible)
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
      case 'PROSPECT': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'QUALIFIED': return 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20';
      case 'HOT': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'CLOSED WON': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'CLOSED LOST': return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1.5 hover:text-foreground"
    >
      {label}
      <ArrowUpDown
        size={12}
        className={leadsParams.sort_by === field ? 'text-primary' : ''}
      />
    </button>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
            Leads Intelligence Sheet
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Track inquiries, update destinations, qualify status, and review customer chat logs.
          </p>
        </div>
        <button
          onClick={() => fetchLeads()}
          disabled={leadsLoading}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl shadow-sm hover:bg-muted/50 transition-all disabled:opacity-60"
        >
          {leadsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Reload Sheet
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="p-4 md:p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
        {/* Desktop Title */}
        <div className="hidden md:flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
          <Filter size={14} />
          Sheet Filters
        </div>

        {/* Mobile Filter Trigger Row */}
        <div className="flex md:hidden gap-2 items-center w-full">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, phone, destinations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsMobileFiltersExpanded(!isMobileFiltersExpanded)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer h-10 shrink-0 select-none ${
              isMobileFiltersExpanded || activeFiltersCount > 0
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-muted/50'
            }`}
          >
            <Filter size={13} />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-black w-4.5 h-4.5 rounded-full shrink-0">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Grid */}
        <div className={`${isMobileFiltersExpanded ? 'block' : 'hidden'} md:block`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

            {/* Keyword Search (Desktop) */}
            <div className="hidden md:flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Search Query</span>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search name, phone, destinations..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lead Status</span>
              <select
                value={leadsParams.status}
                onChange={(e) => handleFilterChange({ status: e.target.value })}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">All Statuses</option>
                <option value="NEW">NEW</option>
                <option value="PROSPECT">PROSPECT</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="HOT">HOT</option>
                <option value="CLOSED WON">CLOSED WON</option>
                <option value="CLOSED LOST">CLOSED LOST</option>
              </select>
            </div>

            {/* Referral Channel */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Referral Source</span>
              <select
                value={leadsParams.referral}
                onChange={(e) => handleFilterChange({ referral: e.target.value })}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">All Referrals</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="website">Website</option>
                <option value="rekomendasi">Rekomendasi</option>
                <option value="facebook">Facebook</option>
                <option value="lainnya">Lainnya</option>
                <option value="tidak diketahui">Tidak Diketahui</option>
              </select>
            </div>

            {/* Admin Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assigned Admin</span>
              <select
                value={leadsParams.admin_id}
                onChange={(e) => handleFilterChange({ admin_id: e.target.value })}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">All Admin CS</option>
                {admins.map((adm) => (
                  <option key={adm.id} value={String(adm.id)}>{adm.nama_admin}</option>
                ))}
              </select>
            </div>

            {/* Timeframe Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Filter Waktu</span>
              <DateRangePicker
                startDate={leadsParams.date_from}
                endDate={leadsParams.date_to}
                presetType={dateFilterType}
                onChange={(start, end, preset) => {
                  setDateFilterType(preset);
                  handleFilterChange({ date_from: start, date_to: end });
                }}
              />
            </div>

          </div>
        </div>

        {/* Active filters summary & reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs text-muted-foreground font-semibold">
              Found <strong className="text-foreground">{total.toLocaleString('id-ID')}</strong> matching leads
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-bold border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 rounded-lg transition-all"
            >
              <X size={12} /> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="flex flex-col gap-4">

        {/* Desktop Table */}
        <div className="hidden md:block rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <SortButton field="kode_lead" label="Lead Code" />
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Customer Contact
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Destinations</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Pax</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trip Date</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Note</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <SortButton field="estimasi_nilai_order" label="Order Value" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/55">
                {leadsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No leads found matching current filtering queries.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-sm text-primary font-mono">{lead.kode_lead}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{lead.customerNama || 'Pelanggan WA'}</span>
                          <span className="text-xs text-muted-foreground font-mono">{lead.customerHp}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                          {lead.status_lead}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-foreground truncate max-w-[120px]">
                        {lead.minat_destinasi || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-center">
                        {lead.jumlah_peserta ? (
                          <span className="bg-secondary/60 border border-border px-2 py-0.5 rounded-md font-mono text-xs">
                            {lead.jumlah_peserta}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-muted-foreground font-mono">
                        {lead.estimasi_waktu ? lead.estimasi_waktu.split('T')[0] : '-'}
                      </td>
                      <td
                        className="px-5 py-4 text-xs font-semibold text-muted-foreground"
                        onClick={(e) => {
                          if (lead.catatan_khusus) {
                            e.stopPropagation();
                            setActiveNoteModal(lead.catatan_khusus);
                          }
                        }}
                      >
                        {lead.catatan_khusus ? (
                          <div className="flex items-start gap-1 hover:text-primary transition-colors cursor-pointer select-none">
                            <MessageSquare size={12} className="text-primary shrink-0 mt-0.5" />
                            <span className="break-words whitespace-pre-wrap max-w-[280px] font-sans font-semibold normal-case leading-relaxed">
                              {lead.catatan_khusus}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/45">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                        {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Desktop Pagination Footer */}
          <div className="flex items-center justify-between border-t border-border/60 py-4 px-6 bg-card">
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground font-semibold">
                Showing <strong className="text-foreground">{total > 0 ? startIndex + 1 : 0}</strong> to{' '}
                <strong className="text-foreground">{Math.min(startIndex + limit, total)}</strong> of{' '}
                <strong className="text-foreground">{total.toLocaleString('id-ID')}</strong> entries
              </span>
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Show:</span>
                <select
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
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
                  disabled={page === 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p as number)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${
                        page === p
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  disabled={page === totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-3">
          {leadsLoading ? (
            <div className="p-8 text-center bg-card border border-border/80 rounded-2xl">
              <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
            </div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border/80 rounded-2xl shadow-sm">
              No leads found matching current filtering queries.
            </div>
          ) : (
            leads.map(lead => (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-2 hover:bg-muted/40 cursor-pointer text-foreground transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm font-bold text-primary">{lead.kode_lead}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                    {lead.status_lead}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 mt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-bold text-sm">{lead.customerNama || 'Pelanggan WA'}</span>
                    <span className="text-muted-foreground font-mono font-normal">{lead.customerHp}</span>
                  </div>
                  {lead.minat_destinasi && (
                    <div className="flex flex-col gap-1 mt-0.5 border-t border-border/40 pt-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Destinations Interest</span>
                      <span className="text-foreground text-sm font-semibold leading-relaxed">{lead.minat_destinasi}</span>
                    </div>
                  )}
                  {lead.catatan_khusus && (
                    <div
                      onClick={(e) => { e.stopPropagation(); setActiveNoteModal(lead.catatan_khusus!); }}
                      className="flex flex-col gap-1 mt-0.5 border-t border-border/40 pt-2 cursor-pointer hover:bg-muted/40 p-1.5 rounded-xl transition-all"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare size={11} className="text-primary shrink-0" /> Catatan Prospek (Tap to read)
                      </span>
                      <span className="text-foreground text-xs font-semibold leading-relaxed break-words whitespace-pre-wrap">
                        {lead.catatan_khusus}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      Admin: <strong className="text-foreground">{lead.adminNama || '-'}</strong>
                    </span>
                    <span className="text-orange-600 dark:text-orange-400 font-extrabold text-sm">
                      {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : 'Rp -'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Mobile Pagination */}
          <div className="flex flex-col items-center gap-3 py-4 px-4 bg-card border border-border/80 shadow-sm rounded-2xl mt-1 text-center">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground font-semibold">
                {total > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + limit, total)} of {total.toLocaleString('id-ID')}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-bold">Show:</span>
                <select
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="px-1.5 py-0.5 text-xs border border-border bg-card rounded-md focus:outline-none focus:border-primary text-foreground font-bold cursor-pointer font-sans"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                <button disabled={page === 1} onClick={() => handlePageChange(page - 1)}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all">
                  <ChevronLeft size={16} />
                </button>
                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={`m-ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                  ) : (
                    <button key={p} onClick={() => handlePageChange(p as number)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${page === p ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                      {p}
                    </button>
                  )
                )}
                <button disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note Modal */}
      {activeNoteModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary">
                <MessageSquare size={16} />
                <span className="font-heading font-black text-sm uppercase tracking-wider">Catatan Prospek (Note)</span>
              </div>
              <button onClick={() => setActiveNoteModal(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="text-sm font-semibold text-foreground bg-muted/30 p-4 rounded-xl border border-border/50 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {activeNoteModal}
            </div>
            <div className="flex justify-end mt-1">
              <button onClick={() => setActiveNoteModal(null)} className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
