'use client';

import dynamic from 'next/dynamic';
import type { ConsumptionRow } from '@/services/analytics.service';

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

interface Props { data: ConsumptionRow[]; }

export function ConsumptionComparisonChart({ data }: Props) {
  // Mostrar solo vehículos que tienen referencia de eficiencia
  const rows = data.filter(r => r.efficiencyReference !== null);

  const labels    = rows.map(r => r.plate);
  const reference = rows.map(r => r.efficiencyReference!);
  const actual    = rows.map(r => r.avgKmPerUnit ?? 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Consumo esperado (km/L ref.)',
        data:  reference,
        backgroundColor: 'rgba(99,102,241,0.75)',
        borderColor:     'rgba(99,102,241,1)',
        borderWidth:     1,
        borderRadius:    4,
      },
      {
        label: 'Consumo real (km/L)',
        data:  actual,
        backgroundColor: rows.map(r =>
          r.anomaly ? 'rgba(239,68,68,0.75)' : 'rgba(16,185,129,0.75)',
        ),
        borderColor: rows.map(r =>
          r.anomaly ? 'rgba(239,68,68,1)' : 'rgba(16,185,129,1)',
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
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number }; dataIndex: number }) => {
            const row = rows[ctx.dataIndex];
            if (ctx.dataset.label?.includes('real') && row.deviationPct !== null) {
              const sign = row.deviationPct >= 0 ? '+' : '';
              return `${ctx.parsed.y.toFixed(2)} km/L (${sign}${row.deviationPct}% vs ref.)`;
            }
            return `${ctx.parsed.y.toFixed(2)} km/L`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'km / litro' },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: { grid: { display: false } },
    },
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin datos de referencia de eficiencia por vehículo
      </div>
    );
  }

  return <Bar data={chartData} options={options} />;
}
