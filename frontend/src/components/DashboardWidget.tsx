import React, { useState, useEffect } from 'react';
import { Database, Clock, Trophy, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import { useStore } from '../store/useStore';

interface DashboardWidgetProps {
  presetType?: string;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ presetType = 'THIS_MONTH' }) => {
  const { dashboardData } = useStore();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) + ' WIB'
      );
      setDateStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dashboardData) return null;

  const { stats } = dashboardData;
  const { thisMonth, previousPeriod } = stats;
  const byStatus = thisMonth.byStatus || {};

  const totalLeads = thisMonth.total || 0;
  const closedWonCount = byStatus['CLOSED WON'] || 0;
  const closingRate = totalLeads > 0 ? ((closedWonCount / totalLeads) * 100).toFixed(1) : '0.0';

  const pipelineCount = (byStatus['QUALIFIED'] || 0) + (byStatus['PROSPECT'] || 0) + (byStatus['HOT'] || 0);
  const potentialWonValue = thisMonth.potentialWon || 0;
  const valueWon = thisMonth.valueWon || 0;

  // Previous Period Comparisons
  const prevStats = previousPeriod || { total: 0, closedWon: 0, potentialWon: 0, valueWon: 0 };
  const prevTotalLeads = prevStats.total || 0;
  const prevClosedWon = prevStats.closedWon || 0;
  const prevClosingRate = prevTotalLeads > 0 ? (prevClosedWon / prevTotalLeads) * 100 : 0;
  const currentClosingRateNum = totalLeads > 0 ? (closedWonCount / totalLeads) * 100 : 0;

  const getPeriodLabel = (preset?: string) => {
    switch (preset) {
      case 'TODAY': return 'vs kemarin';
      case 'YESTERDAY': return 'vs 2 hr lalu';
      case 'LAST_7_DAYS': return 'vs 7 hr lalu';
      case 'THIS_MONTH': return 'vs bln lalu';
      case 'LAST_30_DAYS': return 'vs 30 hr lalu';
      case 'LAST_MONTH': return 'vs 2 bln lalu';
      case 'THIS_YEAR': return 'vs thn lalu';
      default: return 'vs periode lalu';
    }
  };

  const renderTrendBadge = (current: number, previous: number, isPercentage = false) => {
    if (previous === undefined || previous === null) return null;

    const labelText = getPeriodLabel(presetType);

    if (isPercentage) {
      const diff = current - previous;
      if (Math.abs(diff) < 0.05) {
        return (
          <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground/80 shrink-0">
            Stabil <span className="hidden sm:inline">{labelText}</span>
          </span>
        );
      }
      const isUp = diff > 0;
      const fmtDiff = Math.abs(diff).toFixed(1).replace(/\.0$/, '');
      return (
        <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 shrink-0 ${
          isUp 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
        }`}>
          {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isUp ? '+' : '-'}{fmtDiff}%<span className="hidden sm:inline"> {labelText}</span>
        </span>
      );
    }

    const diff = current - previous;
    if (diff === 0) {
      return (
        <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground/80 shrink-0">
          Stabil <span className="hidden sm:inline">{labelText}</span>
        </span>
      );
    }

    if (previous === 0) {
      if (current > 0) {
        return (
          <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-0.5 shrink-0">
            <TrendingUp size={10} />
            +{current}<span className="hidden sm:inline"> {labelText}</span>
          </span>
        );
      }
      return (
        <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground/80 shrink-0">
          0 <span className="hidden sm:inline">{labelText}</span>
        </span>
      );
    }

    const rawPct = ((Math.abs(diff) / previous) * 100).toFixed(1).replace(/\.0$/, '');
    const isUp = diff > 0;

    return (
      <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 shrink-0 ${
        isUp 
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      }`}>
        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {isUp ? '+' : '-'}{rawPct}%<span className="hidden sm:inline"> {labelText}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2.5 sm:gap-4">
      
      {/* Baris 1: Waktu System (Full Width Mobile), Total Lead, Total Closing Win */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        
        {/* Card 1: Waktu System */}
        <div className="col-span-2 lg:col-span-1 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-border transition-all flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                WAKTU SYSTEM
              </span>
            </div>
            <span className="text-base sm:text-xl font-black font-heading leading-tight tracking-tight text-foreground font-mono truncate">
              {timeStr || '--:--:-- WIB'}
            </span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium truncate capitalize">
              {dateStr || 'Memuat tanggal...'}
            </span>
          </div>
          <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 text-blue-500 bg-blue-500/10">
            <Clock className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
        </div>

        {/* Card 2: Total Lead */}
        <div className="col-span-1 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-border transition-all flex items-center justify-between gap-1.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] sm:text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
              TOTAL LEAD
            </span>
            <span className="text-base sm:text-xl font-black font-heading leading-tight tracking-tight text-foreground truncate">
              {totalLeads.toLocaleString('id-ID')} <span className="text-[9px] font-semibold text-muted-foreground hidden sm:inline">Leads</span>
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {renderTrendBadge(totalLeads, prevTotalLeads)}
            </div>
          </div>
          <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 text-orange-500 bg-orange-500/10">
            <Database className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        {/* Card 3: Total Closing Win & Closing Rate */}
        <div className="col-span-1 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-border transition-all flex items-center justify-between gap-1.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] sm:text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
              CLOSING WIN
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black font-heading leading-tight tracking-tight text-foreground truncate">
                {closedWonCount.toLocaleString('id-ID')}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                {closingRate}%
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {renderTrendBadge(currentClosingRateNum, prevClosingRate, true)}
            </div>
          </div>
          <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 bg-emerald-500/10">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

      </div>

      {/* Baris 2: Potential Won & Value Won */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        
        {/* Card 4: Potential Won */}
        <div className="col-span-1 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-border transition-all flex items-center justify-between gap-1.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] sm:text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
              POTENTIAL WON
            </span>
            <span className="text-xs sm:text-lg font-black font-heading leading-tight tracking-tight text-amber-600 dark:text-amber-400 truncate">
              Rp {potentialWonValue.toLocaleString('id-ID')}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {renderTrendBadge(potentialWonValue, prevStats.potentialWon)}
            </div>
          </div>
          <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 text-amber-500 bg-amber-500/10">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        {/* Card 5: Value Won */}
        <div className="col-span-1 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-border transition-all flex items-center justify-between gap-1.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] sm:text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
              VALUE WON
            </span>
            <span className="text-xs sm:text-lg font-black font-heading leading-tight tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              Rp {valueWon.toLocaleString('id-ID')}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {renderTrendBadge(valueWon, prevStats.valueWon)}
            </div>
          </div>
          <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 bg-emerald-500/10">
            <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

      </div>
    </div>
  );
};
