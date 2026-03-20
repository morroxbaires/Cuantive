import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2,
  ChevronDown,
  Truck, Fuel, Wrench, Users, BarChart3, Bell,
  TrendingUp, Zap, Shield, Clock, Star, Play,
  Activity, DollarSign, AlertTriangle, MapPin,
} from 'lucide-react';
import { CuantiveLogo } from '@/components/CuantiveLogo';

export const metadata: Metadata = {
  title: 'Cuantive — Operational Intelligence para tu flota',
  alternates: { canonical: 'https://cuantive.com' },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const stats = [
  { value: '+500', label: 'Vehículos gestionados', icon: Truck },
  { value: '98%',  label: 'Uptime garantizado',    icon: Zap },
  { value: '-22%', label: 'Reducción en costos',   icon: TrendingUp },
  { value: '24/7', label: 'Monitoreo continuo',    icon: Activity },
];

const features = [
  {
    icon:  Truck,
    title: 'Control total de vehículos',
    desc:  'Registra toda tu flota: marcas, modelos, odómetro y documentación. Estado activo/inactivo en tiempo real.',
    color: 'blue',
  },
  {
    icon:  Fuel,
    title: 'Cargas de combustible',
    desc:  'Registra cada carga con cálculo automático de km/litro. Detecta anomalías de consumo al instante.',
    color: 'cyan',
  },
  {
    icon:  Wrench,
    title: 'Mantenimiento predictivo',
    desc:  'Programa mantenimientos preventivos y correctivos. Recibe alertas antes de que el vehículo falle.',
    color: 'blue',
  },
  {
    icon:  Users,
    title: 'Gestión de conductores',
    desc:  'Control de licencias, vencimientos y asignaciones. Detecta qué conductor genera más gasto.',
    color: 'cyan',
  },
  {
    icon:  BarChart3,
    title: 'Analítica inteligente',
    desc:  'Dashboards con costo por km, consumo promedio, tendencias mensuales y comparativas por vehículo.',
    color: 'blue',
  },
  {
    icon:  Bell,
    title: 'Alertas automáticas',
    desc:  'Notificaciones configurables para vencimientos, anomalías y mantenimientos próximos por email o app.',
    color: 'cyan',
  },
];

const steps = [
  {
    num: '01',
    title: 'Registrá tu flota',
    desc:   'Cargá tus vehículos, conductores y datos de referencia en minutos. Importación masiva disponible.',
    detail: 'Sin instalaciones. Desde el navegador, en cualquier dispositivo.',
  },
  {
    num: '02',
    title: 'Registrá cargas y mantenimientos',
    desc:   'Capturá cada carga de combustible, mantenimiento y gasto. Adjuntá comprobantes digitalizados.',
    detail: 'Cálculo automático de km/litro y detección de anomalías.',
  },
  {
    num: '03',
    title: 'Tomá decisiones con datos',
    desc:   'Accedé a reportes de costo por vehículo, conductores eficientes y predicciones de mantenimiento.',
    detail: 'Reducí costos con información real, no estimaciones.',
  },
];

const faqs = [
  { q: '¿Necesito instalar algo?',           a: 'No. Cuantive es 100% web. Funciona desde cualquier navegador moderno, tablet o smartphone, sin instalaciones.' },
  { q: '¿Mis datos están seguros?',           a: 'Sí. Todos los datos se encriptan en tránsito (HTTPS) y en reposo. Backups automáticos diarios. Datos hosted en Uruguay.' },
  { q: '¿Puedo migrar mi información existente?', a: 'Podés importar vehículos, conductores y registros históricos desde Excel/CSV. Te ayudamos en el proceso.' },
  { q: '¿Qué pasa si necesito más vehículos?', a: 'Podés hacer upgrade en cualquier momento desde el panel de configuración. Los cambios aplican de inmediato.' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A1628]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" aria-label="Cuantive inicio">
          <CuantiveLogo size="sm" dark />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#beneficios"    className="text-sm text-slate-400 transition-colors hover:text-white">Funcionalidades</a>
          <a href="#como-funciona" className="text-sm text-slate-400 transition-colors hover:text-white">Cómo funciona</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-900/30 transition-all hover:bg-blue-500 hover:shadow-lg md:flex"
          >
            Iniciar sesión
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function DashboardMockup() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0F1E35] shadow-2xl shadow-black/60">
      {/* Window chrome */}
      <div className="flex h-8 items-center gap-1.5 border-b border-white/5 bg-[#0A1628] px-4">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        <div className="mx-auto h-4 w-48 rounded bg-white/5 text-center text-[9px] leading-4 text-white/20">app.cuantive.com/dashboard</div>
      </div>
      <div className="flex" style={{ minHeight: '280px' }}>
        {/* Sidebar */}
        <div className="hidden w-36 flex-shrink-0 border-r border-white/5 bg-[#091223] p-3 sm:block">
          <div className="mb-4 flex items-center gap-1.5 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600/80">
              <div className="h-2.5 w-2.5 rounded-sm bg-white/80" />
            </div>
            <span className="text-[9px] font-bold text-white/80">CUANTIVE</span>
          </div>
          {['Dashboard','Analítica','Vehículos','Conductores','Cargas','Mantenimiento','Alertas'].map((item, i) => (
            <div key={item} className={`mb-0.5 flex items-center gap-1.5 rounded px-2 py-1.5 ${i === 0 ? 'bg-blue-600/20' : ''}`}>
              <div className={`h-2 w-2 flex-shrink-0 rounded-sm ${i === 0 ? 'bg-blue-400' : 'bg-white/15'}`} />
              <span className={`truncate text-[9px] ${i === 0 ? 'font-semibold text-blue-300' : 'text-white/35'}`}>{item}</span>
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 space-y-2.5 p-3">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { l:'Vehículos',  v:'42',    c:'text-white' },
              { l:'Conductores',v:'38',    c:'text-white' },
              { l:'Alertas',    v:'3',     c:'text-red-400' },
              { l:'Costo/mes',  v:'$284k', c:'text-emerald-400' },
            ].map(({ l, v, c }) => (
              <div key={l} className="rounded-lg border border-white/5 bg-white/4 p-2">
                <p className="mb-0.5 text-[8px] text-white/35">{l}</p>
                <p className={`text-xs font-bold ${c}`}>{v}</p>
              </div>
            ))}
          </div>
          {/* Charts */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 rounded-lg border border-white/5 bg-white/4 p-2.5">
              <p className="mb-2 text-[8px] font-medium text-white/40">Consumo mensual (L)</p>
              <div className="flex h-20 items-end gap-1 pb-1">
                {[38,55,42,70,48,62,80,54,68,76,45,88].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${h}%`,
                      background: i === 11
                        ? 'linear-gradient(to top,#2563EB,#60A5FA)'
                        : i >= 9
                        ? 'rgba(37,99,235,0.35)'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/4 p-2">
              <p className="self-start text-[8px] text-white/40">Por vehículo</p>
              <div className="relative h-14 w-14">
                <svg viewBox="0 0 60 60" className="-rotate-90">
                  <circle cx="30" cy="30" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle cx="30" cy="30" r="22" fill="none" stroke="#2563EB" strokeWidth="8" strokeDasharray="83,55" />
                  <circle cx="30" cy="30" r="22" fill="none" stroke="#60A5FA" strokeWidth="8" strokeDasharray="30,108" strokeDashoffset="-83" />
                  <circle cx="30" cy="30" r="22" fill="none" stroke="#5BBDE4" strokeWidth="8" strokeDasharray="25,113" strokeDashoffset="-113" />
                </svg>
              </div>
              <div className="w-full space-y-0.5 self-start px-1">
                {[['#2563EB','Camiones'],['#60A5FA','Autos'],['#5BBDE4','Otros']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: c }} />
                    <span className="truncate text-[7px] text-white/40">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Alerts */}
          <div className="rounded-lg border border-white/5 bg-white/4 p-2">
            <p className="mb-1.5 text-[8px] font-medium text-white/40">Alertas recientes</p>
            <div className="space-y-1">
              {[
                { t:'Mantenimiento vencido', p:'ABC-1234', c:'bg-red-500/70' },
                { t:'Licencia próxima',      p:'Juan R.',  c:'bg-amber-500/70' },
                { t:'Consumo anómalo',       p:'DEF-5678', c:'bg-blue-500/70' },
              ].map(({ t, p, c }) => (
                <div key={t} className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${c}`} />
                  <span className="text-[8px] text-white/50">{t}</span>
                  <span className="ml-auto text-[8px] text-white/25">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Navbar />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen overflow-hidden bg-[#0A1628] pb-24 pt-32">
        <div className="absolute inset-0 bg-grid opacity-100" />
        <div className="pointer-events-none absolute -top-20 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-700/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-4 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-blue-300">Plataforma SaaS para gestión de flotas</span>
            </div>

            <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              Control total de tu flota{' '}
              <span className="gradient-text">con inteligencia operativa</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Gestioná vehículos, conductores, combustible y mantenimiento desde un único dashboard.
              Reducí costos con datos reales, no estimaciones.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 hover:shadow-xl"
              >
                Empezar gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#como-funciona"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-base font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
              >
                <Play className="h-4 w-4" />
                Ver cómo funciona
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              {['Sin tarjeta de crédito', 'Setup en 5 minutos', 'Cancela cuando quieras'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {t}
                </span>
              ))}
            </div>

            <div className="relative mt-16 w-full max-w-5xl">
              <div className="absolute -bottom-8 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl" />
              {/* floating badges */}
              <div className="absolute -left-4 top-16 z-10 hidden rounded-xl border border-white/10 bg-[#0F1E35]/90 px-3 py-2 shadow-xl backdrop-blur-sm sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400">Ahorro promedio</p>
                    <p className="text-xs font-bold text-white">-22% en costos</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 bottom-16 z-10 hidden rounded-xl border border-white/10 bg-[#0F1E35]/90 px-3 py-2 shadow-xl backdrop-blur-sm sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
                    <Bell className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400">Alertas activas</p>
                    <p className="text-xs font-bold text-white">3 nuevas hoy</p>
                  </div>
                </div>
              </div>
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-white px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</span>
                <span className="text-sm text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="beneficios" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <span className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
              Todo lo que necesitás
            </span>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Una plataforma completa para tu operación
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Diseñado para empresas que quieren datos concretos, no planillas de Excel.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-7 shadow-card transition-all hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-card-lg"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-50 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${color === 'cyan' ? 'bg-cyan-50' : 'bg-blue-50'}`}>
                  <Icon className={`h-5 w-5 ${color === 'cyan' ? 'text-cyan-500' : 'text-blue-600'}`} />
                </div>
                <h3 className="mb-2.5 text-base font-semibold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ───────────────────────────────────────────────────── */}
      <section id="como-funciona" className="overflow-hidden bg-[#0A1628] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <span className="mb-3 inline-block rounded-full border border-blue-500/20 bg-blue-500/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
              Proceso simple
            </span>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Comenzá en 3 pasos</h2>
            <p className="mt-4 text-slate-400">Sin integración compleja. Sin consultores. Sin semanas de implementación.</p>
          </div>
          <div className="relative grid gap-8 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-blue-600/30 to-transparent md:block" />
            {steps.map(({ num, title, desc, detail }) => (
              <div key={num} className="relative flex flex-col gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-600/10 shadow-lg shadow-blue-900/20">
                  <span className="text-2xl font-extrabold text-blue-400">{num}</span>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
                  <p className="mb-2 text-sm leading-relaxed text-slate-400">{desc}</p>
                  <p className="text-xs text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD SHOWCASE ──────────────────────────────────────────────── */}
      <section className="bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <span className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">Dashboard</span>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Todo visible, todo controlado</h2>
            <p className="mt-4 text-slate-500">Un dashboard diseñado para la toma de decisiones rápidas.</p>
          </div>
          <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: DollarSign,    title: 'Costo por km',   desc: 'Calculado automáticamente por vehículo y período', color: 'bg-blue-50 text-blue-600' },
              { icon: Activity,      title: 'Consumo real',    desc: 'Comparado contra referencia de eficiencia',       color: 'bg-cyan-50 text-cyan-600' },
              { icon: AlertTriangle, title: 'Anomalías',       desc: 'Detección Z-score de cargas irregulares',         color: 'bg-amber-50 text-amber-600' },
              { icon: MapPin,        title: 'Mantenimiento',   desc: 'Predicción de urgencia basada en km y fechas',    color: 'bg-emerald-50 text-emerald-600' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mb-1 font-semibold text-slate-900">{title}</p>
                <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-[#122040] bg-[#0A1628] p-2 shadow-2xl shadow-black/40">
            <div className="absolute inset-0 bg-grid opacity-50" />
            <div className="relative"><DashboardMockup /></div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-slate-900">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-slate-200 bg-white shadow-card open:shadow-card-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-sm font-semibold text-slate-900 hover:text-blue-700">
                  {q}
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t border-slate-100 px-6 py-4 text-sm leading-relaxed text-slate-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1628] px-6 py-24">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-700/10 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <CuantiveLogo size="lg" dark />
          </div>
          <h2 className="mb-5 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            Tomá el control de tu flota{' '}
            <span className="gradient-text">hoy mismo</span>
          </h2>
          <p className="mb-10 text-lg text-slate-400">
            Más de 500 vehículos ya son gestionados con Cuantive.
            Comenzá tu prueba gratuita en menos de 5 minutos.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="group flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 hover:shadow-xl"
            >
              Empezar gratis ahora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
              Ya tengo cuenta → Iniciar sesión
            </Link>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2">
            {[1,2,3,4,5].map(s => <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
            <span className="ml-2 text-sm text-slate-400">"La mejor inversión operativa que hicimos"</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#060D1A] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <CuantiveLogo size="sm" dark />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
                Plataforma de gestión inteligente de flotas para empresas en Uruguay y la región.
              </p>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Producto</p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Funcionalidades', href: '#beneficios' },
                  { label: 'Cómo funciona',   href: '#como-funciona' },
                  { label: 'Dashboard',       href: '/login' },
                ].map(({ label, href }) => (
                  <li key={label}><a href={href} className="text-sm text-slate-500 transition-colors hover:text-slate-300">{label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Empresa</p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Sobre Cuantive', href: '#' },
                  { label: 'Blog',           href: '#' },
                  { label: 'Contacto',       href: 'mailto:hola@cuantive.com' },
                ].map(({ label, href }) => (
                  <li key={label}><a href={href} className="text-sm text-slate-500 transition-colors hover:text-slate-300">{label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Legal</p>
              <ul className="space-y-2.5">
                {['Privacidad','Términos','Seguridad'].map(l => (
                  <li key={l}><a href="#" className="text-sm text-slate-500 transition-colors hover:text-slate-300">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
            <p className="text-xs text-slate-600">© 2026 Cuantive. Todos los derechos reservados. Hecho en Uruguay 🇺🇾</p>
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Shield className="h-3 w-3" />
              <span>Datos protegidos · SSL · Backups diarios</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
