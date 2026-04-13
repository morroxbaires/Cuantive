// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:                 string;
  name:               string;
  email:              string;
  role:               'superroot' | 'admin';
  companyId:          string | null;
  companyName:        string | null;
  canDownloadMetrics: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user:        AuthUser;
}

// ─── Company ──────────────────────────────────────────────────────────────────
export interface Company {
  id:        string;
  name:      string;
  rut:       string;
  email?:    string;
  phone?:    string;
  logo?:     string;
  active:    boolean;
  createdAt: string;
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────
export interface VehicleType {
  id:   number;
  name: string;
}

export interface Vehicle {
  id:                  string;
  plate:               string;
  name?:               string;
  brand:               string;
  model:               string;
  year:                number;
  color?:              string;
  currentOdometer:     number;
  coachNumber?:        string;
  active:              boolean;
  createdAt:           string;
  vehicleType?:        VehicleType;
  vehicleTypeId?:      number;
  fuelTypeId?:         number;
  fuelType?:           FuelType;
  efficiencyReference?: number | null;
  drivers?:            Array<{ id: string; name: string; lastname: string; document: string; active: boolean }>;
}

// ─── Driver ───────────────────────────────────────────────────────────────────
export interface Driver {
  id:               string;
  name:             string;
  lastname:         string;
  document:         string;
  licenseCategory:  string;
  licenseExpiry:    string;
  phone?:           string;
  email?:           string;
  active:           boolean;
  createdAt:        string;
  // días hasta vencimiento de licencia (calculado en UI)
  daysToExpiry?:    number;
  // vehículos asignados via VehicleDriver join table
  vehicles?:        Array<{ vehicle: { id: string; plate: string; name?: string } }>;
}

// ─── FuelType ─────────────────────────────────────────────────────────────────
export interface FuelType {
  id:   number;
  name: string;
  unit: 'litros' | 'kwh';
}

// ─── FuelLoad ─────────────────────────────────────────────────────────────────
export interface FuelLoad {
  id:           string;
  date:         string;
  litersOrKwh:  number;
  unitPrice?:   number;
  priceTotal?:  number;
  odometer?:    number;
  kmPerUnit?:   number;
  station?:     string;
  notes?:       string;
  createdAt:    string;
  vehicle?:     Vehicle;
  vehicleId:    string;
  driver?:      Driver;
  driverId?:    string;
  fuelType?:    FuelType;
  fuelTypeId?:  number;
}

export interface FuelStats {
  totalCost:           number;
  totalLiters:         number;
  totalLitersFuel:     number;   // litros consumed (nafta/gasoil)
  totalKwhElec:        number;   // kWh consumed (electric)
  avgKmPerLiter:       number;   // combined average (legacy)
  avgKmPerLiterFuel:   number;   // km/L for fuel loads only
  avgKmPerKwhElec:     number;   // km/kWh for electric loads only
  loadsCount:          number;
  costByVehicle:       { vehicleId: string; plate: string; totalCost: number; totalLiters: number }[];
  monthlyTrend:        { month: string; totalCost: number; totalLiters: number }[];
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Maintenance {
  id:           string;
  date:         string;
  type:         string;
  description:  string;
  cost:         number;
  odometer?:    number;
  status:       MaintenanceStatus;
  workshopName?: string;
  nextDate?:    string;
  nextOdometer?: number;
  notes?:       string;
  createdAt:    string;
  vehicle?:     Vehicle;
  vehicleId:    string;
  driver?:      Driver;
  driverId?:    string;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export type AlertType    = 'license_expiry' | 'maintenance_due' | 'odometer_threshold' | 'fuel_anomaly' | 'custom';
export type AlertChannel = 'in_app' | 'email' | 'sms';

export interface Alert {
  id:        string;
  name:      string;
  type:      AlertType;
  channel:   AlertChannel;
  active:    boolean;
  config:    Record<string, unknown>;
  createdAt: string;
  vehicle?:  Vehicle;
  vehicleId?: string;
}

export interface AlertNotification {
  id:        string;
  message:   string;
  readAt?:   string;
  createdAt: string;
  alert?:    Alert;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalVehicles:          number;
  activeVehicles:         number;
  totalDrivers:           number;
  driversWithExpiryAlert: number;
  activeAlerts:           number;
  unreadNotifications:    number;
  monthlyFuelCost:        number;
  monthlyMaintenanceCost:  number;
  avgKmPerLiter:           number;
  costByVehicle:           { vehicleId: string; plate: string; brand: string; model: string; totalCost: number }[];
  consumptionTrend:        { month: string; totalLiters: number; totalCost: number }[];
  vehiclesWithAnomalies:   number;
}

// ─── VehicleDocument ──────────────────────────────────────────────────────────
export type DocumentType = 'insurance' | 'registration' | 'permit' | 'inspection';
export type DocumentStatus = 'active' | 'expiring' | 'expired';

export interface VehicleDocument {
  id:             string;
  vehicleId:      string;
  documentType:   DocumentType;
  documentNumber?: string;
  issueDate?:      string;
  expirationDate?: string;
  fileUrl?:        string;
  notes?:          string;
  createdAt:       string;
  vehicle?: {
    id: string; plate: string; brand?: string; model?: string;
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface Settings {
  id:              string;
  timezone:        string;
  currency:        string;
  dateFormat:      string;
  fuelAlertDays:   number;
  licenseAlertDays: number;
  maintenanceAlertDays: number;
  fuelPrice?:       number | null;
  gasoilPrice?:     number | null;
  electricityPrice?: number | null;
  alertDaysBeforeLicense?: number | null;
  alertDaysBeforeMaint?:   number | null;
  alertKmBeforeMaint?:     number | null;
  alertFuelExcessPct?:     number | null;
  alertNoLoadDays?:        number | null;
  company?:        Company;
}

// ─── API Generic ──────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data:    T[];
  meta: {
    total:    number;
    page:     number;
    limit:    number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  statusCode?: number;
}

// ─── Superadmin ───────────────────────────────────────────────────────────────
export interface AdminCompany {
  id:        string;
  name:      string;
  tradeName: string | null;
  rut:       string;
  city:      string;
  phone:     string;
  email:     string;
  address:   string;
  active:    boolean;
  createdAt: string;
  _count: {
    vehicles: number;
    drivers:  number;
  };
}

export interface AdminWithCompany {
  id:                 string;
  name:               string;
  email:              string;
  active:             boolean;
  lastLogin:          string | null;
  createdAt:          string;
  canDownloadMetrics: boolean;
  company:            AdminCompany | null;
}

export interface SuperadminDashboard {
  totalCompanies:  number;
  totalAdmins:     number;
  activeAdmins:    number;
  inactiveAdmins:  number;
  recentLogins:    AdminWithCompany[];
}

export interface AdminListResponse {
  data:  AdminWithCompany[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface CreateAdminPayload {
  adminName:          string;
  adminEmail:         string;
  adminPassword:      string;
  companyName:        string;
  companyRut?:        string;
  companyCity?:       string;
  companyPhone?:      string;
  companyEmail?:      string;
  companyAddress?:    string;
  canDownloadMetrics?: boolean;
}

export type UpdateAdminPayload = Partial<CreateAdminPayload>;

// ─── UI ───────────────────────────────────────────────────────────────────────
export type SortDirection = 'asc' | 'desc';

// ─── Turno ────────────────────────────────────────────────────────────────────
export interface Turno {
  id:           string;
  vehicleId:    string;
  driverId:     string;
  shiftDate:    string;   // ISO date
  shiftNumber:  number;
  totalFichas:  number;
  kmOcupados:   number;
  kmLibres:     number;
  kmTotales:    number;   // calculated: kmOcupados + kmLibres
  notes?:       string;
  createdAt:    string;
  vehicle?:     { id: string; plate: string; brand?: string; model?: string };
  driver?:      { id: string; name: string; lastname: string; document?: string };
}

export interface TurnoStats {
  totalTurnos:     number;
  totalFichas:     number;
  totalKmOcupados: number;
  totalKmLibres:   number;
  totalKmTotales:  number;
  avgFichas:       number;
  avgKmTotales:    number;
  eficienciaKm:    number; // %
}

export interface TableColumn<T> {
  key:       keyof T | string;
  label:     string;
  render?:   (row: T) => React.ReactNode;
  sortable?: boolean;
  width?:    string;
}

// ─── Siniestro / Daño ────────────────────────────────────────────────────────
export interface Siniestro {
  id:            string;
  vehicleId?:    string;
  driverId?:     string;
  fecha?:        string;  // ISO date
  hora?:         string;  // ISO datetime (base 2000-01-01, only time matters)
  observaciones?: string;
  costo?:        number;
  estado:        'PENDIENTE' | 'EN_PROCESO' | 'CERRADO' | 'RECHAZADO';
  tipo?:         'CHOQUE' | 'RASPADURA' | 'ROBO' | 'VANDALISMO' | 'INCENDIO' | 'OTRO';
  imageFile?:    string;  // file UUID
  createdAt:     string;
  vehicle?:      { id: string; plate: string; name?: string };
  driver?:       { id: string; name: string; lastname: string };
  image?:        { id: string; originalName: string; storagePath: string };
}

export interface SiniestroStats {
  totalCost:  number;
  totalCount: number;
  byVehicle:  { vehicleId: string; plate: string; count: number; total: number }[];
  byDriver:   { driverId: string; name: string;   count: number; total: number }[];
}

export interface DriverSiniestroRankingRow {
  position:   number;
  driverId:   string;
  driver:     string;
  totalCost:  number;
  totalCount: number;
}

// ─── SATISFACCIÓN ─────────────────────────────────────────────────────────────

export interface Satisfaccion {
  id:            string;
  vehicleId?:    string;
  fecha?:        string;
  hora?:         string;
  puntuacion?:   number;
  observaciones?: string;
  imageFile?:    string;
  source:        'manual' | 'qr';
  createdAt:     string;
  vehicle?: { id: string; plate: string; name?: string };
  image?:   { id: string; originalName: string; storagePath: string };
}

export interface VehicleSatisfaccionStats {
  vehicleId: string;
  plate:     string;
  name:      string;
  avgScore:  number;
  count:     number;
}

export interface SatisfaccionStats {
  overallAvg:   number | null;
  totalReviews: number;
  bestVehicle:  VehicleSatisfaccionStats | null;
  worstVehicle: VehicleSatisfaccionStats | null;
  byVehicle:    VehicleSatisfaccionStats[];
}
