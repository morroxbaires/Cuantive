import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';

export const updateSettingsSchema = z.object({
  fuelPrice:               z.number().min(0).optional(),
  gasoilPrice:             z.number().min(0).optional(),
  electricityPrice:        z.number().min(0).optional(),
  alertDaysBeforeLicense:  z.number().int().min(1).max(365).optional(),
  alertDaysBeforeMaint:    z.number().int().min(1).max(365).optional(),
  alertKmBeforeMaint:      z.number().int().min(0).optional(),
  alertFuelExcessPct:      z.number().min(0).max(200).optional(),
  alertNoLoadDays:         z.number().int().min(1).max(365).optional(),
});

export class SettingsService {
  async findByCompany(companyId: string) {
    let settings = await prisma.settings.findUnique({ where: { companyId } });

    // Crear si no existe (empresa migrada sin trigger)
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: uuidv4(), companyId },
      });
    }
    return settings;
  }

  async update(companyId: string, data: z.infer<typeof updateSettingsSchema>) {
    const settings = await prisma.settings.findUnique({ where: { companyId } });

    if (!settings) {
      return prisma.settings.create({
        data: {
          id:                     uuidv4(),
          companyId,
          fuelPrice:              data.fuelPrice,
          gasoilPrice:            data.gasoilPrice,
          electricityPrice:       data.electricityPrice,
          alertDaysBeforeLicense: data.alertDaysBeforeLicense,
          alertDaysBeforeMaint:   data.alertDaysBeforeMaint,
          alertKmBeforeMaint:     data.alertKmBeforeMaint,
          alertFuelExcessPct:     data.alertFuelExcessPct,
          alertNoLoadDays:        data.alertNoLoadDays,
        },
      });
    }

    return prisma.settings.update({
      where: { companyId },
      data: {
        fuelPrice:              data.fuelPrice,
        gasoilPrice:            data.gasoilPrice,
        electricityPrice:       data.electricityPrice,
        alertDaysBeforeLicense: data.alertDaysBeforeLicense,
        alertDaysBeforeMaint:   data.alertDaysBeforeMaint,
        alertKmBeforeMaint:     data.alertKmBeforeMaint,
        alertFuelExcessPct:     data.alertFuelExcessPct,
        alertNoLoadDays:        data.alertNoLoadDays,
      },
    });
  }
}
