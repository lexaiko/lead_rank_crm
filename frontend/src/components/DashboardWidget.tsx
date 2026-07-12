import React from 'react';
import { Database, Sparkles, TrendingUp, CheckCircle2, XCircle, Flame, Hourglass } from 'lucide-react';
import { useStore } from '../store/useStore';

export const DashboardWidget: React.FC = () => {
  const { dashboardData, aiQueue } = useStore();

  if (!dashboardData) return null;

  const { stats } = dashboardData;
  const { thisMonth } = stats;
  const byStatus = thisMonth.byStatus;

  const waitingJobs = aiQueue.filter(j => j.status === 'WAITING' || j.status === 'PROCESSING').length;

  const items = [
    {
      label: 'Closed Revenue (Bulan Ini)',
      value: `Rp ${thisMonth.revenue.toLocaleString('id-ID')}`,
      icon: TrendingUp,
      color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5',
      desc: 'Completed sales value this month',
      fullWidth: true
    },
    {
      label: 'Total Leads (Bulan Ini)',
      value: thisMonth.total,
      icon: Database,
      color: 'text-orange-500 bg-orange-500/10 dark:bg-orange-500/5',
      desc: 'All inquiries tracked this month'
    },
    {
      label: 'New Leads Today',
      value: thisMonth.today,
      icon: Sparkles,
      color: 'text-blue-500 bg-blue-500/10 dark:bg-blue-500/5',
      desc: 'Incoming chats today'
    },
    {
      label: 'HOT Leads (Bulan Ini)',
      value: byStatus['HOT'] || 0,
      icon: Flame,
      color: 'text-orange-500 bg-orange-500/10 dark:bg-orange-500/5',
      desc: 'Nearing transaction this month'
    },
    {
      label: 'Closed Deals (Bulan Ini)',
      value: byStatus['CLOSED WON'] || 0,
      icon: CheckCircle2,
      color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5',
      desc: 'Successful trips this month'
    },
    {
      label: 'Lost Deals (Bulan Ini)',
      value: byStatus['CLOSED LOST'] || 0,
      icon: XCircle,
      color: 'text-rose-500 bg-rose-500/10 dark:bg-rose-500/5',
      desc: 'Inactive/Cancelled this month'
    },
    {
      label: 'AI Queue Jobs',
      value: waitingJobs,
      icon: Hourglass,
      color: 'text-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/5',
      desc: 'Pending AI processing'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      {items.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-sm hover:shadow-md hover:border-border transition-all duration-200 flex items-center justify-between gap-3 ${
              stat.fullWidth ? 'col-span-full' : ''
            }`}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                {stat.label}
              </span>
              <span className="text-base sm:text-2xl font-black font-heading leading-tight tracking-tight text-foreground truncate">
                {stat.value}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 truncate">
                {stat.desc}
              </span>
            </div>
            <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <Icon className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
