'use client';

import { cn } from '@/lib/utils';

interface TooltipProps {
  text:      string;
  children:  React.ReactNode;
  className?: string;
  /** 'top' (default) | 'bottom' */
  position?: 'top' | 'bottom';
  /** Max width class, default 'max-w-[240px]' */
  width?:    string;
}

/**
 * Lightweight CSS-only tooltip wrapper.
 * Wraps children in a `relative group` span; tooltip appears on hover.
 */
export function Tooltip({ text, children, className, position = 'top', width = 'max-w-[240px]' }: TooltipProps) {
  const isTop = position === 'top';
  return (
    <span className={cn('group relative inline-flex items-center gap-1 cursor-default', className)}>
      {children}
      <span
        className={cn(
          // positioning
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2',
          isTop ? 'bottom-full mb-2' : 'top-full mt-2',
          // appearance
          width,
          'rounded-lg bg-slate-800 px-3 py-2 text-xs leading-relaxed text-white shadow-xl',
          // animation
          'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
          // prevent wrapping issues
          'whitespace-normal text-left',
        )}
      >
        {text}
        {/* Arrow */}
        <span
          className={cn(
            'absolute left-1/2 -translate-x-1/2 border-4 border-transparent',
            isTop
              ? 'top-full border-t-slate-800'
              : 'bottom-full border-b-slate-800',
          )}
        />
      </span>
    </span>
  );
}

/** Small info icon that acts as the tooltip trigger alongside a label */
export function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3 w-3 flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v5M8 5.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Z" strokeWidth="1.5" strokeLinecap="round" stroke="currentColor" fill="none" />
    </svg>
  );
}
