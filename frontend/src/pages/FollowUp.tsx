import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../store/services/api';
import {
  Search, RefreshCw, X, MessageSquare, Loader2, Phone, Brain,
  Sparkles, Target, Briefcase, Flame, MapPin, Users, Calendar, Check, User, Clock, AlertTriangle, Send, ExternalLink, Layers
} from 'lucide-react';
import { LeadListItem } from '../types';
import { LeadDetailDrawer } from '../components/LeadDetailDrawer';

export const FollowUp: React.FC = () => {
  const {
    leads,
    leadsLoading,
    fetchLeads,
    setSelectedLeadId,
    selectedLeadId,
    setOpenDeepAnalysisModal,
    user,
  } = useStore();

  const [searchInput, setSearchInput] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState<'ALL' | 'H15' | 'INACTIVE_3' | 'INACTIVE_5' | 'INACTIVE_7'>('ALL');

  // Editable Note modal state: { leadId: number, text: string }
  const [activeNoteModal, setActiveNoteModal] = useState<{ leadId: number; text: string } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Follow Up WA modal state
  const [followUpLead, setFollowUpLead] = useState<{ id: number; name: string; phone: string; destination: string } | null>(null);
  const [followUpTemplate, setFollowUpTemplate] = useState(0);
  const [editedMessage, setEditedMessage] = useState('');
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [waSuccessToast, setWaSuccessToast] = useState<string | null>(null);

  // Deep Analysis Confirmation modal state
  const [confirmAnalysisLead, setConfirmAnalysisLead] = useState<LeadListItem | null>(null);

  useEffect(() => {
    fetchLeads({ status: 'ACTIVE', limit: 100, page: 1 });
  }, []);

  // Sync editedMessage when template selection or lead changes
  useEffect(() => {
    if (followUpLead) {
      const msg = getFollowUpTemplates(followUpLead.name, followUpLead.destination)[followUpTemplate]?.message || '';
      setEditedMessage(msg);
    }
  }, [followUpTemplate, followUpLead?.id]);

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
          label: `Trip H-${diffDays} (Follow Up)`,
          templateIndex: 4,
          style: 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 font-extrabold',
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
          label: `Belum Di-chat ${diffDays} Hari`,
          templateIndex: 5,
          style: 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 font-extrabold',
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
          label: `Belum Di-chat ${diffDays} Hari`,
          templateIndex: 5,
          style: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-extrabold',
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
          label: `Belum Di-chat ${diffDays} Hari`,
          templateIndex: 6,
          style: 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 font-extrabold',
          icon: <Flame size={11} className="shrink-0" />
        };
      }
    }

    return null;
  };

  const getFollowUpTemplates = (name: string, destination: string) => [
    {
      label: 'Sapa & Tanya Kabar',
      message: `Halo Kak ${name || 'Kak'},\n\nSaya dari TripBanyuwangi ingin menanyakan kabar Kakak. Apakah Kakak ada rencana untuk trip ${destination || 'wisata'} dalam waktu dekat? Kami siap membantu mempersiapkan perjalanan Anda.`
    },
    {
      label: 'Follow Up Jadwal',
      message: `Halo Kak ${name || 'Kak'},\n\nIni dari tim TripBanyuwangi. Menindaklanjuti pertanyaan Kakak sebelumnya mengenai trip ${destination || 'ke Banyuwangi'}.\n\nApakah Kakak sudah menentukan tanggal keberangkatan? Kami dapat membantu menyiapkan itinerary terbaik sesuai kebutuhan.`
    },
    {
      label: 'Tawarkan Promo Spesial',
      message: `Halo Kak ${name || 'Kak'},\n\nAda kabar baik dari TripBanyuwangi. Saat ini kami sedang ada penawaran promo spesial untuk trip ${destination || 'wisata Banyuwangi'}.\n\nApakah Kakak berminat melihat rincian paket promonya?`
    },
    {
      label: 'Konfirmasi Booking',
      message: `Halo Kak ${name || 'Kak'},\n\nTerima kasih atas ketertarikan Kakak pada paket trip ${destination || 'kami'}. Boleh kami tanyakan apakah pesanan sudah bisa dikonfirmasi untuk pengamanan slot?`
    },
    {
      label: 'Pengingat H-15 Trip',
      message: `Halo Kak ${name || 'Kak'},\n\nKami menginformasikan bahwa rencana trip ${destination || 'wisata'} Kakak tersisa 15 hari lagi. Apakah ada kustomisasi fasilitas atau konfirmasi jumlah peserta yang ingin disesuaikan?`
    },
    {
      label: 'Follow Up 3 Hari Inaktif',
      message: `Halo Kak ${name || 'Kak'},\n\nMenindaklanjuti percakapan kita 3 hari lalu terkait trip ${destination || 'Banyuwangi'}.\n\nApakah Kakak masih memerlukan informasi rincian itinerary atau penyesuaian anggaran? Kami siap membantu.`
    },
    {
      label: 'Follow Up Hot Lead (>7 Hari)',
      message: `Halo Kak ${name || 'Kak'},\n\nMenindaklanjuti diskusi kita terkait rencana trip ${destination || 'Banyuwangi'}.\n\nApakah ada pertanyaan atau penyesuaian khusus yang bisa kami bantu agar pesanan Kakak dapat segera dikonfirmasi?`
    },
  ];

  const handleSendFollowUp = async () => {
    if (!followUpLead) return;
    const msg = editedMessage || getFollowUpTemplates(followUpLead.name, followUpLead.destination)[followUpTemplate]?.message || '';
    setIsSendingWA(true);
    try {
      const res = await api.addManualMessage(followUpLead.id, {
        pengirim: 'admin',
        pesan: msg,
      });

      if (res.success) {
        setWaSuccessToast(`Pesan WhatsApp berhasil terkirim ke ${followUpLead.name || followUpLead.phone}!`);
        setTimeout(() => setWaSuccessToast(null), 4500);
        setFollowUpLead(null);
        fetchLeads({ status: 'ACTIVE', limit: 100, page: 1 });
      } else {
        alert(`Gagal mengirim WA: ${res.error || 'Pastikan WhatsApp admin terhubung.'}`);
      }
    } catch (err) {
      console.error('Error sending WA:', err);
      alert('Gagal menghubungi server untuk mengirim pesan WA.');
    } finally {
      setIsSendingWA(false);
    }
  };

  const handleOpenWhatsApp = (phone: string, message: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const normalized = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSaveNote = async () => {
    if (!activeNoteModal) return;
    setIsSavingNote(true);
    try {
      await useStore.getState().updateLead(activeNoteModal.leadId, { catatan_khusus: activeNoteModal.text });
      setActiveNoteModal(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
      case 'PROSPECT': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'QUALIFIED': return 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20';
      case 'HOT': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  // Dedicated Follow Up List: Active leads with Follow Up urgency rules
  const allFollowUpLeads = leads
    .filter(lead => ['QUALIFIED', 'PROSPECT', 'HOT', 'NEW'].includes(lead.status_lead) && getFollowUpNeed(lead) !== null)
    .sort((a, b) => {
      const now = Date.now();
      const getUrgencyTime = (item: LeadListItem) => {
        if (item.status_lead === 'PROSPECT' && item.estimasi_waktu) {
          const tripTime = new Date(item.estimasi_waktu).getTime();
          const diffDays = Math.ceil((tripTime - now) / (1000 * 60 * 60 * 24));
          if (diffDays <= 15 && diffDays >= 0) {
            return now - (30 - diffDays) * 24 * 60 * 60 * 1000;
          }
        }
        const lastActivity = item.last_activity_at ? new Date(item.last_activity_at).getTime() : 0;
        if (item.status_lead === 'HOT') {
          return lastActivity - (3 * 24 * 60 * 60 * 1000);
        }
        return lastActivity;
      };
      return getUrgencyTime(a) - getUrgencyTime(b);
    });

  // Search filter
  const searchFilteredLeads = allFollowUpLeads.filter(lead => {
    if (!searchInput.trim()) return true;
    const query = searchInput.toLowerCase();
    return (
      (lead.customerNama && lead.customerNama.toLowerCase().includes(query)) ||
      (lead.customerHp && lead.customerHp.includes(query)) ||
      (lead.kode_lead && lead.kode_lead.toLowerCase().includes(query)) ||
      (lead.minat_destinasi && lead.minat_destinasi.toLowerCase().includes(query))
    );
  });

  // Filtered Follow Up Leads based on sub-filter selection
  const filteredFollowUpLeads = searchFilteredLeads.filter(lead => {
    const fuNeed = getFollowUpNeed(lead);
    if (!fuNeed) return false;
    if (followUpFilter === 'ALL') return true;
    if (followUpFilter === 'H15') return fuNeed.type === 'PROSPECT_H15';
    if (followUpFilter === 'INACTIVE_3') return fuNeed.type === 'QUALIFIED_INACTIVE';
    if (followUpFilter === 'INACTIVE_5') return fuNeed.type === 'PROSPECT_INACTIVE';
    if (followUpFilter === 'INACTIVE_7') return fuNeed.type === 'HOT_INACTIVE';
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* WA Success Toast Notification */}
      {waSuccessToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Check size={18} className="shrink-0" />
            <span>{waSuccessToast}</span>
          </div>
          <button onClick={() => setWaSuccessToast(null)} className="p-1 hover:bg-emerald-500/20 rounded-lg cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-pink-500 dark:from-rose-400 dark:to-pink-400">
              Tabel Follow Up Leads
            </h1>
            <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Clock size={11} className="animate-pulse" />
              Follow Up Required ({allFollowUpLeads.length})
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-semibold">
            Fitur bar khusus follow up berbentuk tabel interaktif tersendiri. Urut berdasarkan prioritas trip H-15 &amp; durasi inaktif chat WA.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => fetchLeads({ status: 'ACTIVE', limit: 100, page: 1 })}
            disabled={leadsLoading}
            className="flex items-center gap-2 px-3.5 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl shadow-xs hover:bg-muted/50 transition-all disabled:opacity-60 cursor-pointer"
          >
            {leadsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span className="hidden sm:inline">Muat Ulang Data</span>
          </button>
        </div>
      </div>

      {/* Follow Up Stats Metric Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock size={13} className="text-rose-500" /> Total Perlu Follow Up
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-heading text-rose-600 dark:text-rose-400">
              {allFollowUpLeads.length}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Leads</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-orange-500" /> Trip H-15 (Mendekati)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-heading text-orange-600 dark:text-orange-400">
              {allFollowUpLeads.filter(l => getFollowUpNeed(l)?.type === 'PROSPECT_H15').length}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Urgent</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar size={13} className="text-cyan-500" /> Belum Di-chat 3-5 Hari
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-heading text-cyan-600 dark:text-cyan-400">
              {allFollowUpLeads.filter(l => ['QUALIFIED_INACTIVE', 'PROSPECT_INACTIVE'].includes(getFollowUpNeed(l)?.type || '')).length}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Leads</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame size={13} className="text-rose-500 animate-pulse" /> Hot Lead Inaktif (7+ Hari)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-heading text-rose-600 dark:text-rose-400">
              {allFollowUpLeads.filter(l => getFollowUpNeed(l)?.type === 'HOT_INACTIVE').length}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Leads</span>
          </div>
        </div>
      </div>

      {/* Search Input Bar (Non-sticky) */}
      <div className="p-3.5 md:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama, HP, atau destinasi follow up..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Sticky Urgency Filter Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md p-3.5 md:p-4 rounded-2xl border border-border/80 shadow-md flex items-center gap-2 overflow-x-auto scrollbar-none">
        {[
          { 
            id: 'ALL', 
            label: 'Semua Follow Up', 
            count: allFollowUpLeads.length,
            icon: <Layers size={14} className="shrink-0" />
          },
          { 
            id: 'H15', 
            label: 'Trip H-15', 
            count: allFollowUpLeads.filter(l => getFollowUpNeed(l)?.type === 'PROSPECT_H15').length,
            icon: <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          },
          { 
            id: 'INACTIVE_3', 
            label: 'Qualified >3 Hari', 
            count: allFollowUpLeads.filter(l => getFollowUpNeed(l)?.type === 'QUALIFIED_INACTIVE').length,
            icon: <Sparkles size={14} className="text-cyan-500 shrink-0" />
          },
          { 
            id: 'INACTIVE_5', 
            label: 'Prospect >5 Hari', 
            count: allFollowUpLeads.filter(l => getFollowUpNeed(l)?.type === 'PROSPECT_INACTIVE').length,
            icon: <Clock size={14} className="text-blue-500 shrink-0" />
          },
          { 
            id: 'INACTIVE_7', 
            label: 'Hot Lead >7 Hari', 
            count: allFollowUpLeads.filter(l => getFollowUpNeed(l)?.type === 'HOT_INACTIVE').length,
            icon: <Flame size={14} className="text-rose-500 shrink-0 animate-pulse" />
          },
        ].map(pill => (
          <button
            key={pill.id}
            onClick={() => setFollowUpFilter(pill.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer select-none shrink-0 ${
              followUpFilter === pill.id
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-500/20'
                : 'bg-card text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground'
            }`}
          >
            {pill.icon}
            <span>{pill.label}</span>
            <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
              followUpFilter === pill.id ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop Table View for Follow Up */}
      <div className="hidden md:block rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-rose-500/5 border-b border-border/80">
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Lead Code
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Customer Contact
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Status Pipeline
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Urgensi Follow Up
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Destinasi &amp; Pax
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Estimasi Trip
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Catatan Sales
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Admin CS
                </th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                  Aksi Follow Up
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/55">
              {leadsLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
                  </td>
                </tr>
              ) : filteredFollowUpLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Check size={24} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-foreground">Tidak Ada Follow Up Pending!</span>
                        <span className="text-xs text-muted-foreground">Semua lead kategori ini telah di-follow up atau belum mencapai batas waktu.</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFollowUpLeads.map((lead) => {
                  const fuNeed = getFollowUpNeed(lead);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      {/* Lead Code */}
                      <td className="px-4 py-3.5 font-bold text-sm text-primary font-mono whitespace-nowrap">
                        {lead.kode_lead}
                      </td>

                      {/* Customer Contact */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{lead.customerNama || 'Pelanggan WA'}</span>
                          <span className="text-xs text-muted-foreground font-mono">{lead.customerHp}</span>
                        </div>
                      </td>

                      {/* Status Pipeline */}
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                          {lead.status_lead}
                        </span>
                      </td>

                      {/* Urgensi Follow Up */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {fuNeed ? (
                          <button
                            type="button"
                            onClick={() => {
                              const fu = fuNeed ? fuNeed.templateIndex : 0;
                              setFollowUpTemplate(fu);
                              setFollowUpLead({
                                id: lead.id,
                                name: lead.customerNama || '',
                                phone: lead.customerHp,
                                destination: lead.minat_destinasi || ''
                              });
                            }}
                            className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all select-none ${fuNeed.style}`}
                            title="Kirim Follow Up WhatsApp"
                          >
                            {fuNeed.icon}
                            <span>{fuNeed.label}</span>
                            <span className="text-[10px] underline font-bold ml-1">Follow Up WA &rarr;</span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Destinasi & Pax */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground truncate max-w-[130px]">
                            {lead.minat_destinasi || '-'}
                          </span>
                          {lead.jumlah_peserta ? (
                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                              <Users size={10} /> {lead.jumlah_peserta} Pax
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Estimasi Trip */}
                      <td className="px-4 py-3.5 text-xs font-semibold text-muted-foreground font-mono">
                        {lead.estimasi_waktu ? (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-primary" />
                            {lead.estimasi_waktu.split('T')[0]}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Catatan Sales */}
                      <td
                        className="px-4 py-3.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNoteModal({ leadId: lead.id, text: lead.catatan_khusus || '' });
                        }}
                      >
                        {lead.catatan_khusus ? (
                          <div title="Klik untuk edit catatan" className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer select-none group">
                            <MessageSquare size={13} className="text-primary shrink-0" />
                            <span className="text-xs text-muted-foreground font-semibold group-hover:text-primary transition-colors truncate max-w-[110px]">
                              {lead.catatan_khusus.length > 25 ? lead.catatan_khusus.slice(0, 25) + '…' : lead.catatan_khusus}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs hover:text-primary cursor-pointer">+ Edit Note</span>
                        )}
                      </td>

                      {/* Admin CS */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 truncate max-w-[100px]">
                          <User size={11} className="shrink-0" />
                          {lead.adminNama || 'CS'}
                        </span>
                      </td>

                      {/* Aksi Follow Up */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLeadId(lead.id)}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs bg-card border border-border/80 text-foreground hover:bg-muted shadow-xs flex items-center gap-1 transition-all cursor-pointer select-none active:scale-95"
                            title="Buka Detail Lead"
                          >
                            <span>Detail</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (lead.has_deep_analysis) {
                                setSelectedLeadId(lead.id);
                                setOpenDeepAnalysisModal(true);
                              } else {
                                setConfirmAnalysisLead(lead);
                              }
                            }}
                            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                              lead.has_deep_analysis
                                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500 hover:text-white'
                                : 'bg-muted border-border/80 text-muted-foreground hover:bg-violet-500/10 hover:text-violet-500'
                            }`}
                            title={lead.has_deep_analysis ? 'Lihat Deep AI Analysis' : 'Jalankan Deep AI Analysis'}
                          >
                            <Brain size={14} className={lead.has_deep_analysis ? 'animate-pulse' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Friendly Follow Up Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {leadsLoading ? (
          <div className="p-8 text-center bg-card border border-border/80 rounded-2xl">
            <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
          </div>
        ) : filteredFollowUpLeads.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border/80 rounded-2xl shadow-xs flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Check size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-foreground">Tidak Ada Follow Up Pending!</span>
              <span className="text-xs text-muted-foreground">Semua lead pada kategori ini telah ditindaklanjuti.</span>
            </div>
          </div>
        ) : (
          filteredFollowUpLeads.map((lead) => {
            const fuNeed = getFollowUpNeed(lead);
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-3 active:scale-[0.99] transition-transform"
              >
                {/* Urgency Alert Header */}
                {fuNeed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const fu = fuNeed ? fuNeed.templateIndex : 0;
                      setFollowUpTemplate(fu);
                      setFollowUpLead({
                        id: lead.id,
                        name: lead.customerNama || '',
                        phone: lead.customerHp,
                        destination: lead.minat_destinasi || ''
                      });
                    }}
                    className={`w-full p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between cursor-pointer hover:opacity-90 transition-all ${fuNeed.style}`}
                    title="Kirim Follow Up WhatsApp"
                  >
                    <span className="flex items-center gap-1.5">
                      {fuNeed.icon}
                      <span>{fuNeed.label}</span>
                    </span>
                    <span className="text-[10px] underline font-bold">Follow Up WA &rarr;</span>
                  </button>
                )}

                {/* Customer Info & Code */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-base text-foreground">
                      {lead.customerNama || 'Pelanggan WA'}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {lead.customerHp}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                    {lead.kode_lead}
                  </span>
                </div>

                {/* Destination & Pax & Trip Date */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/50">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Destinasi</span>
                    <span className="font-semibold text-foreground truncate block">
                      {lead.minat_destinasi || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Tgl Trip / Pax</span>
                    <span className="font-semibold text-foreground font-mono block">
                      {lead.estimasi_waktu ? lead.estimasi_waktu.split('T')[0] : '-'} {lead.jumlah_peserta ? `(${lead.jumlah_peserta} Pax)` : ''}
                    </span>
                  </div>
                </div>

                {/* Note Snippet */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveNoteModal({ leadId: lead.id, text: lead.catatan_khusus || '' });
                  }}
                  className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40 hover:border-primary/40 transition-colors"
                >
                  <strong className="text-primary block text-[10px] uppercase font-bold mb-0.5">Catatan Sales CS:</strong>
                  <p className="line-clamp-2 italic">
                    {lead.catatan_khusus || '+ Tambah Catatan Khusus...'}
                  </p>
                </div>

                {/* Mobile Primary Actions */}
                <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-card border border-border text-foreground hover:bg-muted shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <span>Lihat Detail Lead</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (lead.has_deep_analysis) {
                        setSelectedLeadId(lead.id);
                        setOpenDeepAnalysisModal(true);
                      } else {
                        setConfirmAnalysisLead(lead);
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      lead.has_deep_analysis
                        ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                        : 'bg-muted border-border/80 text-muted-foreground'
                    }`}
                  >
                    <Brain size={16} className={lead.has_deep_analysis ? 'animate-pulse text-violet-500' : ''} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Editable Note Modal Dialog */}
      {activeNoteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveNoteModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border py-3.5 px-5 bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" />
                <span className="font-bold text-sm text-foreground">Edit Catatan Khusus Sales CS</span>
              </div>
              <button
                onClick={() => setActiveNoteModal(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <textarea
                value={activeNoteModal.text}
                onChange={(e) => setActiveNoteModal({ ...activeNoteModal, text: e.target.value })}
                placeholder="Tuliskan catatan khusus terkait minat, preferensi hotel, budget, dll..."
                rows={4}
                className="w-full p-3 border border-border/80 rounded-xl bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none font-sans"
              />

              <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setActiveNoteModal(null)}
                  className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isSavingNote}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingNote && <Loader2 size={13} className="animate-spin" />}
                  Simpan Catatan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Template Follow Up Modal */}
      {followUpLead && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFollowUpLead(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-up flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border py-3.5 px-5 bg-emerald-500/10">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-emerald-500" />
                <span className="font-bold text-sm text-foreground">
                  Kirim WhatsApp Follow Up &mdash; {followUpLead.name || 'Pelanggan'}
                </span>
              </div>
              <button
                onClick={() => setFollowUpLead(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Pilih Draf Template Pesan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getFollowUpTemplates(followUpLead.name, followUpLead.destination).map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFollowUpTemplate(idx)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        followUpTemplate === idx
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'border-border/80 bg-background text-muted-foreground hover:border-emerald-500/50'
                      }`}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Pratinjau &amp; Edit Pesan:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const orig = getFollowUpTemplates(followUpLead.name, followUpLead.destination)[followUpTemplate]?.message || '';
                      setEditedMessage(orig);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-primary font-semibold underline cursor-pointer"
                  >
                    Reset ke template
                  </button>
                </div>
                <textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  rows={7}
                  className="w-full p-3.5 rounded-xl border border-border/80 bg-muted/30 text-xs font-mono text-foreground leading-relaxed resize-y focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Ketik atau edit pesan di sini..."
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isSendingWA}
                    onClick={() => setFollowUpLead(null)}
                    className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isSendingWA}
                    onClick={handleSendFollowUp}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingWA ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Mengirim Pesan...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Kirim Pesan WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const msg = editedMessage || getFollowUpTemplates(followUpLead.name, followUpLead.destination)[followUpTemplate]?.message || '';
                      handleOpenWhatsApp(followUpLead.phone, msg);
                      setFollowUpLead(null);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-emerald-600 font-semibold underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ExternalLink size={12} /> Buka Web WA / App Manual
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deep Analysis Modal trigger */}
      {selectedLeadId && <LeadDetailDrawer />}
    </div>
  );
};

export default FollowUp;
