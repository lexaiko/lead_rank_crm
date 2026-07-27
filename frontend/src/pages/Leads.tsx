import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  Search, Filter, RefreshCw, X, MessageSquare, ArrowUpDown, ChevronLeft, ChevronRight,
  Loader2, Phone, Brain, LayoutGrid, Table, Sparkles, Target, Briefcase, Flame,
  MapPin, Users, Calendar, ChevronDown, Check, User, Save, Clock, AlertTriangle
} from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';
import { LeadListItem } from '../types';

type KanbanStatus = 'NEW' | 'QUALIFIED' | 'PROSPECT' | 'HOT' | 'FOLLOW_UP';

interface KanbanColumnConfig {
  key: KanbanStatus;
  title: string;
  subtitle: string;
  badgeStyle: string;
  headerBg: string;
  headerBorder: string;
  icon: React.ReactNode;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    key: 'NEW',
    title: 'NEW',
    subtitle: 'Lead masuk belum di-follow up',
    badgeStyle: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    headerBg: 'bg-slate-500/5',
    headerBorder: 'border-slate-500/30',
    icon: <Sparkles size={16} className="text-slate-500" />,
  },
  {
    key: 'QUALIFIED',
    title: 'QUALIFIED',
    subtitle: 'Sudah ditanya kriteria & kebutuhan',
    badgeStyle: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    headerBg: 'bg-cyan-500/5',
    headerBorder: 'border-cyan-500/30',
    icon: <Target size={16} className="text-cyan-500" />,
  },
  {
    key: 'PROSPECT',
    title: 'PROSPECT',
    subtitle: 'Sudah diberi penawaran & itinerary',
    badgeStyle: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    headerBg: 'bg-blue-500/5',
    headerBorder: 'border-blue-500/30',
    icon: <Briefcase size={16} className="text-blue-500" />,
  },
  {
    key: 'HOT',
    title: 'HOT',
    subtitle: 'Tinggi minat & mendekati booking',
    badgeStyle: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    headerBg: 'bg-orange-500/5',
    headerBorder: 'border-orange-500/30',
    icon: <Flame size={16} className="text-orange-500" />,
  },
  {
    key: 'FOLLOW_UP',
    title: 'FOLLOW UP',
    subtitle: 'Qualified, Prospect & Hot (H- / H+)',
    badgeStyle: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold',
    headerBg: 'bg-rose-500/5',
    headerBorder: 'border-rose-500/30',
    icon: <Clock size={16} className="text-rose-500" />,
  },
];

