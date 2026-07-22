import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, UserCheck, MessageSquare, Compass, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle, Plus, Edit, Trash2, X } from 'lucide-react';
import { Lead } from '../types';

export const Customers: React.FC = () => {
  const { 
    customers, 
    ignoredCustomers, 
    fetchCustomers, 
    fetchIgnoredCustomers, 
    createCustomer,
    updateCustomer, 
    deleteCustomer,
    user 
  } = useStore();

  // Create Customer Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // Edit Customer Form State
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editMsg, setEditMsg] = useState<string | null>(null);
  
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

  const handleCreateCustomer = async () => {
    if (!createPhone) {
      setCreateMsg('Nomor WhatsApp wajib diisi.');
      return;
    }
    setCreateMsg(null);
    const success = await createCustomer({ nama_kontak: createName, nomor_hp: createPhone });
    if (success) {
      setIsCreateOpen(false);
      showToast('Pelanggan baru berhasil ditambahkan.', 'success');
    } else {
      setCreateMsg('Gagal menambahkan pelanggan. Pastikan nomor WhatsApp unik.');
    }
  };

  const handleEditCustomer = async () => {
    if (!editPhone) {
      setEditMsg('Nomor WhatsApp wajib diisi.');
      return;
    }
    setEditMsg(null);
    const success = await updateCustomer(editingCustomer.id, { nama_kontak: editName, nomor_hp: editPhone });
    if (success) {
      setEditingCustomer(null);
      showToast('Data pelanggan berhasil diperbarui.', 'success');
    } else {
      setEditMsg('Gagal memperbarui data. Pastikan nomor WhatsApp unik.');
    }
  };

  const handleDeleteCustomer = (id: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Pelanggan Permanen?',
      message: `Apakah Anda yakin ingin menghapus pelanggan "${name}" secara permanen? PENTING: Menghapus pelanggan akan menghapus seluruh data prospek (leads) dan histori chat WhatsApp terkait dari database. Tindakan ini TIDAK DAPAT dibatalkan.`,
      confirmText: 'Ya, Hapus',
      confirmColor: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        const success = await deleteCustomer(id);
        if (success) {
          showToast('Pelanggan berhasil dihapus.', 'success');
        } else {
          showToast('Gagal menghapus pelanggan.', 'error');
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

  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
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
          Daftar Kontak
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Direktori data pelanggan, riwayat pemesanan berulang, serta total nilai transaksi yang tercatat.
        </p>
      </div>

      {/* Search and Stats bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-4 border border-border/80 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama atau nomor HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary h-10"
            />
          </div>

          {/* Buttons container: full-width column on mobile, row on sm+ */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            {canWrite && (
              <button
                onClick={() => {
                  setCreateName('');
                  setCreatePhone('');
                  setCreateMsg(null);
                  setIsCreateOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer h-10 select-none"
              >
                <Plus size={14} /> Tambah Pelanggan
              </button>
            )}

            <button
              onClick={() => setShowIgnored(!showIgnored)}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer h-10 select-none ${
                showIgnored 
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:bg-rose-500/20' 
                  : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
              }`}
            >
              {showIgnored ? (
                <>
                  <EyeOff size={14} /> Kontak Diabaikan
                </>
              ) : (
                <>
                  <Eye size={14} /> Tampilkan Kontak Diabaikan
                </>
              )}
            </button>
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider shrink-0 lg:text-right mt-1 lg:mt-0">
          {showIgnored ? 'Kontak Diabaikan: ' : 'Total Kontak Aktif: '}
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
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                          <Search size={20} className="text-muted-foreground/60" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-foreground">Tidak ada kontak yang cocok</span>
                          <span className="text-xs text-muted-foreground">Coba ubah kata kunci pencarian.</span>
                        </div>
                      </div>
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
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(client.lastStatus)}`}>
                              {client.lastStatus}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                            Rp {client.totalRevenue.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-3.5">
                              {/* Edit & Delete Action Buttons */}
                              {canWrite && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditName(client.nama_kontak || '');
                                      setEditPhone(client.nomor_hp);
                                      setEditMsg(null);
                                      setEditingCustomer(client);
                                    }}
                                    className="p-2 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                                    title="Edit data pelanggan"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCustomer(client.id, displayName)}
                                    className="p-2 border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all cursor-pointer"
                                    title="Hapus pelanggan"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-1.5 border-l border-border pl-3.5">
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
                                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-4 px-6 bg-card">
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground font-semibold">
                Menampilkan <strong className="text-foreground">{totalItems > 0 ? startIndex + 1 : 0}</strong>–<strong className="text-foreground">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> dari <strong className="text-foreground">{totalItems}</strong> kontak
              </span>
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Tampil:</span>
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
                  className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                {getPageNumbers().map((p, i) => {
                  const isEllipsis = p === '...';
                  const isCurrent = currentPage === p;
                  return isEllipsis ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-xs text-muted-foreground font-bold">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${
                        isCurrent 
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Card List */}
        <div className="md:hidden flex flex-col gap-3">
          {paginatedCustomers.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border/80 rounded-2xl shadow-sm flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Search size={20} className="text-muted-foreground/60" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-foreground">Tidak ada kontak yang cocok</span>
                <span className="text-xs text-muted-foreground">Coba ubah kata kunci pencarian.</span>
              </div>
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
                    <div className="flex items-center gap-2.5 shrink-0">
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

                  {/* Touch-friendly mobile action row at the bottom of the card */}
                  {canWrite && (
                    <div className="flex items-center justify-between border-t border-border/50 pt-2.5 mt-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {isActive ? 'Aktif' : 'Spam'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleIgnore(client.id, displayName, isActive)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditName(client.nama_kontak || '');
                            setEditPhone(client.nomor_hp);
                            setEditMsg(null);
                            setEditingCustomer(client);
                          }}
                          className="px-3.5 py-1.5 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1 h-8 select-none"
                        >
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(client.id, displayName)}
                          className="px-3.5 py-1.5 border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1 h-8 select-none"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </div>
                  )}

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
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
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
                <strong className="text-foreground">{totalItems > 0 ? startIndex + 1 : 0}</strong>–{Math.min(startIndex + itemsPerPage, totalItems)} dari {totalItems}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-bold">Tampil:</span>
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
              <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                {getPageNumbers().map((p, i) => {
                  const isEllipsis = p === '...';
                  const isCurrent = currentPage === p;
                  return isEllipsis ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-xs text-muted-foreground font-bold">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${
                        isCurrent 
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="h-8 w-8 flex items-center justify-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Customer Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border/85 pb-2.5">
              <span className="font-heading font-black text-sm text-foreground flex items-center gap-2">
                <Plus size={16} className="text-primary" /> Tambah Pelanggan Baru
              </span>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            
            {createMsg && (
              <div className="p-2.5 rounded-lg text-[11px] bg-rose-500/10 text-rose-500 border border-rose-500/20 font-semibold leading-relaxed">
                {createMsg}
              </div>
            )}

            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nama Kontak</label>
                <input
                  type="text"
                  placeholder="Masukkan nama pelanggan..."
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nomor WhatsApp</label>
                <input
                  type="text"
                  placeholder="Contoh: 628123456789"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 mt-2 justify-end">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleCreateCustomer}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border/85 pb-2.5">
              <span className="font-heading font-black text-sm text-foreground flex items-center gap-2">
                <Edit size={14} className="text-primary" /> Edit Data Pelanggan
              </span>
              <button onClick={() => setEditingCustomer(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            
            {editMsg && (
              <div className="p-2.5 rounded-lg text-[11px] bg-rose-500/10 text-rose-500 border border-rose-500/20 font-semibold leading-relaxed">
                {editMsg}
              </div>
            )}

            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nama Kontak</label>
                <input
                  type="text"
                  placeholder="Masukkan nama pelanggan..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nomor WhatsApp</label>
                <input
                  type="text"
                  placeholder="Contoh: 628123456789"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 mt-2 justify-end">
              <button
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleEditCustomer}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
};
