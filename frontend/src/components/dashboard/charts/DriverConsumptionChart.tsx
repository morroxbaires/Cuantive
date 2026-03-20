'use client';

import dynamic from 'next/dynamic';
import type { DriverAnomalyRow } from '@/services/analytics.service';

const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props { data: DriverAnomalyRow[]; }

export function DriverConsumptionChart({ data }: Props) {
  // Top/bottom 10 conductores por desvío
  const rows = [...data]
    .filter(r => r.deviationPct !== null)
    .sort((a, b) => (a.deviationPct ?? 0) - (b.deviationPct ?? 0))
    .slice(0, 10);

  const chartData = {
    labels: rows.map(r => r.driverName),
    datasets: [
      {
        label: 'Desvío vs referencia (%)',
        data:  rows.map(r => r.deviationPct),
        backgroundColor: rows.map(r =>
          (r.deviationPct ?? 0) >= 0
            ? 'rgba(16,185,129,0.75)'
            : 'rgba(239,68,68,0.75)',
        ),
        borderColor: rows.map(r =>
          (r.deviationPct ?? 0) >= 0
            ? 'rgba(16,185,129,1)'
            : 'rgba(239,68,68,1)',
        ),
        borderWidth:  1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number }; dataIndex: number }) => {
            const row = rows[ctx.dataIndex];
            const sign = (ctx.parsed.y) >= 0 ? '+' : '';
            return `${sign}${ctx.parsed.y.toFixed(1)}% | ${row.loadCount} cargas | ${row.avgKmPerUnit?.toFixed(1) ?? 'N/A'} km/L`;
          },
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'Desvío (%)' },
        grid:  { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => `${v}%`,
        },
      },
      x: { grid: { display: false } },
    },
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin datos de conductores en el período
      </div>
    );
  }

  return <Bar data={chartData} options={options} />;
}
