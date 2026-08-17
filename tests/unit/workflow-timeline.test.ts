import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowStore } from '../../src/adapters/state/in-memory-workflow-store.js';
import { presentWorkflowTimeline } from '../../src/api/workflow-timeline.js';
import { repairRequestSchema } from '../../src/domain/request.js';
import { WorkflowEngine } from '../../src/workflows/workflow-engine.js';

describe('presentWorkflowTimeline', () => {
  it('presents workflow events as judge-readable steps', async () => {
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      new MockNicheWaveAdapter(),
      new InMemoryWorkflowScheduler(),
    );
    const state = await engine.start(repairRequestSchema.parse(request));
    const view = presentWorkflowTimeline(state);
    expect(view).toMatchObject({ workflowId: request.id, status: 'AWAITING_RESPONSE' });
    expect(view.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Understanding repair request' }),
        expect.objectContaining({ label: 'Contacting technician' }),
      ]),
    );
  });
});
