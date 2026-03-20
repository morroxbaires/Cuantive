import { useState, useEffect, useCallback } from 'react';
import { alertsService, AlertPayload } from '@/services/alerts.service';
import { Alert, AlertNotification } from '@/types';

export function useAlerts() {
  const [alerts,        setAlerts]        = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [alertsRes, notifRes] = await Promise.all([
        alertsService.getAll(),
        alertsService.getNotifications(),
      ]);
      setAlerts(alertsRes.data);
      setNotifications(notifRes.data);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: AlertPayload) => {
    const a = await alertsService.create(payload);
    await fetch();
    return a;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<AlertPayload>) => {
    const a = await alertsService.update(id, payload);
    await fetch();
    return a;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await alertsService.delete(id);
    await fetch();
  }, [fetch]);

  const markRead = useCallback(async (id: string) => {
    await alertsService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await alertsService.markAllRead();
    await fetch();
  }, [fetch]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return {
    alerts, notifications, unreadCount, loading, error,
    refetch: fetch, create, update, remove, markRead, markAllRead,
  };
}
