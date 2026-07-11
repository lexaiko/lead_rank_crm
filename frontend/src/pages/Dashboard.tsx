import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { DashboardWidget } from '../components/DashboardWidget';
import { 
  LeadsOverTimeChart, 
  LeadStatusChart, 
  DestinationsChart 
} from '../components/Charts';
import { Sparkles, Calendar, User, Compass } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { fetchDashboard, fetchAIQueue, dashboardData } = useStore();

  useEffect(() => {
    fetchDashboard();
    fetchAIQueue();
  }, []);

  if (!dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const recentLeads = dashboardData.leads.slice(0, 5);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      
      {/* Welcome Banner */}
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 dark:from-teal-400 dark:to-emerald-400">
          Core Operations Console
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Real-time WhatsApp passive tracking, AI data extraction, and customer conversions (Metrics: Current Month / Bulan Ini).
        </p>
      </div>

      {/* Widgets Grid */}
      <DashboardWidget />

      {/* Charts Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Line Chart: Leads Over Time */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Lead Acquisition Timeline (Last 7 Days)
          </span>
          <div className="h-72">
            <LeadsOverTimeChart />
          </div>
        </div>

        {/* Doughnut Chart: Lead Status */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Lead Status Funnel Distribution
          </span>
          <div className="h-72 flex items-center justify-center">
            <LeadStatusChart />
          </div>
        </div>

      </div>

      {/* Second Row: Recent Activities & Destinations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Destinations */}
        <div className="lg:col-span-1 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Travel Hotspots & Destinations Interest
          </span>
          <div className="h-72">
            <DestinationsChart />
          </div>
        </div>

        {/* Recent Activity Timeline Feed */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Recent Lead Activities Feed
          </span>
          
          <div className="flex flex-col gap-3.5 flex-1 justify-center">
            {recentLeads.length === 0 ? (
              <span className="text-sm text-muted-foreground text-center">No recent activities available.</span>
            ) : (
              recentLeads.map((lead, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-4 p-3 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  {/* Icon indicator */}
                  <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 flex items-center justify-center">
                    <Compass size={16} />
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{lead.kode_lead}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-semibold text-foreground">
                          {lead.customerNama || 'Pelanggan WA'}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                        Trip Destinasi: <strong className="text-foreground">{lead.minat_destinasi || '-'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center ${getStatusBadge(lead.status_lead)}`}>
                        {lead.status_lead}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatDate(lead.updatedAt)}
                      </span>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
