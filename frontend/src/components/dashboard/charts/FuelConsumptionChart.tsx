'use client';

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, LineElement, PointElement, Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement, Filler);

interface DataPoint { month: string; totalCost: number; totalLiters: number }

interface Props {
  data: DataPoint[];
}

export function FuelConsumptionChart({ data }: Props) {
  const labels   = data.map((d) => d.month);
  const costData = data.map((d) => d.totalCost);
  const litData  = data.map((d) => d.totalLiters);

  const chartData = {
    labels,
    datasets: [
      {
        label:            'Costo (UYU)',
        data:             costData,
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius:    6,
        borderSkipped:   false,
        yAxisID:         'y',
      },
      {
        label:            'Litros',
        data:             litData,
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderRadius:    6,
        borderSkipped:   false,
        yAxisID:         'y1',
      },
    ],
  };

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    interaction:         { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position:  'top' as const,
        align:     'end' as const,
        labels: { boxWidth: 10, boxHeight: 10, borderRadius: 4, useBorderRadius: true, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        padding: 12,
        titleFont: { size: 12 },
        bodyFont:  { size: 11 },
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) => {
            if ((ctx.dataset.label ?? '').includes('Costo')) return ` UYU ${ctx.parsed.y.toLocaleString('es-UY')}`;
            return ` ${ctx.parsed.y.toLocaleString('es-UY')} L`;
          },
        },
      },
    },
    scales: {
      x:  { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
      y:  { position: 'left'  as const, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
      y1: { position: 'right' as const, grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, color: '#10b981' } },
    },
  };

  return <Bar data={chartData} options={options} />;
}
