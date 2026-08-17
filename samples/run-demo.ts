import request from './urgent-ac-request.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowStore } from '../src/adapters/state/in-memory-workflow-store.js';
import { repairRequestSchema } from '../src/domain/request.js';
import { WorkflowEngine } from '../src/workflows/workflow-engine.js';

const events = new InMemoryWorkflowScheduler();
const engine = new WorkflowEngine(
  new InMemoryWorkflowStore(),
  new MockNicheWaveAdapter(),
  events,
  () => new Date('2026-08-17T10:00:01.000Z'),
);

const state = await engine.start(repairRequestSchema.parse(request));
console.log(JSON.stringify({ state, publishedMessages: events.messages }, null, 2));
