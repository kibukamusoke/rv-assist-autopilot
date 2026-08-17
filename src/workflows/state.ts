import { z } from 'zod';
import { qualificationSchema, repairRequestSchema } from '../domain/request.js';
import { technicianSchema } from '../domain/technician.js';

export const workflowStatuses = [
  'REQUEST_RECEIVED',
  'UNDERSTANDING_REQUEST',
  'SEARCHING_TECHNICIANS',
  'CONTACTING_TECHNICIAN',
  'AWAITING_RESPONSE',
  'MATCH_FOUND',
  'CUSTOMER_CONFIRMATION',
  'COMPLETED',
  'HUMAN_ESCALATION',
] as const;

export const workflowEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  occurredAt: z.string().datetime(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export const workflowStateSchema = z.object({
  id: z.string(),
  version: z.number().int().nonnegative(),
  status: z.enum(workflowStatuses),
  request: repairRequestSchema,
  qualification: qualificationSchema.optional(),
  qualificationTrace: z
    .object({
      source: z.enum(['deterministic', 'gemini', 'deterministic-fallback']),
      model: z.string().optional(),
      fallbackReason: z.string().optional(),
      durationMs: z.number().nonnegative(),
    })
    .optional(),
  candidates: z.array(technicianSchema.extend({ score: z.number(), reasons: z.array(z.string()) })),
  currentCandidateIndex: z.number().int().nonnegative().optional(),
  technicianAcceptedAt: z.string().datetime().optional(),
  customerConfirmedAt: z.string().datetime().optional(),
  externalJobId: z.string().optional(),
  processedMessageKeys: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  events: z.array(workflowEventSchema),
});

export type WorkflowStatus = (typeof workflowStatuses)[number];
export type WorkflowEvent = z.infer<typeof workflowEventSchema>;
export type WorkflowState = z.infer<typeof workflowStateSchema>;
