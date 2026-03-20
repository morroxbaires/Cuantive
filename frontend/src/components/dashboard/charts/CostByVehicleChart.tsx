'use client';

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CostEntry { plate: string; totalCost: number }

interface Props { data: CostEntry[]; }

const COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
  '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899',
];

export function CostByVehicleChart({ data }: Props) {
  const chartData = {
    labels:   data.map((d) => d.plate),
    datasets: [{
      data:                  data.map((d) => d.totalCost),
      backgroundColor:       COLORS.slice(0, data.length),
      borderWidth:           0,
      hoverOffset:           6,
    }],
  };

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    cutout:              '68%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels:   { boxWidth: 10, boxHeight: 10, borderRadius: 4, useBorderRadius: true, font: { size: 11 }, padding: 12 },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        callbacks: {
          label: (ctx: { parsed: number }) => ` ${formatCurrency(ctx.parsed)}`,
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}
