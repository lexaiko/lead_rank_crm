import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useStore } from '../store/useStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export const LeadStatusChart: React.FC = () => {
  const { dashboardData, theme } = useStore();
  if (!dashboardData) return null;

  const byStatus = dashboardData.stats.thisMonth.byStatus;
  const labels = ['NEW', 'QUALIFIED', 'PROSPECT', 'HOT', 'CLOSED WON', 'CLOSED LOST'];
  const values = labels.map(s => byStatus[s] || 0);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const data = {
    labels,
    datasets: [{
      label: 'Leads Count',
      data: values,
      backgroundColor: ['#64748b', '#06b6d4', '#3b82f6', '#f97316', '#10b981', '#ef4444'],
      borderWidth: 0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          font: { family: 'Inter', size: 11, weight: 'bold' as any },
          padding: 15,
        },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
};

export const DestinationsChart: React.FC = () => {
  const { dashboardData, theme } = useStore();
  if (!dashboardData) return null;

  const byDestination = dashboardData.stats.thisMonth.byDestination;
  const sorted = Object.entries(byDestination).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const borderGrid = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';

  const data = {
    labels: sorted.map(d => d[0]),
    datasets: [{
      label: 'Leads Interested',
      data: sorted.map(d => d[1]),
      backgroundColor: '#e05e26',
      borderRadius: 8,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 10 } } },
      y: { grid: { color: borderGrid }, ticks: { color: textColor, stepSize: 1 } },
    },
  };

  return <Bar data={data} options={options} />;
};

export const ReferralChart: React.FC = () => {
  const { dashboardData, theme } = useStore();
  if (!dashboardData) return null;

  const byReferral = dashboardData.stats.thisMonth.byReferral || {};
  
  const defaultKeys = ['whatsapp', 'instagram', 'tiktok', 'website', 'rekomendasi', 'facebook', 'lainnya', 'tidak diketahui'];
  const allKeysSet = new Set([...Object.keys(byReferral), ...defaultKeys]);
  
  const formatLabel = (key: string) => {
    const k = key.toLowerCase();
    if (k === 'tidak diketahui') return 'Tidak Diketahui';
    if (k === 'whatsapp') return 'WhatsApp';
    if (k === 'instagram') return 'Instagram';
    if (k === 'tiktok') return 'TikTok';
    if (k === 'website') return 'Website';
    if (k === 'rekomendasi') return 'Rekomendasi';
    if (k === 'facebook') return 'Facebook';
    if (k === 'lainnya') return 'Lainnya';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  let sources = Array.from(allKeysSet)
    .map(key => ({
      key,
      label: formatLabel(key),
      count: Number(byReferral[key] || 0)
    }))
    .filter(item => item.count > 0);

  sources.sort((a, b) => b.count - a.count);

  const colorsMap: Record<string, string> = {
    whatsapp: '#25d366',
    instagram: '#ec4899',
    tiktok: theme === 'dark' ? '#f8fafc' : '#0f172a',
    website: '#14b8a6',
    rekomendasi: '#f59e0b',
    facebook: '#3b82f6',
    google: '#ea4335',
    lainnya: '#8b5cf6',
    'tidak diketahui': '#94a3b8'
  };

  const totalLeadsCount = sources.reduce((sum, s) => sum + s.count, 0);
  const colors = sources.map(s => colorsMap[s.key.toLowerCase()] || '#64748b');

  const data = {
    labels: sources.map(s => s.label),
    datasets: [{
      data: sources.length > 0 ? sources.map(s => s.count) : [1],
      backgroundColor: sources.length > 0 ? colors : [theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'],
      borderWidth: 0,
      borderRadius: sources.length > 1 ? 4 : 0,
      spacing: sources.length > 1 ? 3 : 0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: sources.length > 0,
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        titleColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
        bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569',
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 12,
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            const pct = totalLeadsCount > 0 ? ((val / totalLeadsCount) * 100).toFixed(1) : '0';
            return ` ${val} Leads (${pct}%)`;
          }
        }
      }
    },
  };

  return (
    <div className="w-full flex flex-col justify-between gap-3 min-h-[340px]">
      {/* Doughnut Chart with Center Stat Overlay */}
      <div className="h-40 sm:h-48 w-full relative flex items-center justify-center shrink-0 my-1">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xl sm:text-3xl font-black font-heading tracking-tight text-foreground leading-none">
            {totalLeadsCount}
          </span>
          <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
            Total Leads
          </span>
        </div>
      </div>

      {/* UX Rich Legend List with Micro Progress Bars */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50 max-h-44 overflow-y-auto pr-1">
        {sources.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground font-medium">
            Belum ada data channel source.
          </div>
        ) : (
          sources.map((source, idx) => {
            const color = colors[idx];
            const pct = totalLeadsCount > 0 ? ((source.count / totalLeadsCount) * 100).toFixed(1) : '0';
            const barWidth = totalLeadsCount > 0 ? Math.max(4, Math.round((source.count / totalLeadsCount) * 100)) : 0;

            return (
              <div 
                key={source.key} 
                className="flex flex-col gap-1 p-1.5 sm:p-2 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span 
                      className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0 shadow-xs" 
                      style={{ backgroundColor: color }} 
                    />
                    <span className="text-[11px] sm:text-xs font-bold text-foreground truncate">
                      {source.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] sm:text-xs">
                    <span className="font-extrabold text-foreground">{source.count}</span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold">({pct}%)</span>
                  </div>
                </div>

                {/* Micro Progress Bar */}
                <div className="w-full h-1 sm:h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const LeadsOverTimeChart: React.FC = () => {
  const { dashboardData, theme } = useStore();
  if (!dashboardData) return null;

  const byDay = dashboardData.stats.thisMonth.byDay;

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const borderGrid = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';

  const data = {
    labels: byDay.map(d => {
      const parts = new Date(d.date + 'T00:00:00').toDateString().split(' ');
      return `${parts[1]} ${parts[2]}`;
    }),
    datasets: [{
      label: 'New Leads',
      data: byDay.map(d => d.count),
      fill: true,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      tension: 0.35,
      pointRadius: 4,
      pointBackgroundColor: '#10b981',
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: { grid: { color: borderGrid }, ticks: { color: textColor, stepSize: 1 } },
    },
  };

  return <Line data={data} options={options} />;
};