export const Leads: React.FC = () => {
  const {
    leads,
    leadsMeta,
    leadsLoading,
    leadsParams,
    fetchLeads,
    setLeadsParams,
    resetLeadsParams,
    setSelectedLeadId,
    setOpenDeepAnalysisModal,
    admins,
    fetchAdmins,
    user,
    updateLead,
  } = useStore();

  // View Mode: 'kanban' or 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(
    (localStorage.getItem('leads_view_mode') as 'kanban' | 'table') || 'kanban'
  );

  // Local debounced search input
  const [searchInput, setSearchInput] = useState(leadsParams.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile filter drawer
  const [isMobileFiltersExpanded, setIsMobileFiltersExpanded] = useState(false);

  // Mobile Active Kanban Tab Filter
  const [mobileActiveColumn, setMobileActiveColumn] = useState<KanbanStatus>('NEW');

  // Date filter local state
  const [dateFilterType, setDateFilterType] = useState<string>('ALL');

  // Editable Note modal state: { leadId: number, text: string }
  const [activeNoteModal, setActiveNoteModal] = useState<{ leadId: number; text: string } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Follow Up modal state
  const [followUpLead, setFollowUpLead] = useState<{ name: string; phone: string; destination: string } | null>(null);
  const [followUpTemplate, setFollowUpTemplate] = useState(0);

  // Deep Analysis Confirmation modal state
  const [confirmAnalysisLead, setConfirmAnalysisLead] = useState<LeadListItem | null>(null);

  // Drag and drop state for desktop
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<KanbanStatus | null>(null);

  // Status Change Menu Popover
  const [statusMenuLeadId, setStatusMenuLeadId] = useState<number | null>(null);

  const kanbanScrollRef = useRef<HTMLDivElement>(null);

  const toggleViewMode = (mode: 'kanban' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('leads_view_mode', mode);
    if (mode === 'kanban') {
      fetchLeads({ status: 'ACTIVE', limit: 100, page: 1 });
    } else {
      fetchLeads({ status: '', limit: 20, page: 1 });
    }
  };

  const scrollToColumn = (colKey: KanbanStatus) => {
    setMobileActiveColumn(colKey);
    const el = document.getElementById(`kanban-col-${colKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  // Helper to determine follow up urgency badges
  const getFollowUpNeed = (lead: LeadListItem) => {
    if (!lead) return null;

    // Rule 1: PROSPECT with trip date within 15 days (H-15)
    if (lead.status_lead === 'PROSPECT' && lead.estimasi_waktu) {
      const tripDate = new Date(lead.estimasi_waktu);
      const diffDays = Math.ceil((tripDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 15 && diffDays >= 0) {
        return {
          type: 'PROSPECT_H15',
          label: `⚠️ Trip H-${diffDays} (Follow Up)`,
          templateIndex: 4,
          style: 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 animate-pulse font-extrabold',
          icon: <AlertTriangle size={11} className="shrink-0" />
        };
      }
    }

    // Rule 2: PROSPECT with last chat >= 5 days ago (H+5)
    if (lead.status_lead === 'PROSPECT' && lead.last_activity_at) {
      const lastChat = new Date(lead.last_activity_at);
      const diffDays = Math.floor((Date.now() - lastChat.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 5) {
        return {
          type: 'PROSPECT_INACTIVE',
          label: `⏰ Belum Di-chat ${diffDays} Hari`,
          templateIndex: 5,
          style: 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 animate-pulse font-extrabold',
          icon: <Clock size={11} className="shrink-0" />
        };
      }
    }

    // Rule 3: QUALIFIED with last chat >= 3 days ago (H+3)
    if (lead.status_lead === 'QUALIFIED' && lead.last_activity_at) {
      const lastChat = new Date(lead.last_activity_at);
      const diffDays = Math.floor((Date.now() - lastChat.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        return {
          type: 'QUALIFIED_INACTIVE',
          label: `⏰ Belum Di-chat ${diffDays} Hari`,
          templateIndex: 5,
          style: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 animate-pulse font-extrabold',
          icon: <Clock size={11} className="shrink-0" />
        };
      }
    }

    // Rule 4: HOT with last chat >= 7 days ago (H+7)
    if (lead.status_lead === 'HOT' && lead.last_activity_at) {
      const lastChat = new Date(lead.last_activity_at);
      const diffDays = Math.floor((Date.now() - lastChat.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 7) {
        return {
          type: 'HOT_INACTIVE',
          label: `🔥 Belum Di-chat ${diffDays} Hari`,
          templateIndex: 6,
          style: 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse font-extrabold',
          icon: <Flame size={11} className="shrink-0" />
        };
      }
    }

    return null;
  };

  const getFollowUpTemplates = (name: string, destination: string) => [
    {
      label: '👋 Sapa & Tanya Kabar',
      message: `Halo Kak ${name || 'Kak'}! 😊\n\nSaya dari TripBanyuwangi ingin menanyakan bagaimana kabarnya? Apakah Kakak sudah memiliki rencana untuk trip ${destination || 'wisata'} dalam waktu dekat? Kami siap membantu mempersiapkan perjalanan yang tak terlupakan! 🌿`
    },
    {
      label: '📅 Follow Up Jadwal',
      message: `Halo Kak ${name || 'Kak'}! 🙏\n\nIni dari TripBanyuwangi. Kami ingin menindaklanjuti pertanyaan Kakak sebelumnya mengenai trip ${destination || 'ke Banyuwangi'}.\n\nApakah Kakak sudah menentukan tanggal yang cocok? Kami bisa bantu menyiapkan itinerary sesuai kebutuhan Kakak. 🗓️`
    },
    {
      label: '💡 Tawarkan Promo',
      message: `Halo Kak ${name || 'Kak'}! 🎉\n\nAda kabar baik dari TripBanyuwangi! Kami sedang ada promo spesial untuk trip ${destination || 'wisata Banyuwangi'}.\n\nJangan sampai kelewatan ya Kak! Mau tahu detailnya? 🌟`
    },
    {
      label: '✅ Konfirmasi Booking',
      message: `Halo Kak ${name || 'Kak'}! 😊\n\nTerima kasih sudah tertarik dengan paket trip ${destination || 'kami'}. Boleh kami tanyakan, apakah Kakak sudah siap untuk mengkonfirmasi pemesanan? Kami siap memandu langkah selanjutnya! 🤩`
    },
    {
      label: '⚠️ Pengingat H-15 Trip',
      message: `Halo Kak ${name || 'Kak'}! 🚀\n\nSemoga sehat selalu! Kami ingin menginformasikan bahwa rencana trip ${destination || 'wisata'} Kakak tinggal 15 hari lagi lho.\n\nApakah ada kustomisasi fasilitas, konfirmasi jumlah peserta, atau persiapan yang perlu kami bantu selesaikan? Kami siap melayani Kakak! 🌴`
    },
    {
      label: '⏰ Follow Up 3 Hari Inaktif',
      message: `Halo Kak ${name || 'Kak'}! 😊\n\nMenindaklanjuti percakapan kita 3 hari lalu terkait trip ${destination || 'Banyuwangi'}.\n\nApakah Kakak masih membutuhkan informasi rincian itinerary atau penyesuaian budget? Kami siap menyesuaikan paket terbaik untuk Kakak! ✨`
    },
    {
      label: '🔥 Follow Up Hot Lead (H+7 Inaktif)',
      message: `Halo Kak ${name || 'Kak'}! 🔥\n\nSemoga hari Kakak menyenangkan! Menindaklanjuti diskusi kita minggu lalu terkait rencana trip ${destination || 'Banyuwangi'}.\n\nApakah ada pertanyaan atau penyesuaian khusus yang bisa kami bantu agar pesanan Kakak dapat segera dikonfirmasi? Slot dan promo terbatas menanti Kakak! 🌟`
    },
  ];

  const handleOpenWhatsApp = (phone: string, message: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const normalized = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSaveNote = async () => {
    if (!activeNoteModal) return;
    setIsSavingNote(true);
    try {
      await updateLead(activeNoteModal.leadId, { catatan_khusus: activeNoteModal.text });
      setActiveNoteModal(null);
    } catch (e) {
      console.error('Error saving note', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAdmins();
    if (viewMode === 'kanban') {
      fetchLeads({ status: 'ACTIVE', limit: 100, page: 1 });
    } else {
      fetchLeads({ status: '', limit: 20, page: 1 });
    }
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
    fetchLeads({
      page: 1,
      limit: viewMode === 'kanban' ? 100 : 20,
      search: '',
      status: viewMode === 'kanban' ? 'ACTIVE' : '',
      admin_id: '',
      referral: '',
      date_from: '',
      date_to: '',
      sort_by: 'last_activity_at',
      sort_order: 'desc',
      deep_analysis: 'ALL'
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('text/plain', String(leadId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStatus !== status) {
      setDragOverStatus(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    if (dragOverStatus === status) {
      setDragOverStatus(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const leadIdStr = e.dataTransfer.getData('text/plain');
    const leadId = leadIdStr ? parseInt(leadIdStr) : draggedLeadId;
    setDraggedLeadId(null);

    if (!leadId || targetStatus === 'FOLLOW_UP') return;

    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.status_lead !== targetStatus) {
      await updateLead(leadId, { status_lead: targetStatus as any });
    }
  };

  // Direct status change
  const handleQuickStatusChange = async (leadId: number, targetStatus: string) => {
    setStatusMenuLeadId(null);
    await updateLead(leadId, { status_lead: targetStatus as any });
  };

  const hasActiveFilters =
    leadsParams.search ||
    (viewMode === 'table' && leadsParams.status) ||
    leadsParams.admin_id ||
    leadsParams.referral ||
    leadsParams.date_from ||
    leadsParams.date_to ||
    (leadsParams.deep_analysis && leadsParams.deep_analysis !== 'ALL');

  const activeFiltersCount = [
    viewMode === 'table' ? leadsParams.status : '',
    leadsParams.admin_id,
    leadsParams.referral,
    leadsParams.date_from || leadsParams.date_to,
    leadsParams.deep_analysis && leadsParams.deep_analysis !== 'ALL' ? 'deep_analysis' : ''
  ].filter(Boolean).length;

  const { total = 0, page = 1, limit = 20, totalPages = 1 } = leadsMeta || {};
  const startIndex = (page - 1) * limit;

  // Group leads by status for Kanban Board
  const groupedLeads: Record<KanbanStatus, LeadListItem[]> = {
    NEW: [],
    QUALIFIED: [],
    PROSPECT: [],
    HOT: [],
    FOLLOW_UP: [],
  };

  leads.forEach(lead => {
    if (groupedLeads[lead.status_lead as KanbanStatus]) {
      groupedLeads[lead.status_lead as KanbanStatus].push(lead);
    }
    if (['QUALIFIED', 'PROSPECT', 'HOT'].includes(lead.status_lead) && getFollowUpNeed(lead) !== null) {
      groupedLeads.FOLLOW_UP.push(lead);
    }
  });

  // Sort FOLLOW_UP column strictly by TIME & URGENCY DURATION (longest silent / closest trip date first)
  groupedLeads.FOLLOW_UP.sort((a, b) => {
    const now = Date.now();
    const getUrgencyTime = (item: LeadListItem) => {
      // 1. If PROSPECT with trip date near (<= 15 days), calculate urgency score
      if (item.status_lead === 'PROSPECT' && item.estimasi_waktu) {
        const tripTime = new Date(item.estimasi_waktu).getTime();
        const diffDays = Math.ceil((tripTime - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 15 && diffDays >= 0) {
          // The closer the trip date, the smaller the timestamp score -> ranks higher at top
          return now - (30 - diffDays) * 24 * 60 * 60 * 1000;
        }
      }

      const lastActivity = item.last_activity_at ? new Date(item.last_activity_at).getTime() : 0;
      // HOT leads get elevated priority weight (boosted by 3 days)
      if (item.status_lead === 'HOT') {
        return lastActivity - (3 * 24 * 60 * 60 * 1000);
      }
      return lastActivity;
    };

    const timeA = getUrgencyTime(a);
    const timeB = getUrgencyTime(b);
    return timeA - timeB; // Oldest / Most urgent time comes first at the top!
  });

  // Calculate totals per column
  const getColumnTotals = (colStatus: KanbanStatus) => {
    const colLeads = groupedLeads[colStatus] || [];
    const count = colLeads.length;
    const totalValue = colLeads.reduce((sum, item) => sum + (item.estimasi_nilai_order || 0), 0);
    return { count, totalValue };
  };

  // Status Badge Helper
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

      {/* Header Bar with View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
              {viewMode === 'kanban' ? 'Kanban Leads Directory' : 'Daftar Leads Directory'}
            </h1>
            {viewMode === 'kanban' ? (
              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active Pipeline
              </span>
            ) : (
              <span className="bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Semua Status ({total})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-semibold">
            {viewMode === 'kanban'
              ? 'Kelola prospek aktif tanpa clutter Closed Won/Lost. Geser kartu atau ubah status secara instan.'
              : 'Daftar lengkap seluruh lead beserta riwayat kualifikasi, destinasi, dan catatan CS.'}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-card border border-border p-1 rounded-xl shadow-xs">
            <button
              onClick={() => toggleViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                viewMode === 'kanban'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Kanban Board</span>
            </button>
            <button
              onClick={() => toggleViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Table size={14} />
              <span>Tabel View</span>
            </button>
          </div>

          <button
            onClick={() => fetchLeads()}
            disabled={leadsLoading}
            className="flex items-center gap-2 px-3.5 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl shadow-xs hover:bg-muted/50 transition-all disabled:opacity-60 cursor-pointer"
          >
            {leadsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span className="hidden sm:inline">Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="p-4 md:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-4">
        {/* Search & Filter Header */}
        <div className="flex md:hidden gap-2 items-center w-full">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama, HP, atau destinasi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsMobileFiltersExpanded(!isMobileFiltersExpanded)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer h-10 shrink-0 select-none ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

            {/* Keyword Search (Desktop) */}
            <div className="hidden md:flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pencarian</span>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari nama, HP, atau destinasi..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Deep Analysis Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Deep AI Analysis</span>
              <select
                value={leadsParams.deep_analysis || 'ALL'}
                onChange={(e) => handleFilterChange({ deep_analysis: e.target.value })}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">Semua</option>
                <option value="YES">Sudah di-analisis</option>
                <option value="NO">Belum di-analisis</option>
              </select>
            </div>

            {/* Status Filter (In Table View) */}
            {viewMode === 'table' && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lead Status</span>
                <select
                  value={leadsParams.status}
                  onChange={(e) => handleFilterChange({ status: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Semua Status (Lengkap)</option>
                  <option value="ACTIVE">Hanya Pipeline Aktif</option>
                  <option value="NEW">NEW</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="PROSPECT">PROSPECT</option>
                  <option value="HOT">HOT</option>
                  <option value="CLOSED WON">CLOSED WON</option>
                  <option value="CLOSED LOST">CLOSED LOST</option>
                </select>
              </div>
            )}

            {/* Referral Channel */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Referral Source</span>
              <select
                value={leadsParams.referral}
                onChange={(e) => handleFilterChange({ referral: e.target.value })}
                className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Semua Referral</option>
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
            {user?.data_scope !== 'own' && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assigned Admin</span>
                <select
                  value={leadsParams.admin_id}
                  onChange={(e) => handleFilterChange({ admin_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Semua Admin CS</option>
                  {admins.map((adm) => (
                    <option key={adm.id} value={String(adm.id)}>{adm.nama_admin}</option>
                  ))}
                </select>
              </div>
            )}

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
              Ditemukan <strong className="text-foreground">{total.toLocaleString('id-ID')}</strong> leads sesuai filter
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-bold border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <X size={12} /> Hapus Filter
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* KANBAN BOARD VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'kanban' ? (
        <div className="flex flex-col gap-3">

          {/* Sticky Mobile Column Pills Bar */}
          <div className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-md py-2.5 px-1 border-b border-border/60 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-xs">
            {KANBAN_COLUMNS.map(col => {
              const { count } = getColumnTotals(col.key);
              const isActive = mobileActiveColumn === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => scrollToColumn(col.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 select-none ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                      : 'bg-card text-muted-foreground border-border/80 hover:bg-muted'
                  }`}
                >
                  {col.icon}
                  <span>{col.title}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : col.badgeStyle
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile Hint Banner */}
          <div className="md:hidden text-[11px] text-muted-foreground font-semibold flex items-center justify-between px-1">
            <span>👉 Geser samping untuk beralih kolom</span>
            <span className="text-primary font-bold">Swipe ↔</span>
          </div>

          {/* Kanban Columns Snap Carousel Container */}
          <div
            ref={kanbanScrollRef}
            className="flex md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 items-start overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 px-1 scrollbar-none"
          >
            {KANBAN_COLUMNS.map((col) => {
              const colLeads = groupedLeads[col.key];
              const { count, totalValue } = getColumnTotals(col.key);
              const isTargeting = dragOverStatus === col.key;

              return (
                <div
                  key={col.key}
                  id={`kanban-col-${col.key}`}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={(e) => handleDragLeave(e, col.key)}
                  onDrop={(e) => handleDrop(e, col.key)}
                  className={`w-[86vw] sm:w-[350px] md:w-auto shrink-0 md:shrink snap-center flex flex-col rounded-2xl bg-card border shadow-xs transition-all min-h-[480px] ${
                    isTargeting
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                      : 'border-border/80'
                  }`}
                >
                  {/* Column Header */}
                  <div className={`p-3.5 md:p-4 rounded-t-2xl border-b border-border/80 flex flex-col gap-2 ${col.headerBg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-background border border-border shadow-xs">
                          {col.icon}
                        </div>
                        <span className="font-heading font-black text-sm text-foreground uppercase tracking-wider">
                          {col.title}
                        </span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${col.badgeStyle}`}>
                        {count} leads
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                      <span>{col.subtitle}</span>
                      {totalValue > 0 && (
                        <span className="font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                          Rp {totalValue.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cards List */}
                  <div className="p-2.5 md:p-3 flex flex-col gap-3 flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
                    {leadsLoading ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                        <span className="text-xs font-semibold">Memuat lead...</span>
                      </div>
                    ) : colLeads.length === 0 ? (
                      <div className="py-12 text-center border-2 border-dashed border-border/60 rounded-xl p-4 flex flex-col items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground/70">Tidak ada lead di kolom ini</span>
                        <span className="text-[11px] text-muted-foreground/50">Geser atau ubah status lead ke sini</span>
                      </div>
                    ) : (
                      colLeads.map((lead) => {
                        const fuNeed = getFollowUpNeed(lead);
                        return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead.id)}
                            onClick={() => setSelectedLeadId(lead.id)}
                            className="group relative p-3.5 bg-background border border-border/80 hover:border-primary/50 shadow-xs hover:shadow-md rounded-xl flex flex-col gap-2.5 cursor-pointer transition-all text-foreground"
                          >
                            {/* Follow Up Urgency Alert Badge */}
                            {fuNeed && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFollowUpTemplate(fuNeed.templateIndex);
                                  setFollowUpLead({
                                    name: lead.customerNama || '',
                                    phone: lead.customerHp,
                                    destination: lead.minat_destinasi || ''
                                  });
                                }}
                                className={`w-full px-2.5 py-1 rounded-lg border text-[11px] flex items-center justify-between transition-all shadow-xs cursor-pointer ${fuNeed.style}`}
                              >
                                <span className="flex items-center gap-1.5">
                                  {fuNeed.icon}
                                  <span>{fuNeed.label}</span>
                                </span>
                                <span className="underline text-[10px]">Follow Up WA &rarr;</span>
                              </button>
                            )}

                            {/* Card Header: Lead Code / Original Status Badge & Quick Move Selector */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {col.key === 'FOLLOW_UP' ? (
                                  /* Original Status Badge for Follow Up column */
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider flex items-center gap-1 ${
                                    lead.status_lead === 'HOT'
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                      : lead.status_lead === 'PROSPECT'
                                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                      : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                                  }`}>
                                    {lead.status_lead === 'HOT' && <Flame size={11} className="text-rose-500 shrink-0" />}
                                    {lead.status_lead === 'PROSPECT' && <Briefcase size={11} className="text-blue-500 shrink-0" />}
                                    {lead.status_lead === 'QUALIFIED' && <Target size={11} className="text-cyan-500 shrink-0" />}
                                    <span>{lead.status_lead}</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs font-bold text-primary tracking-tight">
                                    {lead.kode_lead}
                                  </span>
                                )}
                              </div>

                              {/* Quick Status Dropdown Menu */}
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setStatusMenuLeadId(statusMenuLeadId === lead.id ? null : lead.id)}
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer select-none"
                                >
                                  <span>Pindah</span>
                                  <ChevronDown size={11} />
                                </button>

                                {statusMenuLeadId === lead.id && (
                                  <div className="absolute right-0 top-8 z-[60] w-44 bg-card border border-border rounded-xl shadow-xl p-1.5 flex flex-col gap-1 text-xs animate-scale-up">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 border-b border-border/50">
                                      Ubah Status Ke:
                                    </span>
                                    {['NEW', 'QUALIFIED', 'PROSPECT', 'HOT'].map((st) => (
                                      <button
                                        key={st}
                                        disabled={st === lead.status_lead}
                                        onClick={() => handleQuickStatusChange(lead.id, st)}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                          st === lead.status_lead
                                            ? 'bg-primary/10 text-primary opacity-60'
                                            : 'hover:bg-muted text-foreground'
                                        }`}
                                      >
                                        <span>{st}</span>
                                        {st === lead.status_lead && <Check size={12} />}
                                      </button>
                                    ))}
                                    <div className="border-t border-border/50 pt-1 mt-0.5">
                                      <button
                                        onClick={() => handleQuickStatusChange(lead.id, 'CLOSED WON')}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-all"
                                      >
                                        🏆 Closed Won
                                      </button>
                                      <button
                                        onClick={() => handleQuickStatusChange(lead.id, 'CLOSED LOST')}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                                      >
                                        ❌ Closed Lost
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Customer Name & Phone */}
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                {lead.customerNama || 'Pelanggan WA'}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                {col.key === 'FOLLOW_UP' && (
                                  <span className="font-bold text-primary tracking-tight shrink-0">
                                    {lead.kode_lead}
                                  </span>
                                )}
                                <span className="text-muted-foreground">
                                  {lead.customerHp}
                                </span>
                              </div>
                            </div>

                            {/* Destination & Trip Info */}
                            {lead.minat_destinasi && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted/40 p-2 rounded-lg border border-border/50">
                                <MapPin size={13} className="text-primary shrink-0" />
                                <span className="truncate">{lead.minat_destinasi}</span>
                              </div>
                            )}

                            {/* Quick Facts: Pax & Date */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-muted-foreground">
                              {lead.jumlah_peserta ? (
                                <span className="flex items-center gap-1 bg-secondary/80 border border-border px-2 py-0.5 rounded-md text-foreground">
                                  <Users size={11} className="text-muted-foreground" />
                                  <strong>{lead.jumlah_peserta} Pax</strong>
                                </span>
                              ) : null}

                              {lead.estimasi_waktu ? (
                                <span className="flex items-center gap-1 bg-secondary/80 border border-border px-2 py-0.5 rounded-md text-foreground font-mono">
                                  <Calendar size={11} className="text-muted-foreground" />
                                  {lead.estimasi_waktu.split('T')[0]}
                                </span>
                              ) : null}
                            </div>

                            {/* Editable Note Snippet */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveNoteModal({ leadId: lead.id, text: lead.catatan_khusus || '' });
                              }}
                              className="text-[11px] text-muted-foreground font-medium bg-muted/30 p-2 rounded-lg border border-border/40 hover:border-primary/50 transition-all group/note"
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <strong className="text-primary font-bold flex items-center gap-1">
                                  <MessageSquare size={11} /> Catatan
                                </strong>
                                <span className="text-[10px] text-primary underline opacity-0 group-hover/note:opacity-100 transition-opacity">
                                  Edit Note &rarr;
                                </span>
                              </div>
                              <p className="line-clamp-2">
                                {lead.catatan_khusus || <span className="italic text-muted-foreground/60">+ Tambah catatan khusus...</span>}
                              </p>
                            </div>

                            {/* Deep AI & Order Value */}
                            <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-0.5">
                              {/* Deep AI Status */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (lead.has_deep_analysis) {
                                    setSelectedLeadId(lead.id);
                                    setOpenDeepAnalysisModal(true);
                                  } else {
                                    setConfirmAnalysisLead(lead);
                                  }
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer select-none transition-all ${
                                  lead.has_deep_analysis
                                    ? 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500 hover:text-white'
                                    : 'bg-muted border-border/80 text-muted-foreground hover:bg-violet-500/10 hover:text-violet-500'
                                }`}
                              >
                                <Brain size={10} className={lead.has_deep_analysis ? 'animate-pulse' : ''} />
                                {lead.has_deep_analysis ? 'Sudah AI' : 'Belum AI'}
                              </button>

                              {/* Order Value */}
                              <span className="font-extrabold text-xs text-orange-600 dark:text-orange-400 font-heading">
                                {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : 'Rp -'}
                              </span>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between border-t border-border/50 pt-2" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                <User size={10} />
                                <span className="truncate max-w-[80px]">{lead.adminNama || 'CS'}</span>
                              </span>

                              <button
                                onClick={() => {
                                  const fu = fuNeed ? fuNeed.templateIndex : 0;
                                  setFollowUpTemplate(fu);
                                  setFollowUpLead({ name: lead.customerNama || '', phone: lead.customerHp, destination: lead.minat_destinasi || '' });
                                }}
                                className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white flex items-center gap-1 transition-all cursor-pointer shadow-xs select-none"
                              >
                                <Phone size={11} /> WhatsApp
                              </button>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        /* ========================================================================= */
        /* TABEL VIEW (Fallback Mode) */
        /* ========================================================================= */
        <div className="flex flex-col gap-4">
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden">
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
                      <SortButton field="last_activity_at" label="Deep AI" />
                    </th>
                    <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <SortButton field="estimasi_nilai_order" label="Order Value" />
                    </th>
                    <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">FU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/55">
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                            <Search size={20} className="text-muted-foreground/60" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-foreground">Tidak ada leads yang cocok</span>
                            <span className="text-xs text-muted-foreground">Coba ubah kata kunci atau hapus filter yang aktif.</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const fuNeed = getFollowUpNeed(lead);
                      return (
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
                              {fuNeed && (
                                <span className={`mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1 w-fit ${fuNeed.style}`}>
                                  {fuNeed.label}
                                </span>
                              )}
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
                            className="px-5 py-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveNoteModal({ leadId: lead.id, text: lead.catatan_khusus || '' });
                            }}
                          >
                            {lead.catatan_khusus ? (
                              <div title="Klik untuk edit catatan" className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer select-none group">
                                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                                  <MessageSquare size={13} className="text-primary" />
                                </div>
                                <span className="text-xs text-muted-foreground font-semibold group-hover:text-primary transition-colors truncate max-w-[100px]">
                                  {lead.catatan_khusus.length > 30 ? lead.catatan_khusus.slice(0, 30) + '…' : lead.catatan_khusus}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/35 text-xs hover:text-primary cursor-pointer">+ Edit Note</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs font-semibold whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {lead.has_deep_analysis ? (
                              <button
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  setOpenDeepAnalysisModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500 hover:text-white transition-all cursor-pointer shadow-xs select-none"
                              >
                                <Brain size={11} className="animate-pulse" /> Sudah Analisis
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setConfirmAnalysisLead(lead);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/80 hover:bg-violet-500/10 hover:text-violet-500 hover:border-violet-500/20 transition-all cursor-pointer select-none"
                              >
                                <Brain size={11} /> Belum Analisis
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm font-extrabold text-orange-600 dark:text-orange-400 font-heading whitespace-nowrap">
                            {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : '—'}
                          </td>
                          <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                const fu = fuNeed ? fuNeed.templateIndex : 0;
                                setFollowUpTemplate(fu);
                                setFollowUpLead({ name: lead.customerNama || '', phone: lead.customerHp, destination: lead.minat_destinasi || '' });
                              }}
                              title="Follow Up via WhatsApp"
                              className="h-8 w-8 inline-flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                            >
                              <Phone size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-4 px-6 bg-card">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground font-semibold">
                  Menampilkan <strong className="text-foreground">{total > 0 ? startIndex + 1 : 0}</strong>–
                  <strong className="text-foreground">{Math.min(startIndex + limit, total)}</strong> dari{' '}
                  <strong className="text-foreground">{total.toLocaleString('id-ID')}</strong> leads
                </span>
                <div className="flex items-center gap-2 border-l border-border pl-4">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Tampil:</span>
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
                        onClick={() => handlePageChange(p as number)}
                        className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${
                          page === p
                            ? 'bg-primary text-primary-foreground shadow-xs'
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
                    className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Rich Table Cards Fallback */}
          <div className="md:hidden flex flex-col gap-3">
            {leadsLoading ? (
              <div className="p-8 text-center bg-card border border-border/80 rounded-2xl">
                <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
              </div>
            ) : leads.length === 0 ? (
              <div className="p-8 text-center bg-card border border-border/80 rounded-2xl shadow-xs flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Search size={20} className="text-muted-foreground/60" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-foreground">Tidak ada leads yang cocok</span>
                  <span className="text-xs text-muted-foreground">Coba ubah kata kunci atau hapus filter yang aktif.</span>
                </div>
                {hasActiveFilters && (
                  <button onClick={handleReset} className="mt-1 flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-bold border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                    <X size={12} /> Hapus Filter
                  </button>
                )}
              </div>
            ) : (
              leads.map(lead => {
                const fuNeed = getFollowUpNeed(lead);
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="p-4 bg-card border border-border/80 shadow-xs rounded-2xl flex flex-col gap-2.5 hover:bg-muted/40 cursor-pointer text-foreground transition-all"
                  >
                    {/* Follow Up Alert Badge */}
                    {fuNeed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFollowUpTemplate(fuNeed.templateIndex);
                          setFollowUpLead({
                            name: lead.customerNama || '',
                            phone: lead.customerHp,
                            destination: lead.minat_destinasi || ''
                          });
                        }}
                        className={`w-full px-2.5 py-1 rounded-lg border text-[11px] flex items-center justify-between transition-all shadow-xs cursor-pointer ${fuNeed.style}`}
                      >
                        <span className="flex items-center gap-1.5">
                          {fuNeed.icon}
                          <span>{fuNeed.label}</span>
                        </span>
                        <span className="underline text-[10px]">Follow Up WA &rarr;</span>
                      </button>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm font-bold text-primary">{lead.kode_lead}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                        {lead.status_lead}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 mt-0.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-bold text-sm">{lead.customerNama || 'Pelanggan WA'}</span>
                        <span className="text-muted-foreground font-mono">{lead.customerHp}</span>
                      </div>

                      {lead.minat_destinasi && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted/40 p-2 rounded-xl border border-border/50">
                          <MapPin size={13} className="text-primary shrink-0" />
                          <span className="truncate">{lead.minat_destinasi}</span>
                        </div>
                      )}

                      {/* Quick facts: pax, trip date, deep AI */}
                      <div className="flex items-center gap-2 flex-wrap border-t border-border/40 pt-2 mt-0.5">
                        {lead.jumlah_peserta ? (
                          <span className="text-[11px] font-semibold bg-secondary/60 border border-border px-2 py-0.5 rounded-lg text-foreground flex items-center gap-1">
                            <Users size={11} className="text-muted-foreground" />
                            <strong>{lead.jumlah_peserta} Pax</strong>
                          </span>
                        ) : null}

                        {lead.estimasi_waktu ? (
                          <span className="text-[11px] font-semibold bg-secondary/60 border border-border px-2 py-0.5 rounded-lg text-foreground font-mono flex items-center gap-1">
                            <Calendar size={11} className="text-muted-foreground" />
                            {lead.estimasi_waktu.split('T')[0]}
                          </span>
                        ) : null}

                        {/* Deep AI Analysis status badge */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (lead.has_deep_analysis) {
                              setSelectedLeadId(lead.id);
                              setOpenDeepAnalysisModal(true);
                            } else {
                              setConfirmAnalysisLead(lead);
                            }
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer select-none transition-all ${
                            lead.has_deep_analysis
                              ? 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500 hover:text-white'
                              : 'bg-muted border-border/80 text-muted-foreground hover:bg-violet-500/10 hover:text-violet-500'
                          }`}
                        >
                          <Brain size={10} className={lead.has_deep_analysis ? 'animate-pulse' : ''} />
                          {lead.has_deep_analysis ? 'Sudah AI' : 'Belum AI'}
                        </button>
                      </div>

                      {/* Editable Note Snippet */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNoteModal({ leadId: lead.id, text: lead.catatan_khusus || '' });
                        }}
                        className="flex flex-col gap-1 mt-0.5 border-t border-border/40 pt-2 cursor-pointer hover:bg-muted/40 p-1.5 rounded-xl transition-all"
                      >
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare size={11} className="text-primary shrink-0" /> Catatan
                          </span>
                          <span className="text-primary text-[10px] underline">Edit</span>
                        </span>
                        <span className="text-foreground text-xs font-semibold leading-relaxed break-words whitespace-pre-wrap">
                          {lead.catatan_khusus || <span className="italic text-muted-foreground/60">+ Tambah catatan khusus...</span>}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                          <User size={11} />
                          Admin: <strong className="text-foreground">{lead.adminNama || '-'}</strong>
                        </span>
                        <span className="text-orange-600 dark:text-orange-400 font-extrabold text-sm">
                          {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : 'Rp -'}
                        </span>
                      </div>

                      {/* Follow Up Button */}
                      <div className="border-t border-border/40 pt-2 mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            const fu = fuNeed ? fuNeed.templateIndex : 0;
                            setFollowUpTemplate(fu);
                            setFollowUpLead({ name: lead.customerNama || '', phone: lead.customerHp, destination: lead.minat_destinasi || '' });
                          }}
                          className="w-full py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-all shadow-xs select-none cursor-pointer"
                        >
                          <Phone size={12} /> Follow Up via WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Table View Pagination Footer */}
            <div className="flex flex-col items-center gap-3 py-4 px-4 bg-card border border-border/80 shadow-xs rounded-2xl mt-1 text-center">
              <div className="flex items-center justify-between w-full">
                <span className="text-xs text-muted-foreground font-semibold">
                  {total > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + limit, total)} dari {total.toLocaleString('id-ID')}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-bold">Tampil:</span>
                  <select
                    value={limit}
                    onChange={(e) => handleLimitChange(Number(e.target.value))}
                    className="px-1.5 py-0.5 text-xs border border-border bg-card rounded-md focus:outline-none focus:border-primary text-foreground font-bold cursor-pointer"
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
                    className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer">
                    <ChevronLeft size={16} />
                  </button>
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`m-ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                    ) : (
                      <button key={p} onClick={() => handlePageChange(p as number)}
                        className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${page === p ? 'bg-primary text-primary-foreground shadow-xs' : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                        {p}
                      </button>
                    )
                  )}
                  <button disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}
                    className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editable Note Modal */}
      {activeNoteModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 text-foreground animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary">
                <MessageSquare size={16} />
                <span className="font-heading font-black text-sm uppercase tracking-wider">Edit Catatan</span>
              </div>
              <button onClick={() => setActiveNoteModal(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground font-semibold">
                Tuliskan informasi khusus seperti permintaan kustomisasi, budget, tipe mobil, atau preferensi hotel customer:
              </span>
              <textarea
                rows={5}
                value={activeNoteModal.text}
                onChange={(e) => setActiveNoteModal({ ...activeNoteModal, text: e.target.value })}
                placeholder="Tulis catatan di sini..."
                className="w-full p-3.5 rounded-xl border border-border/80 bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary leading-relaxed resize-none shadow-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <button
                onClick={() => setActiveNoteModal(null)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveNote}
                disabled={isSavingNote}
                className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSavingNote ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Simpan Catatan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow Up Modal */}
      {followUpLead && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl flex flex-col text-foreground">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Phone size={16} />
                <span className="font-heading font-black text-sm uppercase tracking-wider">Follow Up via WhatsApp</span>
              </div>
              <button onClick={() => setFollowUpLead(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-3">
              <div className="bg-muted/60 border border-border/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {(followUpLead.name || 'WA').slice(0, 2)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-foreground truncate">{followUpLead.name || 'Pelanggan WA'}</span>
                  <span className="text-xs text-muted-foreground font-mono">{followUpLead.phone}</span>
                </div>
              </div>
            </div>

            <div className="px-5 pb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pilih Template Pesan</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {getFollowUpTemplates(followUpLead.name, followUpLead.destination).map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFollowUpTemplate(idx)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left leading-snug cursor-pointer select-none ${
                      followUpTemplate === idx
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 pb-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Preview Pesan</span>
              <div className="mt-2 p-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs font-semibold text-foreground leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                {getFollowUpTemplates(followUpLead.name, followUpLead.destination)[followUpTemplate]?.message}
              </div>
            </div>

            <div className="px-5 pb-5 flex items-center gap-2">
              <button
                onClick={() => setFollowUpLead(null)}
                className="flex-1 py-2.5 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  handleOpenWhatsApp(
                    followUpLead.phone,
                    getFollowUpTemplates(followUpLead.name, followUpLead.destination)[followUpTemplate].message
                  );
                  setFollowUpLead(null);
                }}
                className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Phone size={13} /> Buka WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Analysis Confirmation Modal */}
      {confirmAnalysisLead && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up text-foreground">
            <div className="flex items-center gap-3 text-violet-600 dark:text-violet-400">
              <Brain size={24} className="shrink-0" />
              <span className="font-heading font-black text-base">Konfirmasi Deep Analysis</span>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Apakah Anda yakin ingin menganalisis percakapan dengan pelanggan <strong className="text-foreground">{confirmAnalysisLead.customerNama || 'Pelanggan WA'}</strong> secara mendalam menggunakan AI?
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2 justify-end">
              <button
                onClick={() => setConfirmAnalysisLead(null)}
                className="px-4 py-2 border border-border hover:bg-muted font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer bg-card text-foreground"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const leadId = confirmAnalysisLead.id;
                  setConfirmAnalysisLead(null);
                  setSelectedLeadId(leadId);
                  setOpenDeepAnalysisModal(true);
                }}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer"
              >
                Mulai Analisis
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
