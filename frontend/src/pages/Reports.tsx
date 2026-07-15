import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  DestinationsChart, 
  ReferralChart 
} from '../components/Charts';
import { TrendingUp, Award, Target, HelpCircle } from 'lucide-react';

export const Reports: React.FC = () => {
  const { dashboardData, fetchDashboard } = useStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (!dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const { stats, admins } = dashboardData;
  const { thisMonth } = stats;
  const byStatus = thisMonth.byStatus;

  // 1. Funnel Calculations
  const counts = {
    NEW: byStatus['NEW'] || 0,
    PROSPECT: byStatus['PROSPECT'] || 0,
    QUALIFIED: byStatus['QUALIFIED'] || 0,
    HOT: byStatus['HOT'] || 0,
    WON: byStatus['CLOSED WON'] || 0,
  };

  const totalLeads = thisMonth.total;
  const totalWon = counts.WON;
  const conversionRate = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : '0.0';
  const revenueTotal = thisMonth.revenue;

  const formatResponseTime = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${remMins}m` : `${hrs}h`;
  };

  // 2. Admin Performance — sourced from server-aggregated thisMonth data
  const adminStats = admins
    .map(adm => ({
      name: adm.nama_admin,
      assigned: adm.thisMonth.assigned,
      won: adm.thisMonth.won,
      sales: adm.thisMonth.revenue,
      rate: adm.thisMonth.assigned > 0
        ? ((adm.thisMonth.won / adm.thisMonth.assigned) * 100).toFixed(1)
        : '0.0',
      avgReplyTime: adm.avgReplyTime
    }))
    .sort((a, b) => b.sales - a.sales);

  const funnelStages = [
    { label: 'New lead incoming', count: counts.NEW, color: 'bg-slate-400' },
    { label: 'Prospect asking price', count: counts.PROSPECT, color: 'bg-blue-500' },
    { label: 'Qualified trip set', count: counts.QUALIFIED, color: 'bg-cyan-500' },
    { label: 'HOT payment pending', count: counts.HOT, color: 'bg-orange-500' },
    { label: 'CLOSED WON paid', count: counts.WON, color: 'bg-emerald-500' },
  ];

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
          Laporan Analisis & Performa
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Analisis konversi pipeline sales, nilai booking, destinasi terfavorit, serta performa balasan masing-masing CS bulan ini.
        </p>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Sales Revenue (Bulan Ini)</span>
            <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-400 mt-1 font-heading">
              Rp {revenueTotal.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Conversion Rate (Bulan Ini)</span>
            <span className="text-2xl font-extrabold text-foreground mt-1 font-heading">
              {conversionRate} %
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Target size={20} />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Top Performing Agent (Bulan Ini)</span>
            <span className="text-sm font-bold text-foreground mt-1 truncate max-w-[150px]">
              {adminStats[0]?.name || 'No Agent'}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Award size={20} />
          </div>
        </div>
      </div>

      {/* Lead Conversion Funnel */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Sales Conversion Funnel Pipeline
        </span>

        <div className="flex flex-col gap-3.5 mt-2">
          {funnelStages.map((stage, i) => {
            const maxVal = Math.max(...funnelStages.map(s => s.count), 1);
            const pct = (stage.count / maxVal) * 100;
            return (
              <div key={i} className="flex items-center gap-4">
                <span className="w-36 text-xs font-bold text-foreground truncate">{stage.label}</span>
                <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden relative border border-border/60">
                  <div 
                    className={`h-full rounded-r-lg ${stage.color} opacity-85 transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-foreground">
                    {stage.count} Leads
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Destinations & Referrals Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Travel Package Popularity interest
          </span>
          <div className="h-64">
            <DestinationsChart />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Lead Acquisition Referral Distribution
          </span>
          <div className="h-64 flex items-center justify-center">
            <ReferralChart />
          </div>
        </div>
      </div>

      {/* Customer Service Performance Tracker */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Customer Service Agents Sales Performance
        </span>

        {/* Desktop CS performance table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CS Agent Name</th>
                <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Assigned Leads</th>
                <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Closed Won Deals</th>
                <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Conversion Rate</th>
                <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Avg Response Time</th>
                <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Revenue Contributed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm font-semibold">
              {adminStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No active CS agents stats available.
                  </td>
                </tr>
              ) : (
                adminStats.map((stat, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 text-foreground flex items-center gap-2">
                      <div className="h-6 w-6 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                        {stat.name.slice(0, 2)}
                      </div>
                      {stat.name}
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-muted-foreground font-normal">{stat.assigned}</td>
                    <td className="px-5 py-4 text-center font-mono text-muted-foreground font-normal">{stat.won}</td>
                    <td className="px-5 py-4 text-center text-emerald-500 font-bold font-mono">{stat.rate} %</td>
                    <td className="px-5 py-4 text-center font-mono text-xs text-muted-foreground">{formatResponseTime(stat.avgReplyTime)}</td>
                    <td className="px-5 py-4 text-right text-orange-600 dark:text-orange-400 font-heading font-extrabold">
                      Rp {stat.sales.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="block md:hidden flex flex-col gap-3">
          {adminStats.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border/80 rounded-2xl shadow-sm">
              No active CS agents stats available.
            </div>
          ) : (
            adminStats.map((stat, i) => (
              <div key={i} className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                      {stat.name.slice(0, 2)}
                    </div>
                    <span className="font-bold text-sm text-foreground">{stat.name}</span>
                  </div>
                  <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400 font-heading">
                    Rp {stat.sales.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-muted/20 border border-border/50 rounded-xl p-3 text-[11px] font-semibold text-muted-foreground">
                  <div>Leads Assigned: <span className="text-foreground font-mono">{stat.assigned}</span></div>
                  <div className="text-right">Closed Won: <span className="text-foreground font-mono">{stat.won}</span></div>
                  <div>Conv. Rate: <span className="text-emerald-500 font-bold font-mono">{stat.rate} %</span></div>
                  <div className="text-right">Avg Response: <span className="text-foreground font-mono">{formatResponseTime(stat.avgReplyTime)}</span></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
