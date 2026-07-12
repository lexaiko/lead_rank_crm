import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, UserCheck, MessageSquare, Compass, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { Lead } from '../types';

export const Customers: React.FC = () => {
  const { 
    customers, 
    ignoredCustomers, 
    fetchCustomers, 
    fetchIgnoredCustomers, 
    updateCustomer, 
    user 
  } = useStore();
  
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmColor: string;
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canWrite = user?.permissions?.leads === 'write' || user?.permissions?.customers === 'write';

  useEffect(() => {
    if (showIgnored) {
      fetchIgnoredCustomers();
    } else {
      fetchCustomers();
    }
  }, [showIgnored]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleToggleIgnore = (id: number, name: string, isIgnore: boolean) => {
    const actionLabel = isIgnore ? 'Abaikan' : 'Pulihkan';
    const explanation = isIgnore 
      ? `Apakah Anda yakin ingin mengabaikan kontak "${name || 'Pelanggan WA'}"? Kontak ini akan disembunyikan dari seluruh statistik dashboard, laporan konversi, dan pesan baru dari mereka tidak akan diproses oleh CRM.`
      : `Apakah Anda yakin ingin memulihkan kontak "${name || 'Pelanggan WA'}"? Kontak ini akan dikembalikan ke status customer aktif di CRM.`;

    setConfirmModal({
      isOpen: true,
      title: `${actionLabel} Kontak?`,
      message: explanation,
      confirmText: isIgnore ? 'Ya, Abaikan' : 'Ya, Pulihkan',
      confirmColor: isIgnore ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600',
      onConfirm: async () => {
        const success = await updateCustomer(id, { is_ignored: isIgnore });
        if (success) {
          showToast(`Kontak berhasil di${isIgnore ? 'abaikan' : 'pulihkan'}.`, 'success');
        } else {
          showToast(`Gagal ${isIgnore ? 'mengabaikan' : 'memulihkan'} kontak.`, 'error');
        }
      }
    });
  };

  const activeCustomersList = showIgnored ? ignoredCustomers : customers;

  const filtered = activeCustomersList.filter(c => {
    return (c.nama_kontak || 'Pelanggan WA').toLowerCase().includes(search.toLowerCase()) || c.nomor_hp.includes(search);
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filtered.slice(startIndex, startIndex + itemsPerPage);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-500/10 text-slate-500';
      case 'PROSPECT': return 'bg-blue-500/10 text-blue-500';
      case 'QUALIFIED': return 'bg-cyan-500/10 text-cyan-500';
      case 'HOT': return 'bg-orange-500/10 text-orange-500';
      case 'CLOSED WON': return 'bg-emerald-500/10 text-emerald-500';
      case 'CLOSED LOST': return 'bg-rose-500/10 text-rose-500';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
          Customers Directory
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Customer statistics, repeat inquiries history tracker, and total transaction values.
        </p>
      </div>

      {/* Search and Stats bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 border border-border/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customer name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              showIgnored 
                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:bg-rose-500/20' 
                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
            }`}
          >
            {showIgnored ? (
              <>
                <EyeOff size={13} /> Kontak Diabaikan (Spam)
              </>
            ) : (
              <>
                <Eye size={13} /> Tampilkan Kontak Diabaikan
              </>
            )}
          </button>
        </div>
        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider shrink-0">
          {showIgnored ? 'Kontak Diabaikan: ' : 'Registered Clients: '}
          <strong className="text-foreground">{activeCustomersList.length}</strong>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Desktop Table View */}
        <div className="hidden md:block bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="w-10 px-5 py-4"></th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client Name</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp Number</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Leads Register</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Latest Inquiries Status</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Transaction (WON)</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No customers found matching search queries.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((client) => {
                    const isExpanded = expandedId === client.id;
                    const displayName = client.nama_kontak || 'Pelanggan WA';
                    const isActive = !showIgnored;
                    return (
                      <React.Fragment key={client.id}>
                        <tr 
                          onClick={() => toggleExpand(client.id)}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4 text-center">
                            {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs uppercase">
                                {displayName.slice(0, 2)}
                              </div>
                              <span className="font-bold text-sm text-foreground">{displayName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-muted-foreground font-mono">{client.nomor_hp}</td>
                          <td className="px-5 py-4 text-sm font-bold text-center">
                            <span className="bg-secondary/60 border border-border px-2.5 py-0.5 rounded-full font-mono text-xs">
                              {client.leadsCount}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(client.lastStatus)}`}>
                              {client.lastStatus}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                            Rp {client.totalRevenue.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-bold text-muted-foreground">
                                {isActive ? 'Aktif' : 'Spam'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleIgnore(client.id, displayName, isActive)}
                                disabled={!canWrite}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                                } ${!canWrite && 'opacity-55 cursor-not-allowed'}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    isActive ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Lead History Drawer */}
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={7} className="p-6">
                              <div className="flex flex-col gap-4">
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/80 pb-2">
                                  Historical Leads Details for {displayName}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {client.leads.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">No leads register.</span>
                                  ) : (
                                    client.leads.map((lead: Lead) => (
                                      <div 
                                        key={lead.id}
                                        className="p-4 bg-card border border-border rounded-xl flex flex-col gap-2.5 shadow-sm"
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="font-bold text-sm text-primary font-mono">{lead.kode_lead}</span>
                                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                                            {lead.status_lead}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-muted-foreground">
                                          <div className="flex items-center gap-1.5">
                                            <Compass size={12} className="text-muted-foreground/80" />
                                            <span className="text-foreground">{lead.minat_destinasi || '-'}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 justify-end">
                                            <Calendar size={12} className="text-muted-foreground/80" />
                                            <span className="text-foreground font-mono">{lead.estimasi_waktu ? lead.estimasi_waktu.split('T')[0] : '-'}</span>
                                          </div>
                                          <div className="text-left">
                                            Total Pax: <strong className="text-foreground">{lead.jumlah_peserta || '-'}</strong>
                                          </div>
                                          <div className="text-right text-orange-600 dark:text-orange-400 font-bold">
                                            {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : '-'}
                                          </div>
                                        </div>

                                        {lead.catatan_khusus && (
                                          <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2 leading-relaxed">
                                            {lead.catatan_khusus}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
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

        {/* Mobile View Card List */}
        <div className="block md:hidden flex flex-col gap-3">
          {paginatedCustomers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border/80 rounded-2xl shadow-sm">
              No customers found matching search queries.
            </div>
          ) : (
            paginatedCustomers.map((client) => {
              const isExpanded = expandedId === client.id;
              const displayName = client.nama_kontak || 'Pelanggan WA';
              const isActive = !showIgnored;
              return (
                <div key={client.id} className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-3">
                  <div 
                    onClick={() => toggleExpand(client.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {displayName.slice(0, 2)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-foreground truncate">{displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{client.nomor_hp}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 mr-1">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {isActive ? 'Aktif' : 'Spam'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleIgnore(client.id, displayName, isActive)}
                          disabled={!canWrite}
                          className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          } ${!canWrite && 'opacity-55 cursor-not-allowed'}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-3.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                          Rp {client.totalRevenue.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {client.leadsCount} Inquiries
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expandable Lead History Drawer for Mobile */}
                  {isExpanded && (
                    <div className="mt-2 pl-2 border-l-2 border-primary/40 flex flex-col gap-3">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Inquiries History
                      </div>
                      {client.leads.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No leads register.</span>
                      ) : (
                        client.leads.map((lead: Lead) => (
                          <div 
                            key={lead.id}
                            className="p-3 bg-muted/20 border border-border/60 rounded-xl flex flex-col gap-2"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-primary font-mono">{lead.kode_lead}</span>
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                                {lead.status_lead}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-muted-foreground">
                              <div>Destinasi: <span className="text-foreground">{lead.minat_destinasi || '-'}</span></div>
                              <div className="text-right">Pax: <span className="text-foreground">{lead.jumlah_peserta || '-'}</span></div>
                              <div>Trip: <span className="text-foreground font-mono">{lead.estimasi_waktu ? lead.estimasi_waktu.split('T')[0] : '-'}</span></div>
                              <div className="text-right text-orange-600 dark:text-orange-400 font-bold">
                                {lead.estimasi_nilai_order ? `Rp ${lead.estimasi_nilai_order.toLocaleString('id-ID')}` : '-'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
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

      {/* Custom Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center gap-3 text-orange-500">
              <AlertCircle size={24} className="shrink-0" />
              <span className="font-heading font-black text-base text-foreground">
                {confirmModal.title}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
              {confirmModal.message}
            </p>
            <div className="flex items-center gap-3 mt-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmText}
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

    </div>
  );
};
