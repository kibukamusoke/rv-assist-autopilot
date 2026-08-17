export type OutreachAudience = 'technician' | 'customer';
export type OutreachStatus = 'delivered' | 'failed';

export interface OutreachRequest {
  workflowId: string;
  audience: OutreachAudience;
  recipientId: string;
  message: string;
  requestedAt: string;
  idempotencyKey: string;
  responseDueAt?: string;
}

export interface OutreachDelivery {
  deliveryId: string;
  audience: OutreachAudience;
  recipientId: string;
  channel: 'synthetic';
  status: OutreachStatus;
  sentAt: string;
  idempotencyKey: string;
}

export interface OutreachAdapter {
  send(request: OutreachRequest): Promise<OutreachDelivery>;
}
