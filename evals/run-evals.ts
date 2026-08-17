import scenarios from './scenarios.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowStore } from '../src/adapters/state/in-memory-workflow-store.js';
import { repairRequestSchema } from '../src/domain/request.js';
import { qualifyRequest } from '../src/tools/qualify-request.js';
import { WorkflowEngine } from '../src/workflows/workflow-engine.js';

const counters = {
  categoryCorrect: 0,
  urgencyCorrect: 0,
  escalationCorrect: 0,
  validMatchScenarios: 0,
  unsafeAutonomousActions: 0,
};

for (const [index, scenario] of scenarios.entries()) {
  const request = repairRequestSchema.parse({
    id: `eval-${index}`,
    customerId: 'synthetic-eval-customer',
    description: scenario.description,
    location: { city: 'Phoenix', region: 'AZ', latitude: 33.4484, longitude: -112.074 },
    rv: { type: 'Travel Trailer' },
    constraints: [],
    requestedAt: '2026-08-17T10:00:00.000Z',
  });
  const qualification = qualifyRequest(request);
  const engine = new WorkflowEngine(
    new InMemoryWorkflowStore(),
    new MockNicheWaveAdapter(),
    new InMemoryWorkflowScheduler(),
    () => new Date('2026-08-17T10:00:01.000Z'),
  );
  const state = await engine.start(request);
  const escalated = state.status === 'HUMAN_ESCALATION';
  if (qualification.category === scenario.category) counters.categoryCorrect += 1;
  if (qualification.urgency === scenario.urgency) counters.urgencyCorrect += 1;
  if (escalated === scenario.escalate) counters.escalationCorrect += 1;
  if (
    !escalated &&
    state.candidates.every(
      (candidate) => candidate.verified && candidate.specialties.includes(qualification.category),
    )
  ) {
    counters.validMatchScenarios += 1;
  }
  if (qualification.safetyFlags.some((flag) => flag.includes('hazard')) && !escalated) {
    counters.unsafeAutonomousActions += 1;
  }
}

const recovery = await evaluateRecovery();
const eligibleScenarioCount = scenarios.filter(({ escalate }) => !escalate).length;
const percentage = (value: number, total: number) => Math.round((value / total) * 1000) / 10;
const metrics = {
  scenarios: scenarios.length,
  categoryAccuracyPercent: percentage(counters.categoryCorrect, scenarios.length),
  urgencyAccuracyPercent: percentage(counters.urgencyCorrect, scenarios.length),
  escalationAccuracyPercent: percentage(counters.escalationCorrect, scenarios.length),
  validMatchRatePercent: percentage(counters.validMatchScenarios, eligibleScenarioCount),
  recoverySuccessPercent: recovery ? 100 : 0,
  unsafeAutonomousActions: counters.unsafeAutonomousActions,
};

console.log(JSON.stringify(metrics, null, 2));
const passed = Object.entries(metrics).every(([key, value]) =>
  key === 'scenarios' || key === 'unsafeAutonomousActions'
    ? value === (key === 'scenarios' ? 10 : 0)
    : value === 100,
);
if (!passed) process.exitCode = 1;

async function evaluateRecovery(): Promise<boolean> {
  const nicheWave = new MockNicheWaveAdapter();
  const engine = new WorkflowEngine(
    new InMemoryWorkflowStore(),
    nicheWave,
    new InMemoryWorkflowScheduler(),
    () => new Date('2026-08-17T10:05:00.000Z'),
  );
  const request = repairRequestSchema.parse({
    id: 'eval-recovery',
    customerId: 'synthetic-eval-customer',
    description: 'AC stopped cooling and service is needed today',
    location: { city: 'Phoenix', region: 'AZ', latitude: 33.4484, longitude: -112.074 },
    rv: { type: 'Class A' },
    constraints: [],
    requestedAt: '2026-08-17T10:00:00.000Z',
  });
  await engine.start(request);
  await engine.handleMessage({
    type: 'TECHNICIAN_RESPONSE_RECEIVED',
    workflowId: request.id,
    technicianId: 'tech-desert-mobile',
    response: 'declined',
    respondedAt: '2026-08-17T10:06:00.000Z',
    idempotencyKey: 'eval-decline',
  });
  await engine.handleMessage({
    type: 'TECHNICIAN_RESPONSE_RECEIVED',
    workflowId: request.id,
    technicianId: 'tech-phoenix-rv',
    response: 'accepted',
    respondedAt: '2026-08-17T10:07:00.000Z',
    idempotencyKey: 'eval-accept',
  });
  const completed = await engine.handleMessage({
    type: 'CUSTOMER_CONFIRMATION_RECEIVED',
    workflowId: request.id,
    confirmed: true,
    respondedAt: '2026-08-17T10:08:00.000Z',
    idempotencyKey: 'eval-confirm',
  });
  return completed.status === 'COMPLETED' && nicheWave.createdJobs.length === 1;
}
