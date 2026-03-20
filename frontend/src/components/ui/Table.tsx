'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key:      string;
  label:    string;
  render?:  (row: T) => React.ReactNode;
  width?:   string;
  align?:   'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns:    Column<T>[];
  data:       T[];
  keyField?:  keyof T;
  loading?:   boolean;
  emptyText?: string;
  // pagination
  page?:        number;
  totalPages?:  number;
  onPageChange?: (page: number) => void;
  // row click
  onRowClick?:  (row: T) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns, data, keyField = 'id' as keyof T, loading, emptyText,
  page, totalPages, onPageChange, onRowClick,
}: TableProps<T>) {
  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide',
                    col.align === 'right'  ? 'text-right'  : '',
                    col.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-slate-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-slate-400">
                  {emptyText ?? 'Sin registros'}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={String(row[keyField]) || i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-t border-slate-50 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-slate-50/70',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-slate-700',
                        col.align === 'right'  ? 'text-right'  : '',
                        col.align === 'center' ? 'text-center' : '',
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : (row[col.key as keyof T] as React.ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages && totalPages > 1 && onPageChange && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange((page ?? 1) - 1)}
              disabled={(page ?? 1) <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors',
                    p === page
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange((page ?? 1) + 1)}
              disabled={(page ?? 1) >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
