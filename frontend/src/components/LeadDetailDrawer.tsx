import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Calendar, Users, MapPin, BadgePercent, MessageSquare, AlertCircle, Save, Check, LockKeyhole, CheckCircle2, XCircle } from 'lucide-react';
import { VirtualChatList } from './VirtualChatList';
import { Lead } from '../types';

export const LeadDetailDrawer: React.FC = () => {
  const { 
    selectedLeadId, 
    setSelectedLeadId, 
    dashboardData,
    leads,
    activeChatMessages, 
    fetchMessages, 
    updateLead,
    updateCustomer,
    isLoading,
    isLoadingMessages,
    user
  } = useStore();

  const [localLead, setLocalLead] = useState<Lead | null>(null);
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

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const canWriteLeads = user?.permissions?.leads === 'write';
  const canIgnore = user?.permissions?.leads === 'write' || user?.permissions?.customers === 'write';

  // Find selected lead from paginated leads list
  const leadData = leads.find(l => l.id === selectedLeadId);

  // Fetch messages when drawer opens or lead changes
  useEffect(() => {
    if (selectedLeadId) {
      fetchMessages(selectedLeadId);
    }
  }, [selectedLeadId]);

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
    } else {
      setLocalLead(null);
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
    });
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
        <div className="flex items-center justify-between border-b border-border py-4 px-6 bg-card text-foreground">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="font-heading font-black text-lg tracking-tight text-primary">
                {localLead.kode_lead}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadgeClass(localLead.status_lead)}`}>
                {localLead.status_lead}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium mt-0.5">
              Managed by <strong className="text-foreground">{leadData.adminNama}</strong>
            </span>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {canIgnore && (
              <button
                type="button"
                onClick={handleIgnoreContact}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <AlertCircle size={13} /> Abaikan Kontak
              </button>
            )}
            
            <button 
              onClick={() => setSelectedLeadId(null)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sub-tabs for mobile view */}
        <div className="md:hidden flex border-b border-border bg-card shrink-0">
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`flex-1 py-3.5 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeSubTab === 'profile'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Lead Profile
          </button>
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`flex-1 py-3.5 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeSubTab === 'chat'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            WhatsApp Chat
          </button>
        </div>

        {/* Drawer Content Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Column: Lead Info Form */}
          <div className={`w-full md:w-[45%] border-b md:border-b-0 md:border-r border-border p-6 overflow-y-auto flex flex-col justify-between ${
            activeSubTab === 'profile' ? 'flex' : 'hidden md:flex'
          }`}>
            <div className="flex flex-col gap-5">
              <div className="border-b border-border pb-3">
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Lead Information
                </h3>
              </div>

              {/* Customer Info Card */}
              <div className="bg-muted/50 border border-border/80 p-4 rounded-xl flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Customer Contact</span>
                <span className="font-bold text-sm text-foreground">
                  {leadData.customerNama || 'Pelanggan WA'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{leadData.customerHp}</span>
              </div>

              {/* Edit Fields Form */}
              <div className="flex flex-col gap-4">
                
                {/* Status Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                  <select
                    value={localLead.status_lead}
                    onChange={(e) => handleChange('status_lead', e.target.value)}
                    disabled={!canWriteLeads}
                    className="w-full px-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="NEW">NEW</option>
                    <option value="PROSPECT">PROSPECT</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="HOT">HOT</option>
                    <option value="CLOSED WON">CLOSED WON</option>
                    <option value="CLOSED LOST">CLOSED LOST</option>
                  </select>
                </div>

                {/* Destinations */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Destinations interest</label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      value={localLead.minat_destinasi || ''}
                      onChange={(e) => handleChange('minat_destinasi', e.target.value)}
                      placeholder="e.g. Ijen, Baluran, Djawatan"
                      disabled={!canWriteLeads}
                      className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Pax & Date Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Participants</label>
                    <div className="relative">
                      <Users size={15} className="absolute left-3 top-3 text-muted-foreground" />
                      <input
                        type="number"
                        value={localLead.jumlah_peserta || ''}
                        onChange={(e) => handleChange('jumlah_peserta', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Pax"
                        disabled={!canWriteLeads}
                        className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trip Date</label>
                    <div className="relative">
                      <Calendar size={15} className="absolute left-3 top-3 text-muted-foreground" />
                      <input
                        type="date"
                        value={localLead.estimasi_waktu ? localLead.estimasi_waktu.split('T')[0] : ''}
                        onChange={(e) => handleChange('estimasi_waktu', e.target.value || null)}
                        disabled={!canWriteLeads}
                        className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Estimate Value & Referral Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Order Value (Rp)</label>
                    <div className="relative">
                      <BadgePercent size={15} className="absolute left-3 top-3 text-muted-foreground" />
                      <input
                        type="number"
                        value={localLead.estimasi_nilai_order || ''}
                        onChange={(e) => handleChange('estimasi_nilai_order', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Price"
                        disabled={!canWriteLeads}
                        className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referral Source</label>
                    <select
                      value={localLead.referral_source}
                      onChange={(e) => handleChange('referral_source', e.target.value)}
                      disabled={!canWriteLeads}
                      className="w-full px-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
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

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Special Notes</label>
                  <textarea
                    value={localLead.catatan_khusus || ''}
                    onChange={(e) => handleChange('catatan_khusus', e.target.value)}
                    placeholder="Enter itinerary details, food requirements, pick-up address, etc."
                    rows={3}
                    disabled={!canWriteLeads}
                    className="w-full px-3 py-2 border border-border/80 rounded-xl bg-card text-foreground text-sm font-semibold focus:outline-none focus:border-primary resize-none disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                {/* AI Summary Card (If analyzed) */}
                {localLead.ai_summary && (
                  <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/[0.02]">
                    <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                      <SparklesIcon />
                      <span className="text-xs font-bold uppercase tracking-wider">Premium AI Insights</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {localLead.ai_summary}
                    </p>
                  </div>
                )}

                {/* System Alerts */}
                {localLead.catatan_sistem && (
                  <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex gap-2 text-rose-500">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-wider">System Alert</span>
                      <span className="text-xs mt-1 text-rose-600 dark:text-rose-400 font-medium">
                        {localLead.catatan_sistem}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Save Button */}
            {canWriteLeads && (
              <div className="pt-6 mt-6 border-t border-border">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all ${
                    saveSuccess 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check size={16} /> Saved Successfully
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Profiles Details
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleIgnoreContact}
                  disabled={isLoading}
                  className="w-full mt-3 py-2.5 rounded-xl font-bold text-xs bg-muted text-muted-foreground border border-border/80 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertCircle size={14} /> Abaikan Kontak (Spam / Bukan Customer)
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
          <div className={`flex-1 p-6 overflow-hidden flex flex-col bg-muted/20 ${
            activeSubTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}>
            <div className="flex items-center gap-2 mb-4 border-b border-border pb-3 shrink-0">
              <MessageSquare size={16} className="text-muted-foreground" />
              <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-muted-foreground">
                WhatsApp Conversation Logs
              </h3>
              <span className="ml-auto text-[10px] text-muted-foreground font-bold px-2 py-0.5 rounded-md bg-secondary border border-border">
                {activeChatMessages.length} Messages
              </span>
            </div>

            {isLoadingMessages ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
                <span className="text-xs text-muted-foreground font-semibold">Loading conversation thread...</span>
              </div>
            ) : (
              <VirtualChatList messages={activeChatMessages} />
            )}
          </div>

        </div>

      </div>

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

      {/* Floating Toast Notification */}
      {toast?.isOpen && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4.5 py-3 rounded-2xl border shadow-xl backdrop-blur-md animate-slide-in-right ${
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
