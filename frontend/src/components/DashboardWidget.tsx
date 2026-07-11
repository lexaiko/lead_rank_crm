import React from 'react';
import { 
  Database, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Hourglass 
} from 'lucide-react';
import { useStore } from '../store/useStore';

export const DashboardWidget: React.FC = () => {
  const { dashboardData, aiQueue } = useStore();

  if (!dashboardData) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const leads = dashboardData.leads.filter(l => new Date(l.createdAt) >= startOfMonth);
  
  // Computations
  const totalLeads = leads.length;
  
  // Lead Baru Hari Ini (created today)
  const today = new Date().toDateString();
  const leadsToday = leads.filter(l => new Date(l.createdAt).toDateString() === today).length;
  
  const hotLeads = leads.filter(l => l.status_lead === 'HOT').length;
  const closedWon = leads.filter(l => l.status_lead === 'CLOSED WON').length;
  const closedLost = leads.filter(l => l.status_lead === 'CLOSED LOST').length;
  
  const estimatedRevenue = leads
    .filter(l => l.status_lead === 'CLOSED WON')
    .reduce((sum, l) => sum + (l.estimasi_nilai_order || 0), 0);

  const waitingJobs = aiQueue.filter(j => j.status === 'WAITING' || j.status === 'PROCESSING').length;

  const stats = [
    {
      label: 'Closed Revenue (Bulan Ini)',
      value: `Rp ${estimatedRevenue.toLocaleString('id-ID')}`,
      icon: TrendingUp,
      color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5',
      desc: 'Completed sales value this month'
    },
    {
      label: 'Total Leads (Bulan Ini)',
      value: totalLeads,
      icon: Database,
      color: 'text-teal-500 bg-teal-500/10 dark:bg-teal-500/5',
      desc: 'All inquiries tracked this month'
    },
    {
      label: 'New Leads Today',
      value: leadsToday,
      icon: Sparkles,
      color: 'text-blue-500 bg-blue-500/10 dark:bg-blue-500/5',
      desc: 'Incoming chats today'
    },
    {
      label: 'HOT Leads (Bulan Ini)',
      value: hotLeads,
      icon: Flame,
      color: 'text-orange-500 bg-orange-500/10 dark:bg-orange-500/5',
      desc: 'Nearing transaction this month'
    },
    {
      label: 'Closed Deals (Bulan Ini)',
      value: closedWon,
      icon: CheckCircle2,
      color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5',
      desc: 'Successful trips this month'
    },
    {
      label: 'Lost Deals (Bulan Ini)',
      value: closedLost,
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
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div 
            key={i} 
            className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-sm hover:shadow-md hover:border-border transition-all duration-200 flex items-center justify-between gap-3 ${
              stat.label === 'Closed Revenue' ? 'col-span-2 lg:col-span-2' : ''
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
