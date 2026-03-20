'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?:    'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?:    React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const variants = {
      primary:   'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 shadow-sm',
      secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400',
      ghost:     'text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
      danger:    'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400 shadow-sm',
      outline:   'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 shadow-sm',
    };

    const sizes = {
      sm:  'text-xs px-3 py-1.5 gap-1.5',
      md:  'text-sm px-4 py-2',
      lg:  'text-sm px-5 py-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
