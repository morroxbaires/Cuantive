'use client';

import dynamic from 'next/dynamic';
import type { FuelTrendMonthRow } from '@/services/analytics.service';

const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Props { data: FuelTrendMonthRow[]; }

export function FuelTrendAnalyticsChart({ data }: Props) {
  const labels   = data.map(r => r.month);
  const liters   = data.map(r => r.totalLiters);
  const cost     = data.map(r => r.totalCost);
  const vehicles = data.map(r => r.activeVehicles);

  const chartData = {
    labels,
    datasets: [
      {
        label:           'Litros cargados',
        data:            liters,
        borderColor:     'rgba(99,102,241,1)',
        backgroundColor: 'rgba(99,102,241,0.12)',
        fill:            true,
        tension:         0.4,
        yAxisID:         'y',
        pointBackgroundColor: 'rgba(99,102,241,1)',
        pointRadius:     4,
      },
      {
        label:           'Gasto ($)',
        data:            cost,
        borderColor:     'rgba(245,158,11,1)',
        backgroundColor: 'rgba(245,158,11,0.08)',
        fill:            true,
        tension:         0.4,
        yAxisID:         'y2',
        pointBackgroundColor: 'rgba(245,158,11,1)',
        pointRadius:     4,
      },
      {
        label:       'Vehículos activos',
        data:        vehicles,
        borderColor: 'rgba(16,185,129,0.8)',
        backgroundColor: 'transparent',
        borderDash:  [5, 3],
        tension:     0.3,
        yAxisID:     'y3',
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    interaction:         { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'top' as const },
    },
    scales: {
      y: {
        type:     'linear' as const,
        position: 'left' as const,
        title:    { display: true, text: 'Litros' },
        grid:     { color: 'rgba(0,0,0,0.05)' },
      },
      y2: {
        type:     'linear' as const,
        position: 'right' as const,
        title:    { display: true, text: 'Gasto ($)' },
        grid:     { drawOnChartArea: false },
      },
      y3: {
        type:     'linear' as const,
        position: 'right' as const,
        display:  false,
        grid:     { drawOnChartArea: false },
      },
      x: { grid: { display: false } },
    },
  };

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin datos de tendencia disponibles
      </div>
    );
  }

  return <Line data={chartData} options={options} />;
}
