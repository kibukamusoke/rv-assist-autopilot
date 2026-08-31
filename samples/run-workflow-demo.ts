import request from './urgent-ac-request.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowStore } from '../src/adapters/state/in-memory-workflow-store.js';
import { presentWorkflowTimeline } from '../src/api/workflow-timeline.js';
import { repairRequestSchema } from '../src/domain/request.js';
import { WorkflowEngine } from '../src/workflows/workflow-engine.js';

let nowMs = Date.parse('2026-08-17T19:03:12.000Z');
const advance = (seconds: number) => {
  nowMs += seconds * 1000;
};
const engine = new WorkflowEngine(
  new InMemoryWorkflowStore(),
  new MockNicheWaveAdapter(),
  new InMemoryWorkflowScheduler(),
  () => new Date(nowMs),
);
const parsed = repairRequestSchema.parse(request);

await engine.start(parsed);
advance(20);
await engine.handleMessage({
  type: 'TECHNICIAN_RESPONSE_RECEIVED',
  workflowId: parsed.id,
  technicianId: 'tech-desert-mobile',
  response: 'declined',
  respondedAt: new Date(nowMs).toISOString(),
  idempotencyKey: 'demo-decline',
});
advance(17);
await engine.handleMessage({
  type: 'TECHNICIAN_RESPONSE_RECEIVED',
  workflowId: parsed.id,
  technicianId: 'tech-phoenix-rv',
  response: 'accepted',
  respondedAt: new Date(nowMs).toISOString(),
  idempotencyKey: 'demo-accept',
});
advance(4);
const completed = await engine.handleMessage({
  type: 'CUSTOMER_CONFIRMATION_RECEIVED',
  workflowId: parsed.id,
  confirmed: true,
  respondedAt: new Date(nowMs).toISOString(),
  idempotencyKey: 'demo-confirm',
});
const view = presentWorkflowTimeline(completed);
for (const item of view.timeline as Array<{
  occurredAt: string;
  label: string;
  details: unknown;
}>) {
  console.log(`${item.occurredAt.slice(11, 19)}  ${item.label}`, item.details);
}
console.log(`\n✓ ${completed.status} — external job ${completed.externalJobId}`);
