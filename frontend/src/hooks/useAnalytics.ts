import { useState, useEffect, useCallback } from 'react';
import { analyticsService, AnalyticsDashboard, DateRange } from '@/services/analytics.service';
import { subMonths, format } from 'date-fns';

const DEFAULT_RANGE: DateRange = {
  from: format(subMonths(new Date(), 2), 'yyyy-MM-dd'),
  to:   format(new Date(), 'yyyy-MM-dd'),
};

export function useAnalytics(initialRange?: DateRange) {
  const [range,   setRange]   = useState<DateRange>(initialRange ?? DEFAULT_RANGE);
  const [data,    setData]    = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async (r: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyticsService.getDashboard(r);
      setData(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar datos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(range); }, [range, fetch]);

  const updateRange = (newRange: DateRange) => setRange(newRange);
  const refresh     = () => fetch(range);

  return { data, loading, error, range, updateRange, refresh };
}
