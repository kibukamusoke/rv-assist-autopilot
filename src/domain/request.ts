import { z } from 'zod';

export const serviceCategories = [
  'hvac',
  'electrical',
  'plumbing',
  'appliance',
  'roof',
  'general',
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export const repairRequestSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  description: z.string().min(10),
  location: z.object({
    city: z.string().min(1),
    region: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  rv: z.object({
    type: z.string().min(1),
    year: z.number().int().min(1950).max(2100).optional(),
  }),
  constraints: z.array(z.string()).default([]),
  requestedAt: z.string().datetime(),
});

export type RepairRequest = z.infer<typeof repairRequestSchema>;

export const qualificationSchema = z.object({
  category: z.enum(serviceCategories),
  urgency: z.enum(['low', 'medium', 'high', 'emergency']),
  summary: z.string(),
  safetyFlags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type Qualification = z.infer<typeof qualificationSchema>;
