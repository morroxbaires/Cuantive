import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Tooltip, InfoIcon } from '@/components/ui/Tooltip';

interface StatCardProps {
  title:      string;
  value:      string | number;
  subtitle?:  string;
  icon:       LucideIcon;
  iconColor?: string;
  iconBg?:    string;
  trend?:     { value: number; label: string };
  className?: string;
  tooltip?:   string;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, trend, className, tooltip }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl bg-white border border-slate-100 shadow-card p-5 flex flex-col gap-4',
      className,
    )}>
      <div className="flex items-start justify-between">
        <div>
          {tooltip ? (
            <Tooltip text={tooltip}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
              <InfoIcon />
            </Tooltip>
          ) : (
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          )}
          <p className="mt-1.5 text-2xl font-bold text-slate-900 leading-none">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
          iconBg ?? 'bg-brand-50',
        )}>
          <Icon className={cn('h-5 w-5', iconColor ?? 'text-brand-600')} />
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-1.5">
          {trend.value >= 0
            ? <TrendingUp  className="h-3.5 w-3.5 text-emerald-500" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          <span className={cn(
            'text-xs font-medium',
            trend.value >= 0 ? 'text-emerald-600' : 'text-red-600',
          )}>
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-slate-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
