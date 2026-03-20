'use client';

import dynamic from 'next/dynamic';
import type { VehicleCostRow } from '@/services/analytics.service';

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

interface Props { data: VehicleCostRow[]; }

export function CostBreakdownChart({ data }: Props) {
  // Top 10 por costo total
  const rows = [...data].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);

  const chartData = {
    labels: rows.map(r => r.plate),
    datasets: [
      {
        label: 'Combustible',
        data:  rows.map(r => r.totalFuelCost),
        backgroundColor: 'rgba(99,102,241,0.80)',
        borderColor:     'rgba(99,102,241,1)',
        borderRadius:    4,
        stack:           'costs',
      },
      {
        label: 'Mantenimiento',
        data:  rows.map(r => r.totalMaintCost),
        backgroundColor: 'rgba(245,158,11,0.80)',
        borderColor:     'rgba(245,158,11,1)',
        borderRadius:    4,
        stack:           'costs',
      },
    ],
  };

  const options = {
    indexAxis:           'y' as const,
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          footer: (items: { dataIndex: number }[]) => {
            if (!items.length) return '';
            const row = rows[items[0].dataIndex];
            return `Total: $${row.totalCost.toLocaleString()}  |  Costo/km: ${row.costPerKm !== null ? `$${row.costPerKm}` : 'N/A'}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: 'Costo ($)' },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        stacked: true,
        grid: { display: false },
      },
    },
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin datos de costos en el período
      </div>
    );
  }

  return <Bar data={chartData} options={options} />;
}
