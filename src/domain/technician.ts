import { z } from 'zod';
import { serviceCategories } from './request.js';

export const technicianSchema = z.object({
  id: z.string(),
  businessName: z.string(),
  baseLocation: z.object({ city: z.string(), region: z.string() }),
  serviceRadiusMiles: z.number().positive(),
  specialties: z.array(z.enum(serviceCategories)),
  verified: z.boolean(),
  availableToday: z.boolean(),
  responseRate: z.number().min(0).max(1),
  rating: z.number().min(0).max(5),
  syntheticDistanceMiles: z.number().nonnegative(),
});

export type Technician = z.infer<typeof technicianSchema>;

export interface RankedTechnician extends Technician {
  score: number;
  reasons: string[];
}
