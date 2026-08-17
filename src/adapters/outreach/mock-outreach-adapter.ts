import type { OutreachAdapter, OutreachDelivery, OutreachRequest } from './outreach-adapter.js';

export class MockOutreachAdapter implements OutreachAdapter {
  readonly deliveries: OutreachDelivery[] = [];

  async send(request: OutreachRequest): Promise<OutreachDelivery> {
    const existing = this.deliveries.find(
      ({ idempotencyKey }) => idempotencyKey === request.idempotencyKey,
    );
    if (existing) return existing;

    const delivery: OutreachDelivery = {
      deliveryId: `mock-delivery-${request.idempotencyKey}`,
      audience: request.audience,
      recipientId: request.recipientId,
      channel: 'synthetic',
      status: 'delivered',
      sentAt: request.requestedAt,
      idempotencyKey: request.idempotencyKey,
    };
    this.deliveries.push(delivery);
    return delivery;
  }
}
