import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import type { WorkflowMessage } from '../../src/adapters/events/event-publisher.js';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowScheduler } from '../../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { InMemoryWorkflowStore } from '../../src/adapters/state/in-memory-workflow-store.js';
import { repairRequestSchema } from '../../src/domain/request.js';
import { WorkflowEngine } from '../../src/workflows/workflow-engine.js';

function createHarness() {
  let nowMs = Date.parse('2026-08-17T10:00:01.000Z');
  const events = new InMemoryWorkflowScheduler();
  const nicheWave = new MockNicheWaveAdapter();
  const engine = new WorkflowEngine(
    new InMemoryWorkflowStore(),
    nicheWave,
    events,
    () => new Date(nowMs),
  );
  return { engine, events, nicheWave, advance: (milliseconds: number) => (nowMs += milliseconds) };
}

describe('workflow recovery and completion', () => {
  it('moves to the next candidate after a decline and ignores duplicate delivery', async () => {
    const { engine } = createHarness();
    await engine.start(repairRequestSchema.parse(request));
    const message: WorkflowMessage = {
      type: 'TECHNICIAN_RESPONSE_RECEIVED',
      workflowId: request.id,
      technicianId: 'tech-desert-mobile',
      response: 'declined',
      respondedAt: '2026-08-17T10:02:00.000Z',
      idempotencyKey: 'response-decline-001',
    };
    const first = await engine.handleMessage(message);
    const duplicate = await engine.handleMessage(message);
    expect(first.status).toBe('AWAITING_RESPONSE');
    expect(first.currentCandidateIndex).toBe(1);
    expect(first.events.some(({ type }) => type === 'TECHNICIAN_DECLINED')).toBe(true);
    expect(duplicate).toEqual(first);
  });

  it('moves to the next candidate when the response deadline expires', async () => {
    const { engine, events, advance } = createHarness();
    await engine.start(repairRequestSchema.parse(request));
    const due = events.messages[0];
    expect(due?.type).toBe('TECHNICIAN_RESPONSE_DUE');
    advance(16 * 60 * 1000);
    const state = await engine.handleMessage(due as WorkflowMessage);
    expect(state.currentCandidateIndex).toBe(1);
    expect(state.events.some(({ type }) => type === 'TECHNICIAN_TIMED_OUT')).toBe(true);
  });

  it('acknowledges a future timeout immediately when it is already stale', async () => {
    const { engine, events } = createHarness();
    await engine.start(repairRequestSchema.parse(request));
    const due = events.messages[0];
    await engine.handleMessage({
      type: 'TECHNICIAN_RESPONSE_RECEIVED',
      workflowId: request.id,
      technicianId: 'tech-desert-mobile',
      response: 'accepted',
      respondedAt: '2026-08-17T10:03:00.000Z',
      idempotencyKey: 'response-accepted-before-timeout',
    });

    const state = await engine.handleMessage(due as WorkflowMessage);

    expect(state.status).toBe('CUSTOMER_CONFIRMATION');
    expect(state.processedMessageKeys).toContain(due?.idempotencyKey);
    expect(state.events.at(-1)?.type).toBe('DUPLICATE_OR_STALE_MESSAGE_IGNORED');
  });

  it('creates a job only after both technician acceptance and customer confirmation', async () => {
    const { engine, nicheWave } = createHarness();
    await engine.start(repairRequestSchema.parse(request));
    const accepted = await engine.handleMessage({
      type: 'TECHNICIAN_RESPONSE_RECEIVED',
      workflowId: request.id,
      technicianId: 'tech-desert-mobile',
      response: 'accepted',
      respondedAt: '2026-08-17T10:03:00.000Z',
      idempotencyKey: 'response-accepted-001',
    });
    expect(accepted.status).toBe('CUSTOMER_CONFIRMATION');
    expect(nicheWave.createdJobs).toHaveLength(0);

    const completed = await engine.handleMessage({
      type: 'CUSTOMER_CONFIRMATION_RECEIVED',
      workflowId: request.id,
      confirmed: true,
      respondedAt: '2026-08-17T10:04:00.000Z',
      idempotencyKey: 'customer-confirmed-001',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.externalJobId).toBe(`mock-job-${request.id}`);
    expect(nicheWave.createdJobs).toHaveLength(1);
  });
});
