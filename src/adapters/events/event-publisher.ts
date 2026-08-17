import { z } from 'zod';

export const workflowMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TECHNICIAN_RESPONSE_DUE'),
    workflowId: z.string(),
    idempotencyKey: z.string(),
    candidateIndex: z.number().int().nonnegative(),
    dueAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('TECHNICIAN_RESPONSE_RECEIVED'),
    workflowId: z.string(),
    idempotencyKey: z.string(),
    technicianId: z.string(),
    response: z.enum(['accepted', 'declined']),
    respondedAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('CUSTOMER_CONFIRMATION_RECEIVED'),
    workflowId: z.string(),
    idempotencyKey: z.string(),
    confirmed: z.boolean(),
    respondedAt: z.string().datetime(),
  }),
]);

export type WorkflowMessage = z.infer<typeof workflowMessageSchema>;

export interface EventPublisher {
  publish(message: WorkflowMessage): Promise<void>;
}
