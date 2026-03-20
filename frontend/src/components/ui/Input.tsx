'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
  hint?:    string;
  leading?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leading, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {leading && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leading}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900',
              'placeholder:text-slate-400 transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400',
              'disabled:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70',
              'read-only:bg-slate-50 read-only:cursor-default read-only:text-slate-600',
              error
                ? 'border-red-300 focus:ring-red-400 focus:border-red-400'
                : 'border-slate-200 hover:border-slate-300',
              leading && 'pl-9',
              className,
            )}
            {...props}
          />
        </div>
        {error  && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
