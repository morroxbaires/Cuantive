'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Star, ImageIcon, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';

interface VehicleInfo {
  id:    string;
  plate: string;
  name?: string;
}

// ─── Score button ─────────────────────────────────────────────────────────────

function ScoreBtn({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  const color = selected
    ? value <= 4 ? 'border-red-500 bg-red-500 text-white'
      : value <= 7 ? 'border-amber-500 bg-amber-500 text-white'
      : 'border-emerald-500 bg-emerald-500 text-white'
    : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all active:scale-95',
        color,
      )}
    >
      {value}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurveyPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();

  const [vehicle,   setVehicle]   = useState<VehicleInfo | null>(null);
  const [notFound,  setNotFound]  = useState(false);
  const [loadingV,  setLoadingV]  = useState(true);

  const [score,      setScore]      = useState<number | null>(null);
  const [fecha,      setFecha]      = useState(() => new Date().toISOString().slice(0, 10));
  const [hora,       setHora]       = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [obs,        setObs]        = useState('');
  const [imageFile,  setImageFile]  = useState<File | null>(null);
  const [preview,    setPreview]    = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState('');

  // Load vehicle info
  useEffect(() => {
    if (!vehicleId) return;
    api.get(`/public/survey/${vehicleId}`)
      .then(r => setVehicle(r.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoadingV(false));
  }, [vehicleId]);

  const onImageChange = useCallback((file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score) { setError('Por favor seleccioná una puntuación.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('vehicleId',  vehicleId);
      form.append('puntuacion', String(score));
      if (fecha) form.append('fecha', fecha);
      if (hora)  form.append('hora',  hora);
      if (obs)   form.append('observaciones', obs);
      if (imageFile) form.append('image', imageFile);

      await api.post('/public/survey', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Error al enviar. Por favor intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── States ───────────────────────────────────────────────────────────────

  if (loadingV) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Cargando…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h1 className="text-lg font-bold text-slate-800">Vehículo no encontrado</h1>
        <p className="text-sm text-slate-500">El código QR que escaneaste no corresponde a una unidad activa.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">¡Gracias por tu opinión!</h1>
        <p className="text-sm text-slate-500">Tu evaluación fue registrada correctamente.</p>
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <Star
              key={i}
              className={cn('h-5 w-5', i < (score ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200')}
            />
          ))}
        </div>
        <p className="text-2xl font-bold text-slate-900">{score}/10</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
              <Star className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">Cuantive · Encuesta</span>
          </div>
          <h1 className="text-lg font-bold">{vehicle?.name ?? vehicle?.plate}</h1>
          {vehicle?.name && <p className="text-xs opacity-70">{vehicle.plate}</p>}
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-slate-600">Calificá el servicio de esta unidad del <strong>1</strong> (pésimo) al <strong>10</strong> (excelente).</p>

          {/* Score radio */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Puntuación *</p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <ScoreBtn key={n} value={n} selected={score === n} onClick={() => setScore(n)} />
              ))}
            </div>
            {score && (
              <p className={cn('text-xs mt-2 font-medium',
                score <= 4 ? 'text-red-500' : score <= 7 ? 'text-amber-500' : 'text-emerald-600',
              )}>
                {score <= 3 ? 'Pésimo' : score <= 5 ? 'Regular' : score <= 7 ? 'Bueno' : score <= 8 ? 'Muy bueno' : score === 9 ? 'Excelente' : '¡Perfecto!'}
              </p>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={e => setHora(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Comentarios (opcional)</label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
              placeholder="Contanos tu experiencia…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Foto (opcional)</label>
            <div
              className="relative flex items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 transition-colors overflow-hidden"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                  <button type="button" className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white" onClick={e => { e.stopPropagation(); onImageChange(null); }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-xs">Subir foto</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => onImageChange(e.target.files?.[0] ?? null)} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {submitting ? 'Enviando…' : 'Enviar evaluación'}
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-slate-400 mt-3">Cuantive — Gestión de flotas</p>
    </div>
  );
}
