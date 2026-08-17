import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';
import { MockOutreachAdapter } from '../../src/adapters/outreach/mock-outreach-adapter.js';
import type {
  OutreachAdapter,
  OutreachRequest,
} from '../../src/adapters/outreach/outreach-adapter.js';
import { InMemoryWorkflowStore } from '../../src/adapters/state/in-memory-workflow-store.js';
import { repairRequestSchema } from '../../src/domain/request.js';
import { WorkflowEngine } from '../../src/workflows/workflow-engine.js';

describe('WorkflowEngine', () => {
  it('advances an eligible request to asynchronous technician response wait', async () => {
    const events = new InMemoryWorkflowScheduler();
    const outreach = new MockOutreachAdapter();
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      new MockNicheWaveAdapter(),
      events,
      () => new Date('2026-08-17T10:00:01.000Z'),
      undefined,
      undefined,
      outreach,
    );
    const state = await engine.start(repairRequestSchema.parse(request));
    expect(state.status).toBe('AWAITING_RESPONSE');
    expect(state.candidates[0]?.id).toBe('tech-desert-mobile');
    expect(state.technicianAcceptedAt).toBeUndefined();
    expect(events.messages).toHaveLength(1);
    expect(outreach.deliveries).toMatchObject([
      {
        audience: 'technician',
        recipientId: 'tech-desert-mobile',
        status: 'delivered',
      },
    ]);
    expect(state.events.some(({ type }) => type === 'TECHNICIAN_CONTACTED')).toBe(true);
  });

  it('is idempotent for a duplicate request', async () => {
    const adapter = new MockNicheWaveAdapter();
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      adapter,
      new InMemoryWorkflowScheduler(),
    );
    const parsed = repairRequestSchema.parse(request);
    const first = await engine.start(parsed);
    const second = await engine.start(parsed);
    expect(second).toEqual(first);
  });

  it('escalates hazards before searching or contacting technicians', async () => {
    const events = new InMemoryWorkflowScheduler();
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      new MockNicheWaveAdapter(),
      events,
    );
    const state = await engine.start(
      repairRequestSchema.parse({
        ...request,
        id: 'hazard-001',
        description: 'The electrical panel is sparking and there is smoke in the RV.',
        constraints: [],
      }),
    );
    expect(state.status).toBe('HUMAN_ESCALATION');
    expect(state.candidates).toEqual([]);
    expect(events.messages).toEqual([]);
  });

  it('escalates after every synthetic technician delivery fails', async () => {
    const events = new InMemoryWorkflowScheduler();
    const failedOutreach: OutreachAdapter = {
      send: async (outreachRequest: OutreachRequest) => ({
        deliveryId: `failed-${outreachRequest.idempotencyKey}`,
        audience: outreachRequest.audience,
        recipientId: outreachRequest.recipientId,
        channel: 'synthetic',
        status: 'failed',
        sentAt: outreachRequest.requestedAt,
        idempotencyKey: outreachRequest.idempotencyKey,
      }),
    };
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      new MockNicheWaveAdapter(),
      events,
      () => new Date('2026-08-17T10:00:01.000Z'),
      undefined,
      undefined,
      failedOutreach,
    );

    const state = await engine.start(
      repairRequestSchema.parse({ ...request, id: 'outreach-failure-001' }),
    );

    expect(state.status).toBe('HUMAN_ESCALATION');
    expect(state.events.filter(({ type }) => type === 'TECHNICIAN_CONTACT_FAILED')).toHaveLength(2);
    expect(events.messages).toHaveLength(0);
  });
});
