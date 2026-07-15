import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Bot, RefreshCw, AlertCircle, Play, CheckCircle2, Loader2, Calendar, ChevronLeft, ChevronRight, Plus, Edit, Trash2, X, XCircle } from 'lucide-react';

const CountdownTimer: React.FC<{ targetDateStr: string | null; status: string }> = ({ targetDateStr, status }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!targetDateStr || status !== 'WAITING') {
      setTimeLeft('-');
      return;
    }

    const targetDate = new Date(targetDateStr);
    
    const updateTimer = () => {
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('Ready');
        return;
      }

      const totalSecs = Math.floor(diffMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;

      setTimeLeft(`${mins}m ${secs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr, status]);

  if (!targetDateStr || status !== 'WAITING') return <span className="text-muted-foreground">-</span>;

  const isReady = timeLeft === 'Ready';
  return (
    <span className={`font-mono text-[10px] font-bold ${isReady ? 'text-amber-500 animate-pulse' : 'text-primary'}`}>
      {isReady ? 'Antre' : timeLeft}
    </span>
  );
};

export const AIQueue: React.FC = () => {
  const { 
    aiQueue, 
    fetchAIQueue, 
    triggerAIWorker, 
    triggerSweeper, 
    isLoading,
    user,
    leads,
    fetchLeads,
    createAIJob,
    updateAIJob,
    deleteAIJob
  } = useStore();

  const [runningAI, setRunningAI] = useState(false);
  const [runningSweeper, setRunningSweeper] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const canWrite = user?.permissions?.queue === 'write';

  // Create Job Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // Edit Job Modal State
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>('WAITING');
  const [editRetryCount, setEditRetryCount] = useState<number>(0);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  // Confirm and Toast Notifications
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

  const totalItems = aiQueue.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedQueue = aiQueue.slice(startIndex, startIndex + itemsPerPage);

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

  // Auto-refresh queue every 5 seconds
  useEffect(() => {
    fetchAIQueue();
    const interval = setInterval(() => {
      fetchAIQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isCreateOpen) {
      fetchLeads({ limit: 100 });
    }
  }, [isCreateOpen]);

  const handleCreateJob = async () => {
    if (!selectedLeadId) {
      setCreateMsg('Silakan pilih atau masukkan Lead ID.');
      return;
    }
    setCreateMsg(null);
    const success = await createAIJob(parseInt(selectedLeadId));
    if (success) {
      setIsCreateOpen(false);
      showToast('Pekerjaan AI berhasil ditambahkan ke antrean.', 'success');
    } else {
      setCreateMsg('Gagal menambahkan pekerjaan ke antrean AI.');
    }
  };

  const handleEditJob = async () => {
    if (!editStatus) {
      setEditMsg('Status wajib dipilih.');
      return;
    }
    setEditMsg(null);
    const success = await updateAIJob(editingJob.id, { status: editStatus, retry_count: editRetryCount });
    if (success) {
      setEditingJob(null);
      showToast('Status antrean AI berhasil diperbarui.', 'success');
    } else {
      setEditMsg('Gagal memperbarui status antrean.');
    }
  };

  const handleDeleteJob = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus dari Antrean AI?',
      message: `Apakah Anda yakin ingin menghapus pekerjaan AI ini dari antrean? Prospek terkait tidak akan diproses oleh AI Worker kecuali ditambahkan kembali secara manual.`,
      confirmText: 'Ya, Hapus',
      confirmColor: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        const success = await deleteAIJob(id);
        if (success) {
          showToast('Pekerjaan AI berhasil dihapus.', 'success');
        } else {
          showToast('Gagal menghapus pekerjaan AI.', 'error');
        }
      }
    });
  };

  const handleSweeper = async () => {
    setRunningSweeper(true);
    setAiMessage('Running Ghost Sweeper...');
    try {
      const msg = await triggerSweeper();
      setAiMessage(`Ghost Sweeper Finished: ${msg}`);
      setTimeout(() => setAiMessage(null), 4000);
    } catch (e) {
      setAiMessage('Ghost Sweeper failed');
      setTimeout(() => setAiMessage(null), 4000);
    } finally {
      setRunningSweeper(false);
    }
  };

  const handleAI = async () => {
    setRunningAI(true);
    setAiMessage('Requesting backend to analyze unprocessed chats...');
    try {
      const msg = await triggerAIWorker();
      setAiMessage(`AI Extraction Finished: ${msg}`);
      setTimeout(() => setAiMessage(null), 4000);
    } catch (e) {
      setAiMessage('AI processing failed');
      setTimeout(() => setAiMessage(null), 4000);
    } finally {
      setRunningAI(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
      case 'PROCESSING':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse';
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
            Monitor Antrean AI
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Pantau status antrean pemrosesan AI Gemini, limit percobaan ulang, dan penjadwalan analisis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canWrite && (
            <button
              onClick={() => {
                setSelectedLeadId('');
                setCreateMsg(null);
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer select-none"
            >
              <Plus size={13} />
              Tambah Antrean
            </button>
          )}
          <button
            onClick={() => fetchAIQueue()}
            className="flex items-center gap-2 px-3 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl shadow-sm hover:bg-muted/50 transition-all cursor-pointer select-none"
          >
            <RefreshCw size={13} className={isLoading && !runningAI && !runningSweeper ? 'animate-spin' : ''} />
            Refresh Queue
          </button>
          <button
            onClick={handleSweeper}
            disabled={runningSweeper || isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl shadow-sm hover:bg-muted/50 transition-all cursor-pointer select-none disabled:opacity-50"
          >
            <RefreshCw size={13} className={runningSweeper ? 'animate-spin' : ''} />
            Run Ghost Sweeper
          </button>
          <button
            onClick={handleAI}
            disabled={runningAI || isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer select-none"
          >
            {runningAI ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
            Run AI Extractor
          </button>
        </div>
      </div>

      {/* Trigger Notifications Banner */}
      {aiMessage && (
        <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center gap-2.5 animate-pulse">
          <Bot size={16} />
          {aiMessage}
        </div>
      )}

      {/* Queue Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border/80 rounded-xl flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Waiting</span>
            <span className="text-xl font-extrabold font-heading text-slate-500 mt-1">
              {aiQueue.filter(j => j.status === 'WAITING').length}
            </span>
          </div>
        </div>
        <div className="p-4 bg-card border border-border/80 rounded-xl flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Processing</span>
            <span className="text-xl font-extrabold font-heading text-blue-500 mt-1">
              {aiQueue.filter(j => j.status === 'PROCESSING').length}
            </span>
          </div>
        </div>
        <div className="p-4 bg-card border border-border/80 rounded-xl flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Done</span>
            <span className="text-xl font-extrabold font-heading text-emerald-500 mt-1">
              {aiQueue.filter(j => j.status === 'DONE').length}
            </span>
          </div>
        </div>
        <div className="p-4 bg-card border border-border/80 rounded-xl flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Failed</span>
            <span className="text-xl font-extrabold font-heading text-rose-500 mt-1">
              {aiQueue.filter(j => j.status === 'FAILED').length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Desktop View Table */}
        <div className="hidden md:block bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job ID</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Lead Code</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer Details</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PIC CS</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Execute At</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Retries</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Updated At</th>
                  {canWrite && <th className="px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm font-semibold">
                {paginatedQueue.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 9 : 8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No active background jobs present in the queue database.
                    </td>
                  </tr>
                ) : (
                  paginatedQueue.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 text-muted-foreground"># {job.id}</td>
                      <td className="px-5 py-4 text-primary font-mono font-bold">
                        {job.lead?.kode_lead || `Lead ID ${job.lead_id}`}
                      </td>
                      <td className="px-5 py-4">
                        {job.lead ? (
                          <div className="flex flex-col">
                            <span className="text-foreground font-bold">{job.lead.customerName}</span>
                            <span className="text-xs text-muted-foreground font-mono font-normal">{job.lead.customerHp}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-4 text-foreground">{job.lead?.adminName || '-'}</td>
                      <td className="px-5 py-4">
                        <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-normal text-muted-foreground">
                            {formatDate(job.execute_at)}
                          </span>
                          {job.status === 'WAITING' && job.execute_at && (
                            <div className="mt-1 flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground font-semibold">In:</span>
                              <CountdownTimer targetDateStr={job.execute_at} status={job.status} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-foreground">
                        {job.retry_count > 0 ? (
                          <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded text-xs font-semibold">
                            {job.retry_count} / 3
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-normal">0</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono font-normal text-muted-foreground">
                        {formatDate(job.updatedAt)}
                      </td>
                      {canWrite && (
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditStatus(job.status);
                                setEditRetryCount(job.retry_count);
                                setEditMsg(null);
                                setEditingJob(job);
                              }}
                              className="p-2 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                              title="Edit status antrean"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteJob(job.id)}
                              className="p-2 border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all cursor-pointer"
                              title="Hapus dari antrean"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
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
          {paginatedQueue.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border/80 rounded-2xl shadow-sm">
              No active background jobs present in the queue database.
            </div>
          ) : (
            paginatedQueue.map((job) => (
              <div key={job.id} className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-semibold">Job #{job.id}</span>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-primary font-mono text-sm">{job.lead?.kode_lead || `Lead ID ${job.lead_id}`}</span>
                    {job.retry_count > 0 ? (
                      <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                        Retry: {job.retry_count} / 3
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">0 Retries</span>
                    )}
                  </div>
                  
                  {job.lead && (
                    <div className="flex flex-col text-xs mt-1">
                      <span className="text-foreground font-bold">{job.lead.customerName}</span>
                      <span className="text-muted-foreground font-mono font-normal">{job.lead.customerHp}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-semibold border-t border-border/50 pt-2 mt-1">
                  <div>
                    CS: <span className="text-foreground">{job.lead?.adminName || '-'}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span>Exec: <span className="text-foreground font-mono">{formatDate(job.execute_at)}</span></span>
                    {job.status === 'WAITING' && job.execute_at && (
                      <span className="text-[9px] mt-0.5 text-muted-foreground flex items-center gap-1">
                        In: <CountdownTimer targetDateStr={job.execute_at} status={job.status} />
                      </span>
                    )}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2.5 mt-1">
                    <button
                      onClick={() => {
                        setEditStatus(job.status);
                        setEditRetryCount(job.retry_count);
                        setEditMsg(null);
                        setEditingJob(job);
                      }}
                      className="p-1.5 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Edit size={11} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="p-1.5 border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Hapus
                    </button>
                  </div>
                )}
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
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create AI Job Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border/85 pb-2.5">
              <span className="font-heading font-black text-sm text-foreground flex items-center gap-2">
                <Plus size={16} className="text-primary" /> Tambah Antrean AI Baru
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
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pilih Prospek/Lead</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">-- Pilih Prospek --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.kode_lead} - {l.customerNama || 'Tanpa Nama'} ({l.minat_destinasi || 'No Destination'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center text-[10px] font-bold text-muted-foreground">ATAU</div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Input Numeric Lead ID Secara Manual</label>
                <input
                  type="number"
                  placeholder="Masukkan ID Lead (angka), misal: 388"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
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
                onClick={handleCreateJob}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit AI Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border/85 pb-2.5">
              <span className="font-heading font-black text-sm text-foreground flex items-center gap-2">
                <Edit size={14} className="text-primary" /> Edit Status Antrean AI
              </span>
              <button onClick={() => setEditingJob(null)} className="text-muted-foreground hover:text-foreground">
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
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status Pekerjaan</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="WAITING">WAITING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="DONE">DONE</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Jumlah Percobaan Ulang (Retry Count)</label>
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={editRetryCount}
                  onChange={(e) => setEditRetryCount(Math.min(3, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 text-xs font-semibold border border-border/80 rounded-xl bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 mt-2 justify-end">
              <button
                onClick={() => setEditingJob(null)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleEditJob}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
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

      {/* Toast Notification */}
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
