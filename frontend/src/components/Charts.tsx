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
  const labels = ['NEW', 'PROSPECT', 'QUALIFIED', 'HOT', 'CLOSED WON', 'CLOSED LOST'];
  const values = labels.map(s => byStatus[s] || 0);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const data = {
    labels,
    datasets: [{
      label: 'Leads Count',
      data: values,
      backgroundColor: ['#64748b', '#3b82f6', '#06b6d4', '#f97316', '#10b981', '#ef4444'],
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

  const byReferral = dashboardData.stats.thisMonth.byReferral;
  const keys = ['instagram', 'tiktok', 'website', 'rekomendasi', 'facebook', 'lainnya', 'tidak diketahui'];
  const values = keys.map(k => byReferral[k] || 0);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const data = {
    labels: keys.map(k => k.toUpperCase()),
    datasets: [{
      data: values,
      backgroundColor: ['#ec4899', '#000000', '#14b8a6', '#f59e0b', '#3b82f6', '#8b5cf6', '#94a3b8'],
      borderWidth: 0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: textColor, font: { family: 'Inter', size: 10, weight: 'bold' as any }, padding: 12 },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
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
