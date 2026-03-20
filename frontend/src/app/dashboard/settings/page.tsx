'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, CheckCircle2, Fuel } from 'lucide-react';

import { settingsService } from '@/services/settings.service';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button }           from '@/components/ui/Button';
import { Input }            from '@/components/ui/Input';
import { Select }           from '@/components/ui/Select';
import { PageLoader }       from '@/components/ui/Spinner';
import type { Settings }    from '@/types';

const schema = z.object({
  timezone:             z.string().min(1),
  currency:             z.string().min(1),
  dateFormat:           z.string().min(1),
  fuelAlertDays:        z.coerce.number().min(1).max(365),
  licenseAlertDays:     z.coerce.number().min(1).max(365),
  maintenanceAlertDays: z.coerce.number().min(1).max(365),
});

const pricesSchema = z.object({
  fuelPrice:        z.coerce.number().min(0, 'No puede ser negativo'),
  gasoilPrice:      z.coerce.number().min(0, 'No puede ser negativo'),
  electricityPrice: z.coerce.number().min(0, 'No puede ser negativo'),
});

type FormValues        = z.infer<typeof schema>;
type PricesFormValues  = z.infer<typeof pricesSchema>;

export default function SettingsPage() {
  const [loading,      setLoading]      = useState(true);
  const [saved,        setSaved]        = useState(false);
  const [pricesSaved,  setPricesSaved]  = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const {
    register: registerPrices,
    handleSubmit: handlePricesSubmit,
    reset: resetPrices,
    formState: { errors: pricesErrors, isSubmitting: pricesSubmitting },
  } = useForm<PricesFormValues>({
    resolver: zodResolver(pricesSchema),
    defaultValues: { fuelPrice: 0, gasoilPrice: 0, electricityPrice: 0 },
  });

  useEffect(() => {
    settingsService.get()
      .then((s) => {
        reset({
          timezone:             s.timezone,
          currency:             s.currency,
          dateFormat:           s.dateFormat,
          fuelAlertDays:        s.fuelAlertDays,
          licenseAlertDays:     s.licenseAlertDays,
          maintenanceAlertDays: s.maintenanceAlertDays,
        });
        resetPrices({
          fuelPrice:        Number(s.fuelPrice)        ?? 0,
          gasoilPrice:      Number(s.gasoilPrice)      ?? 0,
          electricityPrice: Number(s.electricityPrice) ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, [reset, resetPrices]);

  const onSubmit = async (data: FormValues) => {
    await settingsService.update(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const onPricesSubmit = async (data: PricesFormValues) => {
    await settingsService.update({
      fuelPrice:        data.fuelPrice,
      gasoilPrice:      data.gasoilPrice,
      electricityPrice: data.electricityPrice,
    });
    setPricesSaved(true);
    setTimeout(() => setPricesSaved(false), 3000);
  };

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      {/* General */}
      <Card padding="md">
        <CardHeader title="Configuración general" subtitle="Ajusta la región y formato para tu empresa" />
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Zona horaria"
              options={[
                { value: 'America/Montevideo', label: 'Montevideo (UTC-3)' },
                { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
                { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
                { value: 'UTC', label: 'UTC' },
              ]}
              error={errors.timezone?.message}
              {...register('timezone')}
            />
            <Select
              label="Moneda"
              options={[
                { value: 'UYU', label: 'Peso Uruguayo (UYU)' },
                { value: 'USD', label: 'Dólar (USD)' },
                { value: 'ARS', label: 'Peso Argentino (ARS)' },
                { value: 'BRL', label: 'Real Brasileño (BRL)' },
              ]}
              error={errors.currency?.message}
              {...register('currency')}
            />
            <Select
              label="Formato de fecha"
              options={[
                { value: 'dd/MM/yyyy',   label: 'DD/MM/AAAA' },
                { value: 'MM/dd/yyyy',   label: 'MM/DD/AAAA' },
                { value: 'yyyy-MM-dd',   label: 'AAAA-MM-DD' },
              ]}
              error={errors.dateFormat?.message}
              {...register('dateFormat')}
            />
          </div>
        </form>
      </Card>

      {/* Alerts config */}
      <Card padding="md">
        <CardHeader title="Umbrales de alerta" subtitle="Días de anticipación para generar cada tipo de alerta" />
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Alerta combustible (días)"
              type="number"
              hint="Días sin carga para alertar"
              error={errors.fuelAlertDays?.message}
              {...register('fuelAlertDays')}
            />
            <Input
              label="Alerta licencias (días)"
              type="number"
              hint="Días antes del vencimiento"
              error={errors.licenseAlertDays?.message}
              {...register('licenseAlertDays')}
            />
            <Input
              label="Alerta mantenimiento (días)"
              type="number"
              hint="Días antes del próximo"
              error={errors.maintenanceAlertDays?.message}
              {...register('maintenanceAlertDays')}
            />
          </div>
        </form>
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-between rounded-xl bg-white border border-slate-100 shadow-card p-4">
        {saved ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Cambios guardados correctamente</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Los cambios se aplican inmediatamente</p>
        )}
        <Button
          icon={<Save className="h-4 w-4" />}
          loading={isSubmitting}
          onClick={handleSubmit(onSubmit)}
        >
          Guardar cambios
        </Button>
      </div>

      {/* Fuel prices */}
      <Card padding="md">
        <CardHeader
          title="Precios de referencia"
          subtitle="Precios por unidad que se autocompletarán en las nuevas cargas de combustible"
        />
        <form className="space-y-4" onSubmit={handlePricesSubmit(onPricesSubmit)}>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Precio de Nafta"
              type="number"
              step="0.0001"
              min={0}
              hint="Precio por litro"
              error={pricesErrors.fuelPrice?.message}
              {...registerPrices('fuelPrice')}
              onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
            />
            <Input
              label="Precio de Gasoil"
              type="number"
              step="0.0001"
              min={0}
              hint="Precio por litro"
              error={pricesErrors.gasoilPrice?.message}
              {...registerPrices('gasoilPrice')}
              onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
            />
            <Input
              label="Precio de Kw"
              type="number"
              step="0.0001"
              min={0}
              hint="Precio por kWh"
              error={pricesErrors.electricityPrice?.message}
              {...registerPrices('electricityPrice')}
              onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            {pricesSaved ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Precios guardados correctamente</span>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Estos precios se usarán como referencia en las cargas</p>
            )}
            <Button
              icon={<Save className="h-4 w-4" />}
              loading={pricesSubmitting}
              type="submit"
            >
              Guardar precios
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
