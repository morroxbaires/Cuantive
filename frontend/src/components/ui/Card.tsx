import { cn } from '@/lib/utils';

interface CardProps {
  children:   React.ReactNode;
  className?: string;
  padding?:   'none' | 'sm' | 'md' | 'lg';
  hover?:     boolean;
}

export function Card({ children, className, padding = 'md', hover }: CardProps) {
  const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div className={cn(
      'rounded-xl bg-white shadow-card border border-slate-100',
      paddings[padding],
      hover && 'transition-shadow duration-200 hover:shadow-card-lg cursor-pointer',
      className,
    )}>
      {children}
    </div>
  );
}

interface CardHeaderProps { title: string; subtitle?: string; action?: React.ReactNode }
export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
