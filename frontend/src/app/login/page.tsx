'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, AlertCircle, ArrowRight, Truck, Fuel, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CuantiveLogo } from '@/components/CuantiveLogo';

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type FormValues = z.infer<typeof schema>;

const features = [
  { icon: Truck,     text: 'Control total de vehículos y conductores' },
  { icon: Fuel,      text: 'Análisis de consumo y eficiencia en tiempo real' },
  { icon: BarChart3, text: 'Dashboards con costos, KPIs y alertas automáticas' },
];

export default function LoginPage() {
  const router    = useRouter();
  const { login } = useAuth();
  const [showPass,    setShowPass]    = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }: FormValues) => {
    setServerError(null);
    try {
      const user = await login(email, password);
      router.push(user.role === 'superroot' ? '/superadmin' : '/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? (err as Error)?.message ?? 'Error al iniciar sesión';
      setServerError(msg);
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between bg-gradient-to-br from-[#060D1A] via-[#0A1628] to-[#0F2044] p-14 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-grid opacity-25" />
        <div className="pointer-events-none absolute -top-24 -left-24 h-[500px] w-[500px] rounded-full bg-blue-700/12 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-500/8 blur-[100px]" />

        {/* Logo */}
        <div className="relative z-10">
          <CuantiveLogo size="sm" dark />
        </div>

        {/* Main content */}
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-4 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <span className="text-xs font-medium text-blue-300">Gestión inteligente de flotas</span>
          </div>

          <h2 className="text-[1.75rem] font-bold leading-snug text-white">
            Todo tu operativo,{' '}
            <span className="text-blue-400">en un solo panel.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Combustible, mantenimiento, conductores y analítica operativa integrados y listos para usar.
          </p>

          {/* Feature list */}
          <ul className="mt-8 space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-600/12">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-sm text-slate-300">{text}</span>
              </li>
            ))}
          </ul>

          {/* Stats — 2 cards, Uptime removed */}
          <div className="mt-10 grid grid-cols-2 gap-3">
            {[['42%', 'Ahorro promedio en costos'], ['+500', 'Vehículos ya gestionados']].map(([val, label]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-white/4 p-5 backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-white">{val}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-slate-600" />
          <p className="text-xs text-slate-600">© 2026 Cuantive · Datos protegidos · SSL cifrado</p>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-16">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <CuantiveLogo size="sm" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido de nuevo</h1>
            <p className="mt-1.5 text-sm text-slate-500">Ingresá tus credenciales para acceder al panel</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                placeholder="admin@empresa.com"
                autoComplete="email"
                {...register('email')}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3.5">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-600/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando…
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            ¿Problemas para acceder?{' '}
            <a href="mailto:soporte@cuantive.uy" className="font-medium text-blue-600 transition-colors hover:text-blue-700">
              Contacta soporte
            </a>
          </p>

        </div>
      </div>
    </div>
  );
}
