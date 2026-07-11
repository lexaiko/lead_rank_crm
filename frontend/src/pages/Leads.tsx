import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, Filter, RefreshCw, X, MessageSquare, Compass, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';

export const Leads: React.FC = () => {
  const { 
    dashboardData, 
    fetchDashboard, 
    searchKeyword,
    setSearchKeyword,
    filterStatus,
    setFilterStatus,
    filterReferral,
    setFilterReferral,
    filterAdmin,
    setFilterAdmin,
    resetFilters,
    setSelectedLeadId
  } = useStore();

  // Local state for debounced input
  const [searchInput, setSearchInput] = useState(searchKeyword);
  
  // Sort State
  const [sortBy, setSortBy] = useState<'kode_lead' | 'customerNama' | 'updatedAt' | 'estimasi_nilai_order'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Unified Date Filter States (Presets + Custom)
  const [dateFilterType, setDateFilterType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Mobile Filters Drawer Expand state
  const [isMobileFiltersExpanded, setIsMobileFiltersExpanded] = useState(false);

  const activeFiltersCount = 
    (filterStatus !== 'ALL' ? 1 : 0) + 
    (filterReferral !== 'ALL' ? 1 : 0) + 
    (filterAdmin !== 'ALL' ? 1 : 0) + 
    (dateFilterType !== 'ALL' ? 1 : 0);

  // Sync state if global search keyword gets cleared externally
  useEffect(() => {
    setSearchInput(searchKeyword);
  }, [searchKeyword]);

  // Debounced search logic (300ms)
  useEffect(() => {
    const delay = setTimeout(() => {
      setSearchKeyword(searchInput);
      setCurrentPage(1); // Reset page on search
    }, 300);
    return () => clearTimeout(delay);
  }, [searchInput]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (!dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const { leads, admins } = dashboardData;

  // 1. Filtering
  const filteredLeads = leads.filter(lead => {
    const nameMatch = (lead.customerNama || '').toLowerCase().includes(searchKeyword.toLowerCase());
    const hpMatch = (lead.customerHp || '').includes(searchKeyword);
    const destMatch = (lead.minat_destinasi || '').toLowerCase().includes(searchKeyword.toLowerCase());
    const codeMatch = lead.kode_lead.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchesSearch = nameMatch || hpMatch || destMatch || codeMatch;

    const matchesStatus = filterStatus === 'ALL' || lead.status_lead === filterStatus;
    const matchesReferral = filterReferral === 'ALL' || lead.referral_source === filterReferral;
    const matchesAdmin = filterAdmin === 'ALL' || lead.adminNama === filterAdmin;

    // Unified Date / Timeframe Filter Logic (based on last update)
    let matchesDate = true;
    if (dateFilterType !== 'ALL') {
      const leadDateStr = lead.updatedAt.split('T')[0];
      
      if (dateFilterType === 'CUSTOM') {
        if (startDate && leadDateStr < startDate) {
          matchesDate = false;
        }
        if (endDate && leadDateStr > endDate) {
          matchesDate = false;
        }
      } else {
        const leadDate = new Date(lead.updatedAt);
        const today = new Date();
        
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const leadZeroDate = new Date(leadDate.getFullYear(), leadDate.getMonth(), leadDate.getDate());
        
        const diffTime = todayDate.getTime() - leadZeroDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (dateFilterType === 'TODAY') {
          matchesDate = diffDays === 0;
        } else if (dateFilterType === 'YESTERDAY') {
          matchesDate = diffDays === 1;
        } else if (dateFilterType === 'WEEK') {
          matchesDate = diffDays <= 7 && diffDays >= 0;
        } else if (dateFilterType === 'MONTH') {
          matchesDate = diffDays <= 30 && diffDays >= 0;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesReferral && matchesAdmin && matchesDate;
  });

  // 2. Sorting
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let valA: any = a[sortBy];
    let valB: any = b[sortBy];

    if (sortBy === 'customerNama') {
      valA = a.customerNama || '';
      valB = b.customerNama || '';
    }

    if (typeof valA === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      // Numbers or Dates
      const numA = valA ? new Date(valA).getTime() || valA : 0;
      const numB = valB ? new Date(valB).getTime() || valB : 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    }
  });

  // 3. Pagination
  const totalItems = sortedLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = sortedLeads.slice(startIndex, startIndex + itemsPerPage);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
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
          onClick={() => fetchDashboard()}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl shadow-sm hover:bg-muted/50 transition-all"
        >
          <RefreshCw size={13} />
          Reload Sheet
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="p-4 md:p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
        {/* Desktop Title & Icon */}
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

        {/* Grid Container (Mobile: Collapsible, Desktop: Always block) */}
        <div className={`${isMobileFiltersExpanded ? 'block' : 'hidden'} md:block animate-fade-in`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            
            {/* Keyword Search (Desktop only, hidden on mobile) */}
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
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Statuses</option>
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
                value={filterReferral}
                onChange={(e) => { setFilterReferral(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Referrals</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="website">Website</option>
                <option value="rekomendasi">Rekomendasi</option>
                <option value="facebook">Facebook</option>
                <option value="lainnya">Lainnya</option>
                <option value="tidak diketahui">Tidak Diketahui</option>
              </select>
            </div>

            {/* CS Agent Assignee */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assigned Admin</span>
              <select
                value={filterAdmin}
                onChange={(e) => { setFilterAdmin(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Admin CS</option>
                {admins.map((adm) => (
                  <option key={adm.id} value={adm.nama_admin}>{adm.nama_admin}</option>
                ))}
              </select>
            </div>

            {/* Timeframe Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Filter Waktu</span>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                presetType={dateFilterType}
                onChange={(start, end, preset) => {
                  setStartDate(start);
                  setEndDate(end);
                  setDateFilterType(preset);
                  setCurrentPage(1);
                }}
              />
            </div>

          </div>
        </div>

        {/* Filters Summary & Reset */}
        {(searchKeyword || filterStatus !== 'ALL' || filterReferral !== 'ALL' || filterAdmin !== 'ALL' || dateFilterType !== 'ALL' || startDate || endDate) && (
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs text-muted-foreground font-semibold">
              Filtered down to <strong className="text-foreground">{totalItems}</strong> matching leads
            </span>
            <button
              onClick={() => { resetFilters(); setSearchInput(''); setDateFilterType('ALL'); setStartDate(''); setEndDate(''); setCurrentPage(1); }}
              className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-bold border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 rounded-lg transition-all"
            >
              <X size={12} /> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Leads Main Table Sheet */}
      <div className="flex flex-col gap-4">
        {/* Desktop View Table */}
        <div className="hidden md:block rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <button onClick={() => toggleSort('kode_lead')} className="flex items-center gap-1.5 hover:text-foreground">
                      Lead Code <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <button onClick={() => toggleSort('customerNama')} className="flex items-center gap-1.5 hover:text-foreground">
                      Customer contact <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PIC CS</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-sans">Status</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Destinations</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Pax</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trip Date</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Referral</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <button onClick={() => toggleSort('estimasi_nilai_order')} className="flex items-center gap-1.5 hover:text-foreground">
                      Order Value <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Chats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/55">
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No leads found matching current filtering queries.
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => (
                    <tr 
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-sm text-primary font-mono">{lead.kode_lead}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">
                            {lead.customerNama || 'Pelanggan WA'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{lead.customerHp}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-foreground">{lead.adminNama}</td>
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
                      <td className="px-5 py-4 text-xs font-bold uppercase text-muted-foreground">
                        <span className="bg-secondary/30 px-2 py-0.5 rounded border border-border text-[9px]">
                          {lead.referral_source || 'tidak diketahui'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                        {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare size={13} className="text-orange-500" />
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 font-mono">
                            {lead.messagesCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Table Pagination Footer (Desktop) */}
          <div className="flex items-center justify-between border-t border-border/60 py-4 px-6 bg-card">
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground font-semibold">
                Showing <strong className="text-foreground">{totalItems > 0 ? startIndex + 1 : 0}</strong> to <strong className="text-foreground">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong className="text-foreground">{totalItems}</strong> entries
              </span>
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-xs border border-border bg-card rounded-lg focus:outline-none focus:border-primary text-foreground font-bold cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  const isCurrent = currentPage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${
                        isCurrent 
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile-Friendly Spaced Floating Cards List */}
        <div className="md:hidden flex flex-col gap-3">
          {paginatedLeads.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border/80 rounded-2xl shadow-sm">
              No leads found matching current filtering queries.
            </div>
          ) : (
            paginatedLeads.map(lead => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLeadId(lead.id)}
                className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-2 hover:bg-muted/40 cursor-pointer text-foreground transition-all"
              >
                {/* Header Row: Code + Status Badge */}
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm font-bold text-primary">{lead.kode_lead}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                    {lead.status_lead}
                  </span>
                </div>

                {/* Body Content */}
                <div className="flex flex-col gap-2.5 mt-1 text-xs">
                  {/* Client info */}
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-bold text-sm">{lead.customerNama || 'Pelanggan WA'}</span>
                    <span className="text-muted-foreground font-mono font-normal">{lead.customerHp}</span>
                  </div>

                  {/* Destinations block */}
                  {lead.minat_destinasi && (
                    <div className="flex flex-col gap-1 mt-0.5 border-t border-border/40 pt-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Destinations Interest</span>
                      <span className="text-foreground text-sm font-semibold leading-relaxed">{lead.minat_destinasi}</span>
                    </div>
                  )}

                  {/* Footer Row: Admin PIC & Order Value */}
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

          {/* Table Pagination Footer (Mobile) */}
          <div className="flex flex-col items-center gap-3 justify-between py-4 px-4 bg-card border border-border/80 shadow-sm rounded-2xl mt-1 text-center">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground font-semibold">
                Showing <strong className="text-foreground">{totalItems > 0 ? startIndex + 1 : 0}</strong>-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-bold">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-1.5 py-0.5 text-xs border border-border bg-card rounded-md focus:outline-none focus:border-primary text-foreground font-bold cursor-pointer font-sans"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1 mt-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  const isCurrent = currentPage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${
                        isCurrent 
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
