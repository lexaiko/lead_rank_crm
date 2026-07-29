import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Calendar, Users, MapPin, BadgePercent, MessageSquare, AlertCircle, Save, Check, LockKeyhole, CheckCircle2, XCircle, Phone, Brain, Copy, RefreshCw, User, Sparkles, Share2, UserCheck, ShieldAlert, Reply, Send, Loader2, ExternalLink } from 'lucide-react';
import { VirtualChatList } from './VirtualChatList';
import { Lead, ChatMessage } from '../types';
import { api } from '../store/services/api';

export const LeadDetailDrawer: React.FC = () => {
  const { 
    selectedLeadId, 
    setSelectedLeadId, 
    dashboardData,
    leads,
    activeChatMessages, 
    fetchMessages, 
    appendChatMessage,
    updateLead,
    updateCustomer,
    isLoading,
    isLoadingMessages,
    user,
    openDeepAnalysisModal,
    setOpenDeepAnalysisModal,
    fetchLeads
  } = useStore();

  const [localLead, setLocalLead] = useState<Lead | null>(null);
  const [customerNama, setCustomerNama] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'chat'>('profile');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Follow Up modal state
  const [followUpModal, setFollowUpModal] = useState(false);
  const [followUpTemplate, setFollowUpTemplate] = useState(0);
  const [editedMessage, setEditedMessage] = useState('');
  const [isSendingWA, setIsSendingWA] = useState(false);

  // Sync editedMessage when template or lead changes
  useEffect(() => {
    if (leadData) {
      const msg = getFollowUpTemplates(leadData.customerNama || '', leadData.minat_destinasi || '')[followUpTemplate]?.message || '';
      setEditedMessage(msg);
    }
  }, [followUpTemplate, selectedLeadId]);

  // Deep Analysis state
  const [deepAnalysisModal, setDeepAnalysisModal] = useState(false);
  const [deepAnalysisData, setDeepAnalysisData] = useState<any | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Manual Chat Insertion state
  const [isManualChatOpen, setIsManualChatOpen] = useState(false);
  const [manualSender, setManualSender] = useState<'admin' | 'customer'>('customer');
  const [manualText, setManualText] = useState('');
  const [manualTime, setManualTime] = useState('');

  // Interactive Chat Reply & Quick Input State
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
  const [quickText, setQuickText] = useState('');
  const [isSendingQuickText, setIsSendingQuickText] = useState(false);

  const handleReplyToBubble = (message: ChatMessage) => {
    setReplyingToMessage(message);
    setActiveSubTab('chat');
  };

  const handleSendQuickMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLeadId || !quickText.trim() || isSendingQuickText) return;

    setIsSendingQuickText(true);
    try {
      const payload: any = {
        pengirim: 'admin',
        pesan: quickText.trim(),
        waktu_pesan: new Date().toISOString()
      };

      if (replyingToMessage) {
        payload.reply_to_wa_id = replyingToMessage.wa_message_id || null;
        payload.reply_to_snippet = replyingToMessage.pesan;
        payload.reply_to_sender = replyingToMessage.pengirim;
      }

      const res = await api.addManualMessage(selectedLeadId, payload);
      if (res.success) {
        setQuickText('');
        setReplyingToMessage(null);
        if (res.data) {
          appendChatMessage(res.data);
        }
        await fetchMessages(selectedLeadId, true);
        fetchLeads();
        if ((res as any).sentViaBaileys) {
          showToast('Pesan berhasil terkirim!', 'success');
        } else {
          showToast('Pesan tersimpan di CRM (WA Admin belum tersambung)', 'success');
        }
      } else {
        showToast(res.error || 'Gagal mengirim pesan.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Terjadi kesalahan koneksi.', 'error');
    } finally {
      setIsSendingQuickText(false);
    }
  };

  const fetchDeepAnalysis = async (leadId: number) => {
    try {
      const res = await api.getDeepAnalysis(leadId);
      if (res.success && res.data) {
        setDeepAnalysisData(res.data.result_json);
      } else {
        setDeepAnalysisData(null);
      }
    } catch (e) {
      console.error('Error fetching deep analysis', e);
    }
  };

  const handleDeepAnalyze = async () => {
    if (!selectedLeadId) return;
    setIsLoadingAnalysis(true);
    setAnalysisError(null);
    setDeepAnalysisModal(true); // Open modal immediately to show loading state
    try {
      const res = await api.deepAnalyzeLead(selectedLeadId);
      if (res.success && res.data) {
        setDeepAnalysisData(res.data.result_json);
        showToast('Deep Analysis berhasil diselesaikan!', 'success');
        fetchLeads(); // Refresh leads list to update status badge to "Sudah Analisis"
      } else {
        setAnalysisError(res.error || 'Gagal memproses analisis mendalam.');
        showToast(res.error || 'Gagal memproses analisis mendalam.', 'error');
      }
    } catch (e: any) {
      console.error('Error running deep analysis', e);
      setAnalysisError(e.message || 'Terjadi kesalahan sistem saat menghubungi AI.');
      showToast('Terjadi kesalahan koneksi.', 'error');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleSaveManualChat = async () => {
    if (!selectedLeadId) return;
    if (!manualText.trim()) {
      showToast('Isi pesan tidak boleh kosong.', 'error');
      return;
    }
    try {
      const res = await api.addManualMessage(selectedLeadId, {
        pengirim: manualSender,
        pesan: manualText,
        waktu_pesan: manualTime ? new Date(manualTime).toISOString() : new Date().toISOString()
      });
      if (res.success) {
        showToast('Pesan berhasil disisipkan!', 'success');
        setIsManualChatOpen(false);
        setManualText('');
        setManualTime('');
        if (res.data) {
          appendChatMessage(res.data);
        }
        await fetchMessages(selectedLeadId, true);
        fetchLeads();
      } else {
        showToast(res.error || 'Gagal menyimpan pesan.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast('Terjadi kesalahan koneksi.', 'error');
    }
  };

  const handleOpenDeepAnalysis = () => {
    if (deepAnalysisData) {
      setDeepAnalysisModal(true);
    } else {
      handleDeepAnalyze();
    }
  };

  const handleCopyAnalysis = () => {
    if (!deepAnalysisData) return;
    const text = `HASIL DEEP ANALYSIS PERCAKAPAN LEAD (${leadData?.customerNama || 'Pelanggan'} - ${leadData?.kode_lead || ''})

- Skor Kualitas: ${deepAnalysisData.skor_kualitas}
- Potensi Closing: ${deepAnalysisData.potensi_closing}
- Sensitivitas Budget: ${deepAnalysisData.budget_sensitivity}
- Tipe Buyer: ${deepAnalysisData.tipe_buyer}
- Keberatan Utama: ${deepAnalysisData.objection_utama}
- Evaluasi Chat Admin: ${deepAnalysisData.kesalahan_saya}
- Saran Respon Selanjutnya: ${deepAnalysisData.saran_respon}`;

    navigator.clipboard.writeText(text);
    showToast('Analisis disalin ke clipboard!', 'success');
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const canWriteLeads = user?.permissions?.leads === 'write';
  const canIgnore = user?.permissions?.leads === 'write' || user?.permissions?.customers === 'write';

  // WhatsApp follow up templates
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
    if (!selectedLeadId || !leadData) return;
    const templates = getFollowUpTemplates(leadData.customerNama || '', leadData.minat_destinasi || '');
    const msg = editedMessage || templates[followUpTemplate]?.message || '';
    setIsSendingWA(true);
    try {
      const res = await api.addManualMessage(selectedLeadId, {
        pengirim: 'admin',
        pesan: msg,
      });

      if (res.success) {
        showToast(`Pesan WhatsApp follow up berhasil terkirim!`, 'success');
        setFollowUpModal(false);
        await fetchMessages(selectedLeadId, true);
        fetchLeads();
      } else {
        showToast(`Gagal mengirim WA: ${res.error || 'Pastikan WhatsApp admin terhubung.'}`, 'error');
      }
    } catch (err) {
      console.error('Error sending WA:', err);
      showToast('Gagal menghubungi server untuk mengirim pesan WA.', 'error');
    } finally {
      setIsSendingWA(false);
    }
  };

  const handleOpenWhatsApp = (phone: string, message: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const normalized = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${normalized}?text=${encoded}`, '_blank');
  };

  // Find selected lead from paginated leads list
  const leadData = leads.find(l => l.id === selectedLeadId);

  // Fetch messages and deep analysis when drawer opens, and listen to real-time SSE event stream (zero polling)
  useEffect(() => {
    if (!selectedLeadId) return;

    fetchMessages(selectedLeadId);
    fetchDeepAnalysis(selectedLeadId);

    const es = new EventSource('/api/events');

    es.addEventListener('chatMessage', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.leadId === selectedLeadId && payload.messageData) {
          appendChatMessage(payload.messageData);
        }
        fetchLeads();
      } catch (err) {
        console.error('SSE chatMessage processing error', err);
      }
    });

    es.addEventListener('leadUpdate', () => {
      fetchLeads();
    });

    return () => {
      es.close();
    };
  }, [selectedLeadId]);

  // Open Deep Analysis modal directly if triggered from list
  useEffect(() => {
    if (selectedLeadId && openDeepAnalysisModal) {
      setDeepAnalysisModal(true);
      setOpenDeepAnalysisModal(false);
    }
  }, [selectedLeadId, openDeepAnalysisModal]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (selectedLeadId) {
      document.body.style.overflow = 'hidden';
      setActiveSubTab('profile'); // Reset to profile tab
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedLeadId]);

  // Sync local editing state
  useEffect(() => {
    if (leadData) {
      // Find full lead schema from database representation
      setLocalLead({
        id: leadData.id,
        kode_lead: leadData.kode_lead,
        customer_id: leadData.customer_id,
        admin_id: leadData.admin_id,
        status_lead: leadData.status_lead as any,
        minat_destinasi: leadData.minat_destinasi,
        jumlah_peserta: leadData.jumlah_peserta,
        estimasi_waktu: leadData.estimasi_waktu,
        catatan_khusus: leadData.catatan_khusus,
        catatan_sistem: leadData.catatan_sistem,
        referral_source: leadData.referral_source,
        estimasi_nilai_order: leadData.estimasi_nilai_order,
        last_activity_at: null,
        closed_at: null,
        ai_summary: leadData.ai_summary || null,
        ai_last_analyzed_message_id: null,
        ai_last_analyzed_at: null,
        createdAt: leadData.createdAt,
        updatedAt: leadData.updatedAt,
      });
      setCustomerNama(leadData.customerNama || '');
    } else {
      setLocalLead(null);
      setCustomerNama('');
    }
  }, [leadData]);

  if (!selectedLeadId || !leadData || !localLead) return null;

  const handleChange = (field: keyof Lead, value: any) => {
    setLocalLead(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSave = async () => {
    if (!localLead) return;
    await updateLead(localLead.id, {
      status_lead: localLead.status_lead,
      minat_destinasi: localLead.minat_destinasi,
      jumlah_peserta: localLead.jumlah_peserta,
      estimasi_waktu: localLead.estimasi_waktu,
      catatan_khusus: localLead.catatan_khusus,
      estimasi_nilai_order: localLead.estimasi_nilai_order,
      referral_source: localLead.referral_source,
      customer_nama: customerNama || null,
    } as any);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleIgnoreContact = () => {
    if (!localLead) return;
    const name = leadData?.customerNama || 'Pelanggan WA';
    const phone = leadData?.customerHp || '';

    setConfirmModal({
      isOpen: true,
      title: 'Abaikan Kontak?',
      message: `Apakah Anda yakin ingin mengabaikan kontak "${name}" (${phone})? Kontak ini akan disembunyikan dari seluruh statistik dashboard, laporan konversi, dan pesan baru dari mereka tidak akan diproses oleh CRM.`,
      onConfirm: async () => {
        const success = await updateCustomer(localLead.customer_id, { is_ignored: true });
        if (success) {
          showToast('Kontak telah berhasil diabaikan.', 'success');
          setTimeout(() => {
            setSelectedLeadId(null); // Close the drawer after 1.2s
          }, 1200);
        } else {
          showToast('Gagal mengabaikan kontak.', 'error');
        }
      }
    });
  };

  const getStatusBadgeClass = (status: string) => {
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
    <>
      {/* Sidebar Backdrop Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setSelectedLeadId(null)}
      />

      {/* Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 transform translate-x-0">
        {/* Drawer Header */}
        <div className="border-b border-border bg-card text-foreground shadow-xs">
          {/* Top row: lead info + status + admin + close */}
          <div className="flex items-center justify-between py-2 px-3 md:py-3.5 md:px-5">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <span className="font-heading font-black text-sm md:text-lg tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
                {localLead.kode_lead}
              </span>
              <span className={`text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadgeClass(localLead.status_lead)}`}>
                {localLead.status_lead}
              </span>
              <div className="flex items-center gap-1 bg-muted/60 border border-border/80 px-2 py-0.5 rounded-full text-[11px] font-semibold text-muted-foreground">
                <User size={11} className="text-primary" />
                <span>CS: <strong className="text-foreground">{leadData.adminNama}</strong></span>
              </div>
            </div>

            <button 
              onClick={() => setSelectedLeadId(null)}
              className="p-1.5 md:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 cursor-pointer"
              title="Tutup Modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action buttons row — Follow Up, Deep AI, Abaikan */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5 md:px-5 md:pb-3.5 flex-wrap">
            <button
              type="button"
              onClick={() => { setFollowUpTemplate(0); setFollowUpModal(true); }}
              className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] md:text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
            >
              <Phone size={13} /> Follow Up
            </button>

            <button
              type="button"
              onClick={handleOpenDeepAnalysis}
              className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-[11px] md:text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
            >
              <Brain size={13} /> {deepAnalysisData ? 'Deep AI' : 'Mulai AI'}
            </button>

            {canIgnore && (
              <button
                type="button"
                onClick={handleIgnoreContact}
                className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] md:text-xs rounded-lg border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
              >
                <ShieldAlert size={13} /> Abaikan
              </button>
            )}
          </div>
        </div>

        {/* Segmented Control Sub-tabs for mobile view */}
        <div className="md:hidden p-1.5 border-b border-border/80 bg-card/95 backdrop-blur-md shrink-0">
          <div className="grid grid-cols-2 p-0.5 rounded-xl bg-muted/60 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveSubTab('profile')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all select-none cursor-pointer ${
                activeSubTab === 'profile'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck size={13} />
              <span>Form Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('chat')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all select-none cursor-pointer ${
                activeSubTab === 'chat'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare size={13} />
              <span>WA Chat Log</span>
              {activeChatMessages.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  activeSubTab === 'chat' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                }`}>
                  {activeChatMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Drawer Content Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Column: Redesigned Lead Info Form */}
          <div className={`w-full md:w-[48%] border-b md:border-b-0 md:border-r border-border p-3 md:p-6 overflow-y-auto flex flex-col justify-between ${
            activeSubTab === 'profile' ? 'flex' : 'hidden md:flex'
          }`}>
            <div className="flex flex-col gap-3 md:gap-5">
              
              {/* Form Section Title */}
              <div className="flex items-center justify-between border-b border-border/60 pb-2 md:pb-3">
                <div className="flex items-center gap-1.5 text-foreground font-heading font-black text-xs uppercase tracking-wider">
                  <UserCheck size={13} className="text-primary" />
                  <span>Detail Profile Lead</span>
                </div>
                {!canWriteLeads && (
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <LockKeyhole size={10} /> View Only
                  </span>
                )}
              </div>

              {/* Card 1: Identitas Pelanggan & Kontak */}
              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col gap-2.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <User size={11} className="text-primary" /> Kontak Pelanggan
                </span>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Nama Customer</label>
                  <div className="relative">
                    <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={customerNama}
                      onChange={(e) => setCustomerNama(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      disabled={!canWriteLeads}
                      placeholder="Nama pelanggan WA"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Nomor WhatsApp</label>
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-muted/50 border border-border/80">
                    <div className="flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-500 shrink-0" />
                      <span className="font-semibold text-sm text-foreground">{leadData.customerHp}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(leadData.customerHp);
                        showToast('Nomor WA berhasil disalin', 'success');
                      }}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                      title="Salin Nomor HP"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Status Pipeline & Sumber Referral */}
              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col gap-2.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Share2 size={11} className="text-primary" /> Status Pipeline & Channel
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-foreground">Status Lead</label>
                    <select
                      value={localLead.status_lead}
                      onChange={(e) => handleChange('status_lead', e.target.value)}
                      disabled={!canWriteLeads}
                      className="w-full px-2 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-bold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="NEW">NEW</option>
                      <option value="QUALIFIED">QUALIFIED</option>
                      <option value="PROSPECT">PROSPECT</option>
                      <option value="HOT">HOT</option>
                      <option value="CLOSED WON">CLOSED WON</option>
                      <option value="CLOSED LOST">CLOSED LOST</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-foreground">Referral Source</label>
                    <select
                      value={localLead.referral_source}
                      onChange={(e) => handleChange('referral_source', e.target.value)}
                      disabled={!canWriteLeads}
                      className="w-full px-2 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed capitalize"
                    >
                      <option value="tidak diketahui">Tidak Diketahui</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="website">Website</option>
                      <option value="rekomendasi">Rekomendasi</option>
                      <option value="facebook">Facebook</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 3: Detail Perjalanan & Anggaran */}
              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col gap-2.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <MapPin size={11} className="text-primary" /> Detail Trip & Estimasi Order
                </span>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Destinasi Wisata</label>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary" />
                    <input
                      type="text"
                      value={localLead.minat_destinasi || ''}
                      onChange={(e) => handleChange('minat_destinasi', e.target.value)}
                      placeholder="e.g. Kawah Ijen, Baluran"
                      disabled={!canWriteLeads}
                      className="w-full pl-8 pr-2.5 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-foreground">Peserta (Pax)</label>
                    <div className="relative">
                      <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-500" />
                      <input
                        type="number"
                        value={localLead.jumlah_peserta || ''}
                        onChange={(e) => handleChange('jumlah_peserta', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Pax"
                        disabled={!canWriteLeads}
                        className="w-full pl-8 pr-2 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-foreground">Tanggal Trip</label>
                    <div className="relative">
                      <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500" />
                      <input
                        type="date"
                        value={localLead.estimasi_waktu ? localLead.estimasi_waktu.split('T')[0] : ''}
                        onChange={(e) => handleChange('estimasi_waktu', e.target.value || null)}
                        disabled={!canWriteLeads}
                        className="w-full pl-8 pr-1 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Estimasi Nilai Order (Rp)</label>
                    {localLead.estimasi_nilai_order ? (
                      <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                        Rp {localLead.estimasi_nilai_order.toLocaleString('id-ID')}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <BadgePercent size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input
                      type="number"
                      value={localLead.estimasi_nilai_order || ''}
                      onChange={(e) => handleChange('estimasi_nilai_order', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="Nominal transaksi"
                      disabled={!canWriteLeads}
                      className="w-full pl-8 pr-2.5 py-2 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Catatan */}
              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col gap-2.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <MessageSquare size={11} className="text-primary" /> Catatan
                </span>
                <textarea
                  value={localLead.catatan_khusus || ''}
                  onChange={(e) => handleChange('catatan_khusus', e.target.value)}
                  placeholder="Detail pesanan, rincian itinerary, dll..."
                  rows={3}
                  disabled={!canWriteLeads}
                  className="w-full p-2.5 border border-border/80 rounded-lg bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary resize-none disabled:opacity-75 disabled:cursor-not-allowed leading-relaxed"
                />
              </div>

              {/* Card 5: AI Insights & System Alerts */}
              {localLead.ai_summary && (
                <div className="p-3 rounded-xl border border-violet-500/30 bg-violet-500/5 dark:bg-violet-500/[0.03] shadow-2xs flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                    <Sparkles size={14} className="animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-wider font-heading">AI Conversation Insights</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                    {localLead.ai_summary}
                  </p>
                </div>
              )}

              {localLead.catatan_sistem && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 shadow-2xs flex items-start gap-2 text-rose-500">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider">System Alert</span>
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      {localLead.catatan_sistem}
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Sticky Save Button Bar */}
            {canWriteLeads && (
              <div className="pt-2 mt-3 pb-1 md:pt-4 md:mt-6 border-t border-border/80 sticky bottom-0 bg-background/95 backdrop-blur-md z-10">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className={`w-full py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10 md:h-11 ${
                    saveSuccess 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check size={15} /> Detail Berhasil Disimpan!
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Simpan Perubahan Profile
                    </>
                  )}
                </button>
              </div>
            )}

            {!canWriteLeads && (
              <div className="pt-4 mt-6 border-t border-border/60 text-center">
                <span className="text-xs text-muted-foreground font-semibold italic flex items-center justify-center gap-1.5 bg-muted py-2 px-3 rounded-xl border border-border/40">
                  <LockKeyhole size={13} className="text-muted-foreground/60" /> Read-Only Mode (Locked)
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Chat History */}
          <div className={`flex-1 p-3 md:p-6 overflow-hidden flex flex-col bg-muted/20 ${
            activeSubTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}>
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-muted-foreground" />
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  WhatsApp Conversation Logs
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {canWriteLeads && (
                  <button
                    onClick={() => setIsManualChatOpen(true)}
                    className="px-2.5 py-1 bg-violet-600/10 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white transition-all text-xs font-bold rounded-lg border border-violet-500/20 cursor-pointer flex items-center gap-1 select-none"
                  >
                    <Brain size={12} /> Sisipkan Chat
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground font-bold px-2 py-0.5 rounded-md bg-secondary border border-border">
                  {activeChatMessages.length} Messages
                </span>
              </div>
            </div>

            {isLoadingMessages ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
                <span className="text-xs text-muted-foreground font-semibold">Loading conversation thread...</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden gap-2">
                <VirtualChatList messages={activeChatMessages} onReplyMessage={handleReplyToBubble} />

                {/* Quick Interactive WhatsApp Chat & Quoted Reply Bar */}
                {canWriteLeads && (
                  <form onSubmit={handleSendQuickMessage} className="shrink-0 flex flex-col gap-1.5 pt-2 border-t border-border/60 bg-background/50 rounded-2xl p-2 md:p-3">
                    {/* Quoted Reply Preview Bar */}
                    {replyingToMessage && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/90 border-l-4 border-teal-500 rounded-xl text-xs shadow-2xs animate-scale-up">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-[10px] text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1">
                            <Reply size={11} /> Membalas {replyingToMessage.pengirim === 'admin' ? 'Admin' : 'Customer'}
                          </span>
                          <span className="text-muted-foreground line-clamp-1 text-xs italic">
                            "{replyingToMessage.pesan}"
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingToMessage(null)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                          title="Batal Balas"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Sender Label & Text Input */}
                    <div className="flex items-center gap-2 w-full">
                      {/* Text Input Field */}
                      <input
                        type="text"
                        value={quickText}
                        onChange={(e) => setQuickText(e.target.value)}
                        placeholder={replyingToMessage ? 'Ketik balasan WA...' : 'Ketik pesan balasan WA...'}
                        className="flex-1 min-w-0 px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-card text-foreground focus:outline-none focus:border-primary shadow-2xs"
                      />

                      {/* WhatsApp Send Button */}
                      <button
                        type="submit"
                        disabled={!quickText.trim() || isSendingQuickText}
                        className="px-3 sm:px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 h-9"
                      >
                        <Send size={13} />
                        <span className="whitespace-nowrap">Kirim WA</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Follow Up Modal */}
      {followUpModal && leadData && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl flex flex-col animate-scale-up text-foreground">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Phone size={16} />
                <span className="font-heading font-black text-sm uppercase tracking-wider">Follow Up via WhatsApp</span>
              </div>
              <button onClick={() => setFollowUpModal(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Customer info */}
            <div className="px-5 pt-4 pb-3">
              <div className="bg-muted/60 border border-border/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {(leadData.customerNama || 'WA').slice(0, 2)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-foreground truncate">{leadData.customerNama || 'Pelanggan WA'}</span>
                  <span className="text-xs text-muted-foreground font-mono">{leadData.customerHp}</span>
                </div>
              </div>
            </div>

            {/* Template selector */}
            <div className="px-5 pb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pilih Template Pesan</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {getFollowUpTemplates(
                  leadData.customerNama || '',
                  leadData.minat_destinasi || ''
                ).map((tpl, idx) => (
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

            {/* Preview / Edit */}
            <div className="px-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Preview &amp; Edit Pesan</span>
                <button
                  type="button"
                  onClick={() => {
                    const orig = getFollowUpTemplates(
                      leadData.customerNama || '',
                      leadData.minat_destinasi || ''
                    )[followUpTemplate]?.message || '';
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
                rows={6}
                className="w-full p-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs font-semibold text-foreground leading-relaxed resize-y focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Ketik atau edit pesan di sini..."
              />
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSendingWA}
                  onClick={() => setFollowUpModal(false)}
                  className="flex-1 py-2.5 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSendingWA}
                  onClick={handleSendFollowUp}
                  className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
                    const templates = getFollowUpTemplates(
                      leadData.customerNama || '',
                      leadData.minat_destinasi || ''
                    );
                    handleOpenWhatsApp(leadData.customerHp, editedMessage || templates[followUpTemplate]?.message || '');
                    setFollowUpModal(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-emerald-600 font-semibold underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ExternalLink size={12} /> Buka Web WA / App Manual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deep Analysis Modal */}
      {deepAnalysisModal && leadData && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl flex flex-col animate-scale-up text-foreground">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
              <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
                <Brain size={20} className="animate-pulse" />
                <span className="font-heading font-black text-sm uppercase tracking-wider">Deep AI Conversation Analysis</span>
              </div>
              <button 
                onClick={() => setDeepAnalysisModal(false)} 
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5">
              {isLoadingAnalysis ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl animate-ping" />
                    <Brain size={48} className="text-violet-600 dark:text-violet-400 animate-bounce relative" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-foreground block">AI sedang menganalisis percakapan...</span>
                    <span className="text-xs text-muted-foreground mt-1 block">Ini memerlukan waktu 5-15 detik untuk memindai seluruh histori chat.</span>
                  </div>
                </div>
              ) : analysisError ? (
                <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-500 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold uppercase tracking-wider">Analysis Failed</span>
                      <span className="text-xs mt-1 leading-relaxed font-semibold">{analysisError}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleDeepAnalyze}
                    className="self-start px-4 py-2 text-xs font-bold bg-rose-500 text-white rounded-xl shadow-md hover:bg-rose-600 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Analisis Ulang
                  </button>
                </div>
              ) : deepAnalysisData ? (
                <div className="flex flex-col gap-4 text-xs font-semibold leading-relaxed text-foreground">
                  
                  {/* Narrative grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Skor Kualitas */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-violet-500">
                        <Brain size={15} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Skor Kualitas Lead</span>
                      </div>
                      <p className="text-muted-foreground font-medium text-xs leading-normal">
                        {deepAnalysisData.skor_kualitas}
                      </p>
                    </div>

                    {/* Potensi Closing */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CheckCircle2 size={15} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Potensi Closing</span>
                      </div>
                      <p className="text-muted-foreground font-medium text-xs leading-normal">
                        {deepAnalysisData.potensi_closing}
                      </p>
                    </div>

                    {/* Budget Sensitivity */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-amber-500">
                        <BadgePercent size={15} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Budget Sensitivity</span>
                      </div>
                      <p className="text-muted-foreground font-medium text-xs leading-normal">
                        {deepAnalysisData.budget_sensitivity}
                      </p>
                    </div>

                    {/* Tipe Buyer */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-blue-500">
                        <Users size={15} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Tipe Buyer</span>
                      </div>
                      <p className="text-muted-foreground font-medium text-xs leading-normal">
                        {deepAnalysisData.tipe_buyer}
                      </p>
                    </div>

                  </div>

                  {/* Objection Utama */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-rose-500">
                      <AlertCircle size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Objection Utama</span>
                    </div>
                    <p className="text-muted-foreground font-medium text-xs leading-normal">
                      {deepAnalysisData.objection_utama}
                    </p>
                  </div>

                  {/* Kesalahan Saya */}
                  <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${
                    !deepAnalysisData.kesalahan_saya || deepAnalysisData.kesalahan_saya.toLowerCase().includes('tidak ada')
                      ? 'bg-muted/30 border-border/60'
                      : 'bg-amber-500/5 border-amber-500/20'
                  }`}>
                    <div className={`flex items-center gap-2 ${
                      !deepAnalysisData.kesalahan_saya || deepAnalysisData.kesalahan_saya.toLowerCase().includes('tidak ada')
                        ? 'text-muted-foreground'
                        : 'text-amber-500'
                    }`}>
                      <XCircle size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Evaluasi Chat Admin / Kesalahan Saya</span>
                    </div>
                    <p className="text-muted-foreground font-medium text-xs leading-normal">
                      {deepAnalysisData.kesalahan_saya}
                    </p>
                  </div>

                  {/* Saran Respon */}
                  <div className="p-5 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                      <Phone size={15} className="animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Saran Respon Selanjutnya</span>
                    </div>
                    <p className="text-foreground dark:text-gray-200 font-semibold text-xs leading-relaxed">
                      {deepAnalysisData.saran_respon}
                    </p>
                  </div>

                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                  <Brain size={48} className="text-muted-foreground/40" />
                  <div>
                    <span className="text-sm font-bold text-foreground block">Belum ada analisis mendalam</span>
                    <span className="text-xs text-muted-foreground mt-1 block">Silakan klik tombol di bawah untuk memulai analisis AI.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="border-t border-border p-5 bg-muted/10 flex items-center justify-end gap-2.5 shrink-0">
              <button
                onClick={() => setDeepAnalysisModal(false)}
                className="px-4.5 py-2.5 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer bg-card"
              >
                Tutup
              </button>
              
              {deepAnalysisData && !isLoadingAnalysis && (
                <>
                  <button
                    onClick={handleCopyAnalysis}
                    className="px-4.5 py-2.5 bg-muted border border-border hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Copy size={13} /> Salin Hasil
                  </button>

                  <button
                    onClick={handleDeepAnalyze}
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Analisis Ulang
                  </button>
                </>
              )}

              {!deepAnalysisData && !isLoadingAnalysis && (
                <button
                  onClick={handleDeepAnalyze}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Brain size={13} /> Mulai Analisis
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up text-foreground">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertCircle size={24} className="shrink-0" />
              <span className="font-heading font-black text-base">
                {confirmModal.title}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
              {confirmModal.message}
            </p>
            <div className="flex items-center gap-3 mt-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-border hover:bg-muted font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer bg-card text-foreground"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-5 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md hover:bg-rose-600 transition-all cursor-pointer"
              >
                Ya, Abaikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Chat Insertion Modal */}
      {isManualChatOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up text-foreground">
            <div className="flex items-center gap-3 text-violet-600 dark:text-violet-400">
              <MessageSquare size={24} className="shrink-0" />
              <span className="font-heading font-black text-base">Sisipkan Chat Manual</span>
            </div>
            
            <div className="flex flex-col gap-3 text-xs font-semibold">
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground">Pengirim</label>
                <select
                  value={manualSender}
                  onChange={(e) => setManualSender(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-muted/30 text-foreground focus:outline-none focus:border-primary font-semibold"
                >
                  <option value="customer">Customer (Kiri)</option>
                  <option value="admin">Admin / CS (Kanan)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground">Waktu Kirim (Opsional)</label>
                <input
                  type="datetime-local"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-muted/30 text-foreground focus:outline-none focus:border-primary font-semibold"
                />
                <span className="text-[10px] text-muted-foreground italic font-normal">Kosongkan jika ingin diset ke waktu sekarang.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground">Pesan</label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Ketik isi chat penting yang terlewat di sini..."
                  rows={4}
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-muted/30 text-foreground focus:outline-none focus:border-primary resize-none font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 justify-end">
              <button
                onClick={() => { setIsManualChatOpen(false); setManualText(''); setManualTime(''); }}
                className="px-4 py-2 border border-border hover:bg-muted font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer bg-card text-foreground"
              >
                Batal
              </button>
              <button
                onClick={handleSaveManualChat}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer"
              >
                Simpan Pesan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast?.isOpen && (
        <div className={`fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 z-[200] flex items-center justify-center md:justify-start gap-2.5 px-4.5 py-3 rounded-2xl border shadow-xl backdrop-blur-md animate-slide-up md:animate-slide-in-right ${
          toast.type === 'success'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <XCircle size={16} className="shrink-0" />
          )}
          <span className="text-xs font-bold font-heading">{toast.message}</span>
        </div>
      )}
    </>
  );
};

const SparklesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
);
