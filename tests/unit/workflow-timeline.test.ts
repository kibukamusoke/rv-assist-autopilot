import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowStore } from '../../src/adapters/state/in-memory-workflow-store.js';
import {
  calculateWorkflowMetrics,
  presentWorkflowTimeline,
} from '../../src/api/workflow-timeline.js';
import { repairRequestSchema } from '../../src/domain/request.js';
import { WorkflowEngine } from '../../src/workflows/workflow-engine.js';

describe('presentWorkflowTimeline', () => {
  it('presents workflow events as reviewer-readable steps', async () => {
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      new MockNicheWaveAdapter(),
      new InMemoryWorkflowScheduler(),
    );
    const state = await engine.start(repairRequestSchema.parse(request));
    const view = presentWorkflowTimeline(state);
    expect(view).toMatchObject({ workflowId: request.id, status: 'AWAITING_RESPONSE' });
    expect(view.metrics).toMatchObject({
      technicianContactAttempts: 1,
      candidateRetries: 0,
      usedDeterministicFallback: false,
      completed: false,
    });
    expect(view.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Understanding repair request' }),
        expect.objectContaining({ label: 'Contacting technician' }),
      ]),
    );
  });

  it('derives retry, timeout, fallback, and outcome metrics from persisted evidence', () => {
    const metrics = calculateWorkflowMetrics({
      id: 'metrics-001',
      version: 1,
      status: 'HUMAN_ESCALATION',
      request: repairRequestSchema.parse(request),
      candidates: [],
      processedMessageKeys: [],
      createdAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:00:05.000Z',
      qualificationTrace: { source: 'deterministic-fallback', durationMs: 250 },
      events: [
        {
          id: '1',
          type: 'TECHNICIAN_CONTACTED',
          occurredAt: '2026-08-17T10:00:01.000Z',
          details: {},
        },
        {
          id: '2',
          type: 'TECHNICIAN_TIMED_OUT',
          occurredAt: '2026-08-17T10:00:02.000Z',
          details: {},
        },
        {
          id: '3',
          type: 'TECHNICIAN_CONTACT_FAILED',
          occurredAt: '2026-08-17T10:00:03.000Z',
          details: {},
        },
        { id: '4', type: 'HUMAN_ESCALATION', occurredAt: '2026-08-17T10:00:05.000Z', details: {} },
      ],
    });

    expect(metrics).toMatchObject({
      totalDurationMs: 5000,
      qualificationDurationMs: 250,
      technicianContactAttempts: 2,
      technicianDeliveryFailures: 1,
      technicianTimeouts: 1,
      candidateRetries: 1,
      usedDeterministicFallback: true,
      humanEscalated: true,
    });
  });

  it('stops completed duration at the terminal event despite later stale callbacks', () => {
    const metrics = calculateWorkflowMetrics({
      id: 'completed-metrics-001',
      version: 2,
      status: 'COMPLETED',
      request: repairRequestSchema.parse(request),
      candidates: [],
      processedMessageKeys: [],
      createdAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:15:00.000Z',
      events: [
        { id: '1', type: 'COMPLETED', occurredAt: '2026-08-17T10:00:05.000Z', details: {} },
        {
          id: '2',
          type: 'DUPLICATE_OR_STALE_MESSAGE_IGNORED',
          occurredAt: '2026-08-17T10:15:00.000Z',
          details: {},
        },
      ],
    });

    expect(metrics.totalDurationMs).toBe(5000);
  });
});
