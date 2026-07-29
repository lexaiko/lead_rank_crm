import React, { useEffect, useState } from 'react';
import { api } from '../store/services/api';
import {
  Terminal, RefreshCw, Trash2, Search, Filter, AlertTriangle,
  AlertOctagon, CheckCircle2, Info, Clock, Loader2, Copy, Check, FileText, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';

interface LogEntry {
  id: number;
  level: 'ERROR' | 'QUOTA_EXCEEDED' | 'WARNING' | 'INFO';
  message: string;
  timestamp: string;
  raw: string;
}

export const ErrorLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logFilePath, setLogFilePath] = useState('');
  const [totalLines, setTotalLines] = useState(0);

  // Filters
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'QUOTA_EXCEEDED' | 'ERROR' | 'WARNING'>('ALL');
  const [dayFilter, setDayFilter] = useState<'ALL' | 'TODAY' | '24H' | '3D' | '7D'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // UI States
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getErrorLogs(500);
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setLogFilePath(res.data.logFilePath || '');
        setTotalLines(res.data.totalLines || 0);
      }
    } catch (err) {
      console.error('Failed to fetch PM2 logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Auto refresh interval every 8 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearLogs = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus seluruh log error PM2?')) return;
    setIsClearing(true);
    try {
      const res = await api.clearErrorLogs();
      if (res.success) {
        setToastMessage('File log error PM2 berhasil dibersihkan!');
        setTimeout(() => setToastMessage(null), 4000);
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal membersihkan log PM2.');
    } finally {
      setIsClearing(false);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to filter by day/time range
  const filterByDay = (timestampStr: string) => {
    if (dayFilter === 'ALL') return true;
    const logDate = new Date(timestampStr);
    if (isNaN(logDate.getTime())) return true;

    const now = new Date();
    if (dayFilter === 'TODAY') {
      return logDate.toDateString() === now.toDateString();
    }

    const diffHours = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60);
    if (dayFilter === '24H') return diffHours <= 24;
    if (dayFilter === '3D') return diffHours <= 72;
    if (dayFilter === '7D') return diffHours <= 168;
    return true;
  };

  // Filter logs by level, day, and search query
  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (!filterByDay(log.timestamp)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return log.message.toLowerCase().includes(q) || log.timestamp.toLowerCase().includes(q);
  });

  // Calculate badge counts
  const quotaCount = logs.filter(l => l.level === 'QUOTA_EXCEEDED').length;
  const errorCount = logs.filter(l => l.level === 'ERROR').length;
  const warnCount = logs.filter(l => l.level === 'WARNING').length;

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'QUOTA_EXCEEDED':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'ERROR':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading font-black text-xl md:text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500 dark:from-rose-400 dark:to-amber-400">
              System Error Logs
            </h1>
            <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Terminal size= {11} /> PM2 Diagnostics
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-semibold">
            Halaman monitoring log error PM2 server real-time. Mencatat pesan sistem, rate-limit Gemini API, dan exception.
          </p>
        </div>

        {/* Top Control Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 border rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-card border-border text-muted-foreground hover:bg-muted'
            }`}
            title="Toggle Auto Refresh setiap 8 detik"
          >
            <Clock size={13} className={autoRefresh ? 'animate-spin' : ''} />
            <span>Auto: {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl hover:bg-muted/50 transition-all disabled:opacity-60 cursor-pointer shadow-xs"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span>Refresh</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-500/20 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isClearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        <div className="p-3.5 md:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText size={13} className="text-primary" /> Total Entri Log
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl md:text-2xl font-black font-heading text-foreground">{logs.length}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground font-semibold">dari {totalLines} baris</span>
          </div>
        </div>

        <div className="p-3.5 md:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-orange-500" /> Quota / Rate Limit 429
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl md:text-2xl font-black font-heading text-orange-600 dark:text-orange-400">{quotaCount}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground font-semibold">kejadian</span>
          </div>
        </div>

        <div className="p-3.5 md:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertOctagon size={13} className="text-rose-500" /> System Errors
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl md:text-2xl font-black font-heading text-rose-600 dark:text-rose-400">{errorCount}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground font-semibold">kejadian</span>
          </div>
        </div>

        <div className="p-3.5 md:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Info size={13} className="text-amber-500" /> Warnings / Info
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl md:text-2xl font-black font-heading text-amber-600 dark:text-amber-400">{warnCount}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground font-semibold">catatan</span>
          </div>
        </div>
      </div>

      {/* Path Info Banner */}
      {logFilePath && (
        <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="truncate">Path: <strong className="text-foreground">{logFilePath}</strong></span>
          <span className="shrink-0 text-[10px] uppercase font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md ml-2">Live PM2 File</span>
        </div>
      )}

      {/* Filter and Search Bar Section */}
      <div className="flex flex-col gap-3 bg-card p-3 md:p-4 rounded-2xl border border-border/80 shadow-xs">
        
        {/* Top Controls: Filter Hari & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Filter Hari (Day Filter Pills) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground flex items-center gap-1 mr-1 shrink-0">
              <Calendar size={12} /> Hari:
            </span>
            {[
              { key: 'ALL', label: 'Semua Waktu' },
              { key: 'TODAY', label: 'Hari Ini' },
              { key: '24H', label: '24 Jam' },
              { key: '3D', label: '3 Hari' },
              { key: '7D', label: '7 Hari' },
            ].map(df => (
              <button
                key={df.key}
                onClick={() => setDayFilter(df.key as any)}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                  dayFilter === df.key
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari kata kunci log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-muted/30 border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Level Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-border/50 scrollbar-none">
          <span className="text-[10px] uppercase font-extrabold text-muted-foreground flex items-center gap-1 mr-1 shrink-0">
            <Filter size={12} /> Kategori:
          </span>
          {[
            { key: 'ALL', label: `Semua (${logs.length})` },
            { key: 'QUOTA_EXCEEDED', label: `Rate Limit 429 (${quotaCount})` },
            { key: 'ERROR', label: `Error (${errorCount})` },
            { key: 'WARNING', label: `Warning (${warnCount})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterLevel(tab.key as any)}
              className={`px-3 py-1 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                filterLevel === tab.key
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MOBILE FRIENDLY CARD VIEW (Visible on Mobile / Small Screens) */}
      <div className="md:hidden flex flex-col gap-3">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border/80 rounded-2xl flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-semibold">Memuat log error PM2...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border/80 rounded-2xl flex flex-col items-center gap-2 shadow-xs">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <span className="font-bold text-sm text-foreground">Tidak Ada Log Error!</span>
            <span className="text-xs text-muted-foreground">Tidak ditemukan log error yang sesuai dengan filter.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <div
                key={leadIdKey(log)}
                className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-2.5"
              >
                {/* Header Badge & Time */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${getLevelBadge(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock size={11} /> {formatLogTimestamp(log.timestamp)}
                  </span>
                </div>

                {/* Log Text Content */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="font-mono text-xs text-foreground bg-muted/40 p-3 rounded-xl border border-border/50 cursor-pointer"
                >
                  <p className={`break-all ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
                    {log.message}
                  </p>
                  {log.message.length > 120 && (
                    <span className="text-[10px] text-primary font-bold mt-1.5 flex items-center gap-0.5">
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {isExpanded ? 'Sembunyikan' : 'Lihat Selengkapnya...'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(log.raw, log.id)}
                    className="px-3 py-1.5 rounded-xl bg-muted border border-border/60 text-foreground font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                  >
                    {copiedId === log.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedId === log.id ? 'Tersalin!' : 'Salin Log'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP TERMINAL VIEW (Visible on Medium / Desktop Screens) */}
      <div className="hidden md:block rounded-2xl bg-[#090d16] border border-slate-800 shadow-xl overflow-hidden font-mono text-xs">
        {/* Terminal Titlebar */}
        <div className="px-4 py-3 bg-[#0d1320] border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 ml-2">PM2 Console Output - tripbwi-crm</span>
          </div>

          <span className="text-[10px] text-slate-500 font-semibold">
            Menampilkan {filteredLogs.length} dari {logs.length} entri
          </span>
        </div>

        {/* Log Lines Area */}
        <div className="p-4 max-h-[580px] overflow-y-auto space-y-2 divide-y divide-slate-800/40">
          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-slate-400" />
              <span>Memuat entri log PM2...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <CheckCircle2 size={28} className="text-emerald-500/60" />
              <span className="font-bold text-slate-300">Tidak ada log error yang cocok!</span>
              <span className="text-[11px] text-slate-500">Sistem dalam keadaan bersih atau filter tidak menemukan data.</span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="pt-2 pb-1 flex flex-col gap-1.5 hover:bg-slate-900/50 p-2 rounded-lg transition-colors group">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${getLevelBadge(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {formatLogTimestamp(log.timestamp)}
                    </span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(log.raw, log.id)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-slate-800 text-slate-300 hover:text-white rounded text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                    title="Salin baris log"
                  >
                    {copiedId === log.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedId === log.id ? 'Tersalin' : 'Copy'}</span>
                  </button>
                </div>

                <p className="text-slate-300 break-all whitespace-pre-wrap leading-relaxed">
                  {log.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

// Helper timestamp formatter to Indonesian WIB format
function formatLogTimestamp(timestampStr: string): string {
  if (!timestampStr) return '-';
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return timestampStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(d) + ' WIB';
  } catch (e) {
    return timestampStr;
  }
}

// Helper key generator
function leadIdKey(log: LogEntry) {
  return `${log.id}-${log.timestamp}`;
}

export default ErrorLogs;
