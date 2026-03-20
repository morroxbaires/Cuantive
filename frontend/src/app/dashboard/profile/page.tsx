'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const nameSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresá tu contraseña actual'),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword:  z.string().min(1, 'Confirmá la nueva contraseña'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type NameValues     = z.infer<typeof nameSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

// ─── Reusable field ───────────────────────────────────────────────────────────

function Field({
  label, error, children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

function TextInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${
        error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    />
  );
}

// ─── Feedback banner ─────────────────────────────────────────────────────────

function Banner({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
      type === 'success'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
        : 'border-red-100 bg-red-50 text-red-600'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
        : <AlertCircle  className="mt-0.5 h-4 w-4 flex-shrink-0" />}
      {message}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, description, children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <Icon className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, updateUserName } = useAuth();

  // Name form
  const [nameStatus, setNameStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const {
    register: regName,
    handleSubmit: handleName,
    formState: { errors: nameErrors, isSubmitting: nameSubmitting },
  } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  const onNameSubmit = async ({ name }: NameValues) => {
    setNameStatus(null);
    try {
      await authService.updateProfile(name);
      updateUserName(name);
      setNameStatus({ type: 'success', message: 'Nombre actualizado correctamente.' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as Error)?.message ?? 'Error al actualizar el nombre';
      setNameStatus({ type: 'error', message: msg });
    }
  };

  // Password form
  const [passStatus, setPassStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    register: regPass,
    handleSubmit: handlePass,
    reset: resetPass,
    formState: { errors: passErrors, isSubmitting: passSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onPassSubmit = async ({ currentPassword, newPassword }: PasswordValues) => {
    setPassStatus(null);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPassStatus({ type: 'success', message: 'Contraseña actualizada correctamente.' });
      resetPass();
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as Error)?.message ?? 'Error al cambiar la contraseña';
      setPassStatus({ type: 'error', message: msg });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Mi perfil</h1>
        <p className="mt-1 text-sm text-slate-500">Actualizá tu nombre y contraseña de acceso.</p>
      </div>

      {/* Identity info strip */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-card">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
          {user?.name?.charAt(0).toUpperCase() ?? 'U'}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{user?.name}</p>
          <p className="truncate text-sm text-slate-500">{user?.email}</p>
        </div>
        <span className="ml-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold capitalize text-brand-700">
          {user?.role}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Update name ── */}
        <SectionCard
          icon={User}
          title="Información personal"
          description="Cambiá el nombre que aparece en el sistema."
        >
          <form onSubmit={handleName(onNameSubmit)} className="space-y-4">
            <Field label="Nombre completo" error={nameErrors.name?.message}>
              <TextInput
                placeholder="Tu nombre"
                error={nameErrors.name?.message}
                {...regName('name')}
              />
            </Field>

            <Field label="Email">
              <TextInput
                value={user?.email ?? ''}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-400 outline-none cursor-not-allowed"
              />
            </Field>

            {nameStatus && <Banner type={nameStatus.type} message={nameStatus.message} />}

            <button
              type="submit"
              disabled={nameSubmitting}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {nameSubmitting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando…
                </>
              ) : (
                'Guardar nombre'
              )}
            </button>
          </form>
        </SectionCard>

        {/* ── Change password ── */}
        <SectionCard
          icon={Lock}
          title="Seguridad"
          description="Asegurate de usar una contraseña segura de al menos 8 caracteres."
        >
          <form onSubmit={handlePass(onPassSubmit)} className="space-y-4">

            <Field label="Contraseña actual" error={passErrors.currentPassword?.message}>
              <div className="relative">
                <TextInput
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="••••••••"
                  error={passErrors.currentPassword?.message}
                  {...regPass('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field label="Nueva contraseña" error={passErrors.newPassword?.message}>
              <div className="relative">
                <TextInput
                  type={showNew ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  error={passErrors.newPassword?.message}
                  {...regPass('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field label="Confirmar nueva contraseña" error={passErrors.confirmPassword?.message}>
              <div className="relative">
                <TextInput
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repetí la nueva contraseña"
                  error={passErrors.confirmPassword?.message}
                  {...regPass('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {passStatus && <Banner type={passStatus.type} message={passStatus.message} />}

            <button
              type="submit"
              disabled={passSubmitting}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passSubmitting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Actualizando…
                </>
              ) : (
                'Cambiar contraseña'
              )}
            </button>

          </form>
        </SectionCard>

      </div>
    </div>
  );
}
