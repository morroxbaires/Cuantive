import api from './api';

// ─── Tipos espejando el backend ─────────────────────────────────────────────

export interface DateRange {
  from?: string;
  to?: string;
  vehicleId?: string;
}

export interface ConsumptionRow {
  vehicleId:           string;
  plate:               string;
  vehicleName:         string;
  efficiencyReference: number | null;
  loadCount:           number;
  avgKmPerUnit:        number | null;
  totalLiters:         number;
  totalCost:           number;
  deviationPct:        number | null;
  anomaly:             boolean;
}

export interface VehicleCostRow {
  vehicleId:      string;
  plate:          string;
  vehicleName:    string;
  totalFuelCost:  number;
  totalMaintCost: number;
  totalCost:      number;
  totalLiters:    number;
  totalKm:        number;
  costPerKm:      number | null;
  avgKmPerUnit:   number | null;
}

export interface DriverAnomalyRow {
  driverId:            string;
  driverName:          string;
  loadCount:           number;
  avgKmPerUnit:        number | null;
  totalCost:           number;
  totalLiters:         number;
  avgVehicleReference: number | null;
  deviationPct:        number | null;
  anomaly:             boolean;
}

export interface MaintenancePredictionRow {
  vehicleId:           string;
  plate:               string;
  vehicleName:         string;
  currentOdometer:     number;
  lastMaintenanceDate: string | null;
  description:         string | null;
  nextServiceKm:       number | null;
  nextServiceDate:     string | null;
  kmRemaining:         number | null;
  daysRemaining:       number | null;
  urgencyScore:        number;
  urgencyLevel:        'critical' | 'warning' | 'ok';
}

export interface IrregularLoadRow {
  id:          string;
  date:        string;
  plate:       string;
  vehicleName: string;
  driverName:  string | null;
  kmPerUnit:   number;
  vehicleAvg:  number;
  zScore:      number;
  liters:      number;
  priceTotal:  number | null;
  anomalyType: 'under' | 'over';
}

export interface FuelTrendMonthRow {
  month:           string;
  totalLiters:     number;
  totalCost:       number;
  loadCount:       number;
  activeVehicles:  number;
  avgCostPerLiter: number | null;
}

export interface OverviewStats {
  totalVehicles:     number;
  activeVehicles:    number;
  totalFuelCost:     number;
  totalMaintCost:    number;
  totalCost:         number;
  totalLiters:       number;
  fleetAvgKmPerUnit: number | null;
  anomalyVehicles:   number;
  anomalyDrivers:    number;
  upcomingMaint:     number;
  irregularLoads:    number;
}

export interface AnalyticsDashboard {
  overview:              OverviewStats;
  consumption:           ConsumptionRow[];
  costsByVehicle:        VehicleCostRow[];
  driverAnomalies:       DriverAnomalyRow[];
  maintenancePrediction: MaintenancePredictionRow[];
  fuelTrend:             FuelTrendMonthRow[];
  irregularLoads:        IrregularLoadRow[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

function rangeParams(r?: DateRange) {
  const p = new URLSearchParams();
  if (r?.from)      p.set('from',      r.from);
  if (r?.to)        p.set('to',        r.to);
  if (r?.vehicleId) p.set('vehicleId', r.vehicleId);
  return p.toString() ? `?${p}` : '';
}

export const analyticsService = {
  getDashboard: (range?: DateRange) =>
    api.get<{ success: boolean; data: AnalyticsDashboard }>(`/analytics/dashboard${rangeParams(range)}`).then(r => r.data.data),

  getOverview: (range?: DateRange) =>
    api.get<{ success: boolean; data: OverviewStats }>(`/analytics/overview${rangeParams(range)}`).then(r => r.data.data),

  getConsumption: (range?: DateRange) =>
    api.get<{ success: boolean; data: ConsumptionRow[] }>(`/analytics/consumption${rangeParams(range)}`).then(r => r.data.data),

  getCosts: (range?: DateRange) =>
    api.get<{ success: boolean; data: VehicleCostRow[] }>(`/analytics/costs${rangeParams(range)}`).then(r => r.data.data),

  getDriverAnomalies: (range?: DateRange) =>
    api.get<{ success: boolean; data: DriverAnomalyRow[] }>(`/analytics/driver-anomalies${rangeParams(range)}`).then(r => r.data.data),

  getMaintenancePrediction: () =>
    api.get<{ success: boolean; data: MaintenancePredictionRow[] }>('/analytics/maintenance-prediction').then(r => r.data.data),

  getFuelTrend: (months = 6) =>
    api.get<{ success: boolean; data: FuelTrendMonthRow[] }>(`/analytics/fuel-trend?months=${months}`).then(r => r.data.data),

  getIrregularLoads: (range?: DateRange, z = 1.5, limit = 30) => {
    const p = new URLSearchParams();
    if (range?.from) p.set('from', range.from);
    if (range?.to)   p.set('to',   range.to);
    p.set('z', String(z));
    p.set('limit', String(limit));
    return api.get<{ success: boolean; data: IrregularLoadRow[] }>(`/analytics/irregular-loads?${p}`).then(r => r.data.data);
  },
};
