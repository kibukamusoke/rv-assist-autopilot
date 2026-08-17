import { describe, expect, it } from 'vitest';
import { MockOutreachAdapter } from '../../src/adapters/outreach/mock-outreach-adapter.js';

describe('MockOutreachAdapter', () => {
  it('returns deterministic delivery evidence and deduplicates by idempotency key', async () => {
    const adapter = new MockOutreachAdapter();
    const request = {
      workflowId: 'workflow-001',
      audience: 'technician' as const,
      recipientId: 'tech-001',
      message: 'Synthetic repair request',
      requestedAt: '2026-08-17T10:00:00.000Z',
      idempotencyKey: 'workflow-001:0:technician-outreach',
      responseDueAt: '2026-08-17T10:15:00.000Z',
    };

    const first = await adapter.send(request);
    const duplicate = await adapter.send(request);

    expect(first).toEqual(duplicate);
    expect(first).toMatchObject({
      deliveryId: 'mock-delivery-workflow-001:0:technician-outreach',
      channel: 'synthetic',
      status: 'delivered',
    });
    expect(adapter.deliveries).toHaveLength(1);
  });
});
