import React, { useEffect, useState, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';
import { VirtualChatList } from '../components/VirtualChatList';
import { Lead, ChatMessage, LeadListItem } from '../types';
import { api } from '../store/services/api';
import { 
  Search, 
  Send, 
  Phone, 
  User, 
  Calendar, 
  Users, 
  MapPin, 
  BadgePercent, 
  MessageSquare, 
  Sparkles, 
  Brain, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  Edit2, 
  Save, 
  ExternalLink,
  Info,
  Clock,
  UserCheck,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  LockKeyhole
} from 'lucide-react';

export const Chat: React.FC = () => {
  const { 
    leads, 
    fetchLeads, 
    setSelectedLeadId, 
    updateLead,
    updateCustomer,
    user
  } = useStore();

  // Role Permissions Check for 'chat' module (fallback to 'leads')
  const canWrite = user?.permissions?.['chat'] 
    ? user.permissions['chat'] === 'write' 
    : user?.permissions?.['leads'] === 'write';

  // Role Permissions Check for 'deep_analysis' module (fallback to 'chat' / 'leads')
  const deepPerm = user?.permissions?.['deep_analysis'] !== undefined 
    ? user.permissions['deep_analysis'] 
    : (user?.permissions?.['chat'] || user?.permissions?.['leads'] || 'none');
  const canReadDeepAnalyze = deepPerm !== 'none';
  const canWriteDeepAnalyze = deepPerm === 'write';

  // Local Chat Selection State (prevents global modal popups)
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Lazy Load / Infinite Scroll State for Contact List
  const [contacts, setContacts] = useState<LeadListItem[]>([]);
  const [contactPage, setContactPage] = useState<number>(1);
  const [hasMoreContacts, setHasMoreContacts] = useState<boolean>(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(false);
  const [totalContacts, setTotalContacts] = useState<number>(0);
  const contactListRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Layout states (Inline 3-pane layout, 0% popups)
  const [mobileTab, setMobileTab] = useState<'chat' | 'detail'>('chat');
  const [showDesktopRightPane, setShowDesktopRightPane] = useState(true);

  // Active Selected Lead Record & Inline Editors
  const [isEditingCustomerName, setIsEditingCustomerName] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState<string>('');

  const [isEditingValue, setIsEditingValue] = useState(false);
  const [orderValueInput, setOrderValueInput] = useState<string>('');
  
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [catatanInput, setCatatanInput] = useState<string>('');
  
  const [isEditingTripInfo, setIsEditingTripInfo] = useState(false);
  const [destinasiInput, setDestinasiInput] = useState<string>('');
  const [paxInput, setPaxInput] = useState<string>('');
  const [tglTripInput, setTglTripInput] = useState<string>('');
  const [sourceInput, setSourceInput] = useState<string>('');

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Inline Deep AI Analysis State (Embedded inside right pane, NO popup!)
  const [deepAnalysisData, setDeepAnalysisData] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showAnalysisInline, setShowAnalysisInline] = useState(false);

  // Ensure global modal is closed when entering Chat page
  useEffect(() => {
    setSelectedLeadId(null);
  }, []);

  // Lazy Load Contacts function (paginated 20 per batch)
  const loadContacts = async (pageToLoad: number, isReset = false) => {
    if (isLoadingContacts) return;
    setIsLoadingContacts(true);
    try {
      const res = await api.getLeads({
        page: pageToLoad,
        limit: 20,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });

      if (res.success && res.data) {
        setContacts(prev => isReset ? res.data : [...prev, ...res.data]);
        setTotalContacts(res.meta.total);
        setHasMoreContacts(pageToLoad < res.meta.totalPages);
        setContactPage(pageToLoad);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Reset & load contacts page 1 whenever searchQuery or statusFilter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadContacts(1, true);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  // Handle scroll to trigger lazy loading when reaching near bottom of left contacts pane
  const handleContactsScroll = () => {
    if (!contactListRef.current || isLoadingContacts || !hasMoreContacts) return;
    const { scrollTop, clientHeight, scrollHeight } = contactListRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      loadContacts(contactPage + 1, false);
    }
  };

  // Fetch messages and Deep AI analysis whenever active lead changes
  const loadActiveLeadMessages = async (leadId: number, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await api.getLeadMessages(leadId);
      if (res.success && res.data) {
        setChatMessages(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  const loadDeepAnalysis = async (leadId: number) => {
    try {
      const res = await api.getDeepAnalysis(leadId);
      if (res.success && res.data) {
        setDeepAnalysisData(res.data.result_json);
      } else {
        setDeepAnalysisData(null);
      }
    } catch (e) {
      setDeepAnalysisData(null);
    }
  };

  useEffect(() => {
    if (activeLeadId) {
      loadActiveLeadMessages(activeLeadId);
      loadDeepAnalysis(activeLeadId);
      setShowAnalysisInline(false);
      setMobileTab('chat');

      // Reset inline editor states
      setIsEditingCustomerName(false);
      setIsEditingValue(false);
      setIsEditingNotes(false);
      setIsEditingTripInfo(false);

      const found = contacts.find(l => l.id === activeLeadId) || leads.find(l => l.id === activeLeadId);
      if (found) {
        setCustomerNameInput(found.customerNama || '');
        setOrderValueInput(found.estimasi_nilai_order ? String(found.estimasi_nilai_order) : '');
        setCatatanInput(found.catatan_khusus || '');
        setDestinasiInput(found.minat_destinasi || '');
        setPaxInput(found.jumlah_peserta ? String(found.jumlah_peserta) : '');
        setTglTripInput(found.estimasi_waktu ? found.estimasi_waktu.split('T')[0] : '');
        setSourceInput(found.referral_source || 'tidak diketahui');
      }

      // Real-time Socket.IO WebSocket listener (Pure WebSocket transport)
      const socket = io({ transports: ['websocket'] });

      socket.on('new_message', (data: { lead_id: number; message: ChatMessage }) => {
        if (data.lead_id === activeLeadId) {
          setChatMessages(prev => {
            if (prev.some(m => m.id === data.message.id || (m.wa_message_id && m.wa_message_id === data.message.wa_message_id))) {
              return prev;
            }
            return [...prev, data.message];
          });
        }
      });

      return () => {
        socket.disconnect();
      };
    } else {
      setChatMessages([]);
      setDeepAnalysisData(null);
    }
  }, [activeLeadId]);

  // Run Deep AI Analysis Trigger (Embedded inline)
  const handleTriggerDeepAnalysis = async () => {
    if (!activeLeadId || !canWrite) return;
    setIsLoadingAnalysis(true);
    setShowAnalysisInline(true);
    try {
      const res = await api.deepAnalyzeLead(activeLeadId);
      if (res.success && res.data) {
        setDeepAnalysisData(res.data.result_json);
        loadContacts(1, true);
      } else {
        alert(res.error || 'Gagal memproses analisis AI.');
      }
    } catch (e: any) {
      console.error(e);
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const selectedLead = useMemo(() => {
    return contacts.find(l => l.id === activeLeadId) || leads.find(l => l.id === activeLeadId) || null;
  }, [contacts, leads, activeLeadId]);

  // Status Badge Helper
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  // Handle Send Outbound WA Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canWrite || !activeLeadId || !messageText.trim() || isSending) return;

    const textToSend = messageText.trim();
    setIsSending(true);

    try {
      const res = await api.addManualMessage(activeLeadId, {
        pengirim: 'admin',
        pesan: textToSend,
        ...(replyingTo ? {
          reply_to_wa_id: replyingTo.wa_message_id || undefined,
          reply_to_sender: replyingTo.pengirim,
          reply_to_snippet: replyingTo.pesan.slice(0, 100)
        } : {})
      });

      if (res.success) {
        setMessageText('');
        setReplyingTo(null);
        await loadActiveLeadMessages(activeLeadId, true);
        loadContacts(1, true);
      } else {
        alert(res.error || 'Gagal mengirim pesan.');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Terjadi kesalahan koneksi saat mengirim pesan.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Status Update
  const handleStatusChange = async (newStatus: Lead['status_lead']) => {
    if (!activeLeadId || !canWrite) return;
    setIsUpdatingStatus(true);
    try {
      await updateLead(activeLeadId, { status_lead: newStatus });
      loadContacts(1, true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Save Customer Name
  const handleSaveCustomerName = async () => {
    if (!selectedLead?.customer_id || !canWrite) return;
    await updateCustomer(selectedLead.customer_id, { nama_kontak: customerNameInput });
    setIsEditingCustomerName(false);
    loadContacts(1, true);
  };

  // Handle Save Order Value
  const handleSaveOrderValue = async () => {
    if (!activeLeadId || !canWrite) return;
    const num = orderValueInput ? parseInt(orderValueInput.replace(/\D/g, ''), 10) : null;
    await updateLead(activeLeadId, { estimasi_nilai_order: num });
    setIsEditingValue(false);
    loadContacts(1, true);
  };

  // Handle Save Trip Preferences Info
  const handleSaveTripInfo = async () => {
    if (!activeLeadId || !canWrite) return;
    const paxNum = paxInput ? parseInt(paxInput, 10) : null;
    const tripIso = tglTripInput ? new Date(tglTripInput).toISOString() : null;
    await updateLead(activeLeadId, {
      minat_destinasi: destinasiInput,
      jumlah_peserta: paxNum,
      estimasi_waktu: tripIso,
      referral_source: sourceInput
    });
    setIsEditingTripInfo(false);
    loadContacts(1, true);
  };

  // Handle Save Catatan
  const handleSaveCatatan = async () => {
    if (!activeLeadId || !canWrite) return;
    await updateLead(activeLeadId, { catatan_khusus: catatanInput });
    setIsEditingNotes(false);
    loadContacts(1, true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9.5rem)] md:h-[calc(100vh-2rem)] w-full rounded-2xl bg-card border border-border/80 shadow-lg overflow-hidden">
      
      {/* 3-Pane Container Grid (Inline Embedded, 0% Popups) */}
      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 h-full overflow-hidden">
        
        {/* ========================================================================= */}
        {/* PANE 1 (LEFT): Contacts & Conversations List (Lazy Loaded / Infinite Scroll) */}
        {/* ========================================================================= */}
        <div className={`md:col-span-4 lg:col-span-3 border-r border-border/60 flex flex-col h-full bg-card overflow-hidden ${
          activeLeadId ? 'hidden md:flex' : 'flex'
        }`}>
          {/* List Header */}
          <div className="p-3.5 border-b border-border/60 flex flex-col gap-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <MessageSquare size={16} />
                </div>
                <h2 className="font-heading font-black text-sm text-foreground uppercase tracking-wider">
                  Chat
                </h2>
              </div>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {totalContacts} Lead
              </span>
            </div>

            {/* Search Bar Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama, WA, atau kode lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Pills Quick Filter Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px] font-bold">
              {['ALL', 'NEW', 'QUALIFIED', 'PROSPECT', 'HOT', 'CLOSED WON', 'CLOSED LOST'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded-lg whitespace-nowrap border transition-all cursor-pointer select-none ${
                    statusFilter === st
                      ? 'bg-primary text-primary-foreground border-primary font-black shadow-xs'
                      : 'bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </button>
              ))}
            </div>
          </div>

          {/* List of Contacts with Infinite Scroll Lazy Load */}
          <div 
            ref={contactListRef}
            onScroll={handleContactsScroll}
            className="flex-1 overflow-y-auto divide-y divide-border/40"
          >
            {contacts.length === 0 && !isLoadingContacts ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <Search size={24} className="text-muted-foreground/50" />
                <span>Tidak ada percakapan lead ditemukan.</span>
              </div>
            ) : (
              contacts.map((lead) => {
                const isSelected = activeLeadId === lead.id;
                const initial = (lead.customerNama || 'P')[0].toUpperCase();

                return (
                  <div
                    key={lead.id}
                    onClick={() => setActiveLeadId(lead.id)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary/10 border-l-4 border-l-primary' 
                        : 'hover:bg-muted/40 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Avatar Circle */}
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {initial}
                      </div>
                      <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500 shadow-xs" title="WhatsApp Active" />
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-foreground truncate">
                          {lead.customerNama || 'Pelanggan WA'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {formatDate(lead.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                          {lead.customerHp}
                        </span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 ${getStatusBadge(lead.status_lead)}`}>
                          {lead.status_lead}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold mt-0.5">
                        <span className="font-mono text-primary font-bold">{lead.kode_lead}</span>
                        <span className="truncate max-w-[90px]">{lead.adminNama || 'CS'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Lazy Load Contacts Spinner */}
            {isLoadingContacts && (
              <div className="py-3.5 text-center text-xs text-muted-foreground font-semibold flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span>Memuat kontak...</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE 2 (MIDDLE): Chat Log Stream & Message Input */}
        {/* ========================================================================= */}
        <div className={`md:col-span-8 ${showDesktopRightPane ? 'lg:col-span-6' : 'lg:col-span-9'} flex flex-col h-full bg-background overflow-hidden ${
          !activeLeadId ? 'hidden md:flex items-center justify-center p-8' : mobileTab === 'detail' ? 'hidden lg:flex' : 'flex'
        }`}>
          {!activeLeadId ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 max-w-sm">
              <div className="h-16 w-16 rounded-3xl bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shadow-inner">
                <MessageSquare size={32} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-heading font-black text-base text-foreground">
                  Pilih Percakapan Lead
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pilih kontak dari daftar di sebelah kiri untuk melihat riwayat percakapan WhatsApp dan membalas pesan secara langsung.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Top Header */}
              <div className="p-3.5 border-b border-border/60 bg-card flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setActiveLeadId(null)}
                    className="md:hidden p-1.5 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* Customer Avatar & Main Info */}
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    {(selectedLead?.customerNama || 'P')[0].toUpperCase()}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm text-foreground truncate">
                        {selectedLead?.customerNama || 'Pelanggan WA'}
                      </span>
                      <span className={`text-[9px] font-extrabold px-2 py-0.2 rounded-full uppercase tracking-wider shrink-0 ${getStatusBadge(selectedLead?.status_lead || 'NEW')}`}>
                        {selectedLead?.status_lead}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>{selectedLead?.customerHp}</span>
                      <span>•</span>
                      <span className="text-primary font-bold">{selectedLead?.kode_lead}</span>
                    </div>
                  </div>
                </div>

                {/* Top Header Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* WA Direct Chat Link */}
                  {selectedLead?.customerHp && (
                    <button
                      onClick={() => {
                        const cleaned = selectedLead.customerHp.replace(/\D/g, '');
                        const normalized = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
                        window.open(`https://wa.me/${normalized}`, '_blank');
                      }}
                      className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer select-none"
                      title="Buka Chat di WhatsApp Web/App"
                    >
                      <Phone size={12} />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                  )}

                  {/* Info Button (i): Toggle Embedded Right Panel (0% Popups) */}
                  <button
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setMobileTab(mobileTab === 'detail' ? 'chat' : 'detail');
                      } else {
                        setShowDesktopRightPane(!showDesktopRightPane);
                      }
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer select-none ${
                      (showDesktopRightPane && window.innerWidth >= 1024) || (mobileTab === 'detail' && window.innerWidth < 1024)
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    title="Toggle Panel Detail & Profil Lead"
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>

              {/* Chat Stream Body */}
              <div className="flex-1 overflow-hidden p-2 sm:p-3 flex flex-col bg-background">
                {isLoadingMessages && chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Memuat riwayat chat...
                  </div>
                ) : (
                  <VirtualChatList 
                    messages={chatMessages} 
                    onReplyMessage={(msg) => setReplyingTo(msg)} 
                  />
                )}
              </div>

              {/* Input Composer Footer (Enforces Role Permission 'write') */}
              {canWrite ? (
                <div className="p-3 border-t border-border/60 bg-card flex flex-col gap-2 shrink-0">
                  {/* Reply Quote Banner */}
                  {replyingTo && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-muted/60 border border-border text-xs">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-[10px] text-primary uppercase">
                          Membalas {replyingTo.pengirim === 'admin' ? 'Admin' : 'Customer'}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          "{replyingTo.pesan}"
                        </span>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Form Message Input */}
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Tulis balasan pesan WhatsApp ke customer..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 transition-all font-sans"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !messageText.trim()}
                      className="h-10 px-4 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                    >
                      {isSending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <span>Kirim</span>
                          <Send size={13} />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Read-Only Lock Banner when user has read-only permission */
                <div className="p-3 bg-muted/40 border-t border-border/60 text-center text-xs text-muted-foreground font-semibold flex items-center justify-center gap-2 shrink-0">
                  <LockKeyhole size={14} className="text-amber-500" />
                  <span>Mode Baca-Saja: Akun Anda hanya memiliki izin membaca data lead.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE 3 (RIGHT): Embedded Lead Profile & CRM Details Panel (0% POPUPS) */}
        {/* ========================================================================= */}
        {activeLeadId && (
          <div className={`lg:col-span-3 border-l border-border/60 flex flex-col h-full bg-card overflow-y-auto ${
            mobileTab === 'detail' ? 'flex md:col-span-8 lg:col-span-3' : showDesktopRightPane ? 'hidden lg:flex' : 'hidden'
          }`}>
            {/* Header Right Pane with Mobile Back Button */}
            <div className="p-3.5 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                {/* Mobile Back Button to return to Chat */}
                <button
                  onClick={() => setMobileTab('chat')}
                  className="lg:hidden flex items-center gap-1 text-xs font-bold text-primary hover:underline select-none"
                >
                  <ChevronLeft size={16} />
                  <span>Kembali ke Chat</span>
                </button>

                <div className="hidden lg:flex items-center gap-2">
                  <UserCheck size={16} className="text-primary" />
                  <h3 className="font-heading font-black text-xs text-foreground uppercase tracking-wider">
                    Profil &amp; CRM Lead
                  </h3>
                </div>
              </div>

              <span className="font-mono text-xs font-bold text-primary hidden lg:inline">
                {selectedLead?.kode_lead}
              </span>
            </div>

            {/* Profile Content Body (Enforces Permission Checks for Editing) */}
            <div className="p-4 flex flex-col gap-4 text-xs">
              
              {/* Customer Main Info Card (Editable Name if canWrite) */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Kontak Customer
                  </span>
                  {canWrite && (!isEditingCustomerName ? (
                    <button
                      onClick={() => setIsEditingCustomerName(true)}
                      className="text-primary hover:underline font-bold text-[10px] flex items-center gap-1"
                    >
                      <Edit2 size={10} /> Edit Nama
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveCustomerName}
                      className="text-emerald-500 font-bold text-[10px] flex items-center gap-1"
                    >
                      <Save size={10} /> Simpan
                    </button>
                  ))}
                </div>

                {!isEditingCustomerName ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading font-black text-sm text-foreground">
                      {selectedLead?.customerNama || 'Pelanggan WA'}
                    </span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {selectedLead?.customerHp}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      placeholder="Nama Customer..."
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-primary rounded-xl focus:outline-none font-bold text-foreground"
                    />
                    <span className="font-mono text-muted-foreground text-xs">
                      {selectedLead?.customerHp}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <span>Assigned CS:</span>
                  <strong className="text-foreground">{selectedLead?.adminNama || 'CS'}</strong>
                </div>
              </div>

              {/* Quick Status Lead Dropdown Editor (Disabled if read-only) */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex flex-col gap-2">
                <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  Status Lead (Tahapan Pipeline)
                </span>
                <select
                  value={selectedLead?.status_lead || 'NEW'}
                  disabled={isUpdatingStatus || !canWrite}
                  onChange={(e) => handleStatusChange(e.target.value as Lead['status_lead'])}
                  className={`w-full px-3 py-2 text-xs rounded-xl font-bold uppercase border focus:outline-none transition-all ${
                    !canWrite ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                  } ${getStatusBadge(selectedLead?.status_lead || 'NEW')}`}
                >
                  <option value="NEW">NEW</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="PROSPECT">PROSPECT</option>
                  <option value="HOT">HOT</option>
                  <option value="CLOSED WON">CLOSED WON</option>
                  <option value="CLOSED LOST">CLOSED LOST</option>
                </select>
              </div>

              {/* Order Value Quick Edit Card (Disabled if read-only) */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Estimasi Nilai Order (Rp)
                  </span>
                  {canWrite && (!isEditingValue ? (
                    <button
                      onClick={() => setIsEditingValue(true)}
                      className="text-primary hover:underline font-bold text-[10px] flex items-center gap-1"
                    >
                      <Edit2 size={10} /> Edit
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveOrderValue}
                      className="text-emerald-500 font-bold text-[10px] flex items-center gap-1"
                    >
                      <Save size={10} /> Simpan
                    </button>
                  ))}
                </div>

                {!isEditingValue ? (
                  <span className="font-heading font-extrabold text-base text-orange-600 dark:text-orange-400">
                    {selectedLead?.estimasi_nilai_order ? `Rp ${selectedLead.estimasi_nilai_order.toLocaleString('id-ID')}` : 'Rp -'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={orderValueInput}
                    onChange={(e) => setOrderValueInput(e.target.value)}
                    placeholder="Contoh: 5000000"
                    className="w-full px-2.5 py-1.5 text-xs bg-background border border-primary rounded-xl focus:outline-none font-mono text-foreground font-bold"
                  />
                )}
              </div>

              {/* Trip Preferences Details (Editable if canWrite) */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Informasi Trip &amp; Minat
                  </span>
                  {canWrite && (!isEditingTripInfo ? (
                    <button
                      onClick={() => setIsEditingTripInfo(true)}
                      className="text-primary hover:underline font-bold text-[10px] flex items-center gap-1"
                    >
                      <Edit2 size={10} /> Edit
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveTripInfo}
                      className="text-emerald-500 font-bold text-[10px] flex items-center gap-1"
                    >
                      <Save size={10} /> Simpan
                    </button>
                  ))}
                </div>

                {!isEditingTripInfo ? (
                  <div className="flex flex-col gap-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <MapPin size={12} /> Destinasi:
                      </span>
                      <strong className="text-foreground">{selectedLead?.minat_destinasi || '-'}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Users size={12} /> Jumlah Peserta:
                      </span>
                      <strong className="text-foreground">{selectedLead?.jumlah_peserta ? `${selectedLead.jumlah_peserta} Pax` : '-'}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Calendar size={12} /> Tanggal Trip:
                      </span>
                      <strong className="text-foreground font-mono">
                        {selectedLead?.estimasi_waktu ? selectedLead.estimasi_waktu.split('T')[0] : '-'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <BadgePercent size={12} /> Channel Source:
                      </span>
                      <strong className="text-foreground uppercase">{selectedLead?.referral_source || 'tidak diketahui'}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 py-1 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Minat Destinasi:</label>
                      <input
                        type="text"
                        value={destinasiInput}
                        onChange={(e) => setDestinasiInput(e.target.value)}
                        placeholder="Contoh: Kawah Ijen, Baluran"
                        className="px-2.5 py-1 bg-background border border-primary rounded-lg text-xs font-semibold focus:outline-none text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Jumlah Peserta (Pax):</label>
                      <input
                        type="number"
                        value={paxInput}
                        onChange={(e) => setPaxInput(e.target.value)}
                        placeholder="Contoh: 4"
                        className="px-2.5 py-1 bg-background border border-primary rounded-lg text-xs font-mono font-bold focus:outline-none text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Tanggal Trip:</label>
                      <input
                        type="date"
                        value={tglTripInput}
                        onChange={(e) => setTglTripInput(e.target.value)}
                        className="w-full px-2.5 py-1 bg-background border border-primary rounded-lg text-xs font-mono font-bold focus:outline-none text-foreground text-left"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Channel Source:</label>
                      <select
                        value={sourceInput}
                        onChange={(e) => setSourceInput(e.target.value)}
                        className="px-2 py-1 bg-background border border-primary rounded-lg text-xs font-bold uppercase focus:outline-none cursor-pointer text-foreground"
                      >
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
                  </div>
                )}
              </div>

              {/* Catatan Khusus Textarea (Editable if canWrite) */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Catatan Khusus CS
                  </span>
                  {canWrite && (!isEditingNotes ? (
                    <button
                      onClick={() => setIsEditingNotes(true)}
                      className="text-primary hover:underline font-bold text-[10px] flex items-center gap-1"
                    >
                      <Edit2 size={10} /> Edit
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveCatatan}
                      className="text-emerald-500 font-bold text-[10px] flex items-center gap-1"
                    >
                      <Save size={10} /> Simpan
                    </button>
                  ))}
                </div>

                {!isEditingNotes ? (
                  <p className="text-muted-foreground text-[11px] leading-relaxed italic bg-background/50 p-2 rounded-xl border border-border/60 min-h-[50px]">
                    {selectedLead?.catatan_khusus || 'Belum ada catatan khusus.'}
                  </p>
                ) : (
                  <textarea
                    rows={3}
                    value={catatanInput}
                    onChange={(e) => setCatatanInput(e.target.value)}
                    placeholder="Tulis catatan penanganan lead..."
                    className="w-full p-2 text-xs bg-background border border-primary rounded-xl focus:outline-none text-foreground font-sans"
                  />
                )}
              </div>

              {/* Inline Deep AI Analysis Section (Disabled if read-only) */}
              {canReadDeepAnalyze && (
                <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Brain size={15} className="text-violet-500" />
                      <span className="font-heading font-black text-xs text-foreground uppercase tracking-wider">
                        Deep AI Analysis
                      </span>
                    </div>
                    <button
                      onClick={() => setShowAnalysisInline(!showAnalysisInline)}
                      className="text-muted-foreground hover:text-foreground text-[10px] font-bold flex items-center gap-0.5"
                    >
                      <span>{showAnalysisInline ? 'Sembunyikan' : 'Tampilkan'}</span>
                      {showAnalysisInline ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {!deepAnalysisData && !isLoadingAnalysis && canWriteDeepAnalyze && (
                    <button
                      onClick={handleTriggerDeepAnalysis}
                      className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>Jalankan Deep AI Analysis</span>
                    </button>
                  )}

                  {isLoadingAnalysis && (
                    <div className="py-4 text-center text-xs text-violet-500 font-semibold flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Menganalisis percakapan...
                    </div>
                  )}

                  {deepAnalysisData && (
                    <div className="flex flex-col gap-2.5">
                      {showAnalysisInline && (
                        <div className="flex flex-col gap-2 border-t border-violet-500/20 pt-2 text-xs">
                          
                          {/* Skor & Potensi */}
                          <div className="grid grid-cols-2 gap-2">
                            {deepAnalysisData.skor_kualitas && (
                              <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">Skor Kualitas</span>
                                <span className="text-[10px] font-semibold text-foreground">{deepAnalysisData.skor_kualitas}</span>
                              </div>
                            )}
                            {deepAnalysisData.potensi_closing && (
                              <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Potensi Closing</span>
                                <span className="text-[10px] font-semibold text-foreground">{deepAnalysisData.potensi_closing}</span>
                              </div>
                            )}
                          </div>

                          {/* Budget & Buyer Type */}
                          <div className="grid grid-cols-2 gap-2">
                            {deepAnalysisData.budget_sensitivity && (
                              <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Budget Sensitivity</span>
                                <span className="text-[10px] font-semibold text-foreground">{deepAnalysisData.budget_sensitivity}</span>
                              </div>
                            )}
                            {deepAnalysisData.tipe_buyer && (
                              <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Tipe Buyer</span>
                                <span className="text-[10px] font-semibold text-foreground">{deepAnalysisData.tipe_buyer}</span>
                              </div>
                            )}
                          </div>

                          {/* Objection Utama */}
                          {deepAnalysisData.objection_utama && (
                            <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Keberatan Utama (Objection)</span>
                              <span className="text-[10px] font-semibold text-foreground">{deepAnalysisData.objection_utama}</span>
                            </div>
                          )}

                          {/* Kesalahan Saya / Evaluasi Admin */}
                          {deepAnalysisData.kesalahan_saya && (
                            <div className="p-2 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Evaluasi CS / Kekurangan</span>
                              <span className="text-[10px] font-semibold text-foreground">{deepAnalysisData.kesalahan_saya}</span>
                            </div>
                          )}

                          {/* Saran Respon */}
                          {deepAnalysisData.saran_respon && (
                            <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 flex flex-col gap-1">
                              <span className="text-[9px] font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles size={10} /> Saran Respon Selanjutnya
                              </span>
                              <p className="text-[10px] font-semibold text-foreground leading-relaxed">
                                {deepAnalysisData.saran_respon}
                              </p>
                            </div>
                          )}

                        </div>
                      )}

                      {canWriteDeepAnalyze && (
                        <button
                          onClick={handleTriggerDeepAnalysis}
                          className="text-[10px] font-bold text-violet-500 hover:underline flex items-center justify-center gap-1 mt-1 cursor-pointer"
                        >
                          <RefreshCw size={10} /> Analisis Ulang AI
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
