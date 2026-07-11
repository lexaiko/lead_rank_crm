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

  const leads = dashboardData.leads;
  const statusCounts = {
    NEW: leads.filter(l => l.status_lead === 'NEW').length,
    PROSPEK: leads.filter(l => l.status_lead === 'PROSPEK').length,
    QUALIFIED: leads.filter(l => l.status_lead === 'QUALIFIED').length,
    HOT: leads.filter(l => l.status_lead === 'HOT').length,
    'CLOSED WON': leads.filter(l => l.status_lead === 'CLOSED WON').length,
    'CLOSED LOST': leads.filter(l => l.status_lead === 'CLOSED LOST').length,
  };

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const borderGrid = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';

  const data = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        label: 'Leads Count',
        data: Object.values(statusCounts),
        backgroundColor: [
          '#64748b', // NEW
          '#3b82f6', // PROSPEK
          '#06b6d4', // QUALIFIED
          '#f97316', // HOT
          '#10b981', // CLOSED WON
          '#ef4444', // CLOSED LOST
        ],
        borderWidth: 0,
      },
    ],
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

  const leads = dashboardData.leads;
  
  // Count destinations frequency
  const destCounts: Record<string, number> = {};
  leads.forEach(l => {
    if (l.minat_destinasi) {
      l.minat_destinasi.split(',').forEach(d => {
        const name = d.trim();
        if (name) {
          destCounts[name] = (destCounts[name] || 0) + 1;
        }
      });
    }
  });

  const sortedDest = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const borderGrid = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';

  const data = {
    labels: sortedDest.map(d => d[0]),
    datasets: [
      {
        label: 'Leads Interested',
        data: sortedDest.map(d => d[1]),
        backgroundColor: '#0d9488', // Teal
        borderRadius: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
      },
      y: {
        grid: { color: borderGrid },
        ticks: { color: textColor, stepSize: 1 },
      },
    },
  };

  return <Bar data={data} options={options} />;
};

export const ReferralChart: React.FC = () => {
  const { dashboardData, theme } = useStore();

  if (!dashboardData) return null;

  const leads = dashboardData.leads;
  const refCounts: Record<string, number> = {
    instagram: 0,
    tiktok: 0,
    website: 0,
    rekomendasi: 0,
    facebook: 0,
    lainnya: 0,
    'tidak diketahui': 0,
  };

  leads.forEach(l => {
    const src = l.referral_source || 'tidak diketahui';
    if (src in refCounts) {
      refCounts[src]++;
    } else {
      refCounts['lainnya']++;
    }
  });

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const data = {
    labels: Object.keys(refCounts).map(k => k.toUpperCase()),
    datasets: [
      {
        data: Object.values(refCounts),
        backgroundColor: [
          '#ec4899', // instagram
          '#000000', // tiktok (or slate-900)
          '#14b8a6', // website
          '#f59e0b', // rekomendasi
          '#3b82f6', // facebook
          '#8b5cf6', // lainnya
          '#94a3b8', // tidak diketahui
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          font: { family: 'Inter', size: 10, weight: 'bold' as any },
          padding: 12,
        },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
};

export const LeadsOverTimeChart: React.FC = () => {
  const { dashboardData, theme } = useStore();

  if (!dashboardData) return null;

  const leads = dashboardData.leads;
  
  // Aggregate leads by date (last 7 days)
  const dateCounts: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateCounts[d.toDateString()] = 0;
  }

  leads.forEach(l => {
    const key = new Date(l.createdAt).toDateString();
    if (key in dateCounts) {
      dateCounts[key]++;
    }
  });

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const borderGrid = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';

  const data = {
    labels: Object.keys(dateCounts).map(d => {
      const parts = d.split(' ');
      return `${parts[1]} ${parts[2]}`; // "Month Day"
    }),
    datasets: [
      {
        label: 'New Leads',
        data: Object.values(dateCounts),
        fill: true,
        borderColor: '#10b981', // Emerald
        backgroundColor: 'rgba(16,185,129,0.08)',
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor },
      },
      y: {
        grid: { color: borderGrid },
        ticks: { color: textColor, stepSize: 1 },
      },
    },
  };

  return <Line data={data} options={options} />;
};
