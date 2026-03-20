/**
 * kpi-dashboard.service.ts
 *
 * Thin wrapper around GET /api/analytics/kpi-dashboard?month=YYYY-MM
 * Mirrors the backend KpiDashboardData shape so the frontend stays typed.
 */
import api from './api';

// ─── KPI output shape (matches analytics_engine StandardKPIOutput) ────────────

export interface StandardKPIOutput {
  name:            string;
  label:           string;
  description?:    string;
  formula?:        string;
  value:           number | null;
  formatted:       string;
  unit?:           string;
  trend?:          string | null;
  trendPct?:       number | null;
  trendDirection?: 'up' | 'down' | 'flat' | 'no_data';
  period:          string;
  periodLabel?:    string;
  previousValue?:  number | null;
  /** 'ok' | 'warning' | 'critical' | 'no_data' */
  status:          'ok' | 'warning' | 'critical' | 'no_data';
  computedAt?:     string;
  detail?:         unknown;
}

// ─── Smart alert shapes (matches alert_notifications.ts) ─────────────────────

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertCategory = 'fuel' | 'maintenance' | 'cost' | 'availability' | 'utilization' | 'compliance' | 'driver';

export interface SmartAlert {
  type:          string;
  vehicle_id?:   string;
  plate?:        string;
  severity:      AlertSeverity;
  message:       string;
  value?:        number | null;
  threshold?:    number | null;
  rule_id:       string;
  rule_name:     string;
  category:      AlertCategory;
  generated_at:  string;
  meta?:         Record<string, unknown>;
}

export interface SmartAlertSummary {
  total:    number;
  critical: number;
  high:     number;
  medium:   number;
  low:      number;
  byCategory: Record<string, number>;
}

// ─── Full dashboard payload ───────────────────────────────────────────────────

export interface KpiDashboardData {
  month:         string;
  fleetCost:     StandardKPIOutput[];   // 5 KPIs
  fuel:          StandardKPIOutput[];   // 4 KPIs
  maintenance:   StandardKPIOutput[];   // 5 KPIs
  availability:  StandardKPIOutput[];   // 2 KPIs
  utilization:   StandardKPIOutput[];   // 3 KPIs
  alerts:        SmartAlert[];
  alertSummary:  SmartAlertSummary;
  generatedAt:   string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const kpiDashboardService = {
  /**
   * Fetch all KPI data for the given month (defaults to current month).
   */
  async getAll(month?: string): Promise<KpiDashboardData> {
    const m = month ?? currentMonth();
    const response = await api.get<{ success: boolean; data: KpiDashboardData }>(
      `/analytics/kpi-dashboard?month=${m}`,
    );
    return response.data.data;
  },
};
