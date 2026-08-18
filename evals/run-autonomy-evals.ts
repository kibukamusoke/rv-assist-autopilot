/**
 * Autonomy evaluation harness.
 *
 * Expectations come from `docs/technical/autonomy-and-escalation-policy.md` and
 * are authored independently of implementation behaviour. When a scenario fails,
 * the correct response is to change the system or to change the policy
 * deliberately — never to relabel the scenario to match what the code does.
 *
 * Escalation causes are decomposed because a classification failure and an empty
 * marketplace are different problems and must not be reported as one number.
 *
 * All data is synthetic.
 */
import scenarios from './autonomy-scenarios.json' with { type: 'json' };
import { MockNicheWaveAdapter } from '../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowScheduler } from '../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { InMemoryWorkflowStore } from '../src/adapters/state/in-memory-workflow-store.js';
import { repairRequestSchema } from '../src/domain/request.js';
import { WorkflowEngine } from '../src/workflows/workflow-engine.js';

const MARKETPLACE_REASONS = new Set([
  'no-eligible-technicians',
  'candidate-pool-exhausted',
  'outreach-delivery-failed',
]);

const classificationFailures: string[] = [];
const marketplaceBlocks: string[] = [];
const missedStops: string[] = [];

let autonomousRequired = 0;
let autonomousAchieved = 0;
let stopRequired = 0;
let stopAchieved = 0;

for (const [index, scenario] of scenarios.entries()) {
  const request = repairRequestSchema.parse({
    id: `autonomy-${index}`,
    customerId: 'synthetic-autonomy-customer',
    description: scenario.description,
    location: { city: 'Phoenix', region: 'AZ', latitude: 33.4484, longitude: -112.074 },
    rv: { type: 'Travel Trailer' },
    constraints: [],
    requestedAt: '2026-08-17T10:00:00.000Z',
  });
  const engine = new WorkflowEngine(
    new InMemoryWorkflowStore(),
    new MockNicheWaveAdapter(),
    new InMemoryWorkflowScheduler(),
    () => new Date('2026-08-17T10:00:01.000Z'),
  );
  const state = await engine.start(request);
  const escalated = state.status === 'HUMAN_ESCALATION';
  const rawReason = state.events.find(({ type }) => type === 'HUMAN_ESCALATION')?.details?.reason;
  const reason = typeof rawReason === 'string' ? rawReason : '';
  const label = `${scenario.policy}/${scenario.name}`;

  if (scenario.mustBeAutonomous === true) {
    autonomousRequired += 1;
    if (!escalated) {
      autonomousAchieved += 1;
    } else if (MARKETPLACE_REASONS.has(reason)) {
      marketplaceBlocks.push(`  ${label} — ${reason}`);
    } else {
      classificationFailures.push(`  ${label} — ${reason}`);
    }
  } else if (scenario.mustBeAutonomous === false) {
    stopRequired += 1;
    if (escalated) stopAchieved += 1;
    else missedStops.push(`  ${label} — proceeded without a person`);
  }
}

const pct = (value: number, total: number) =>
  total === 0 ? 100 : Math.round((value / total) * 1000) / 10;

const metrics = {
  scenarios: scenarios.length,
  autonomousCompletionPercent: pct(autonomousAchieved, autonomousRequired),
  requiredStopAccuracyPercent: pct(stopAchieved, stopRequired),
  classificationFailures: classificationFailures.length,
  marketplaceBlocks: marketplaceBlocks.length,
  missedRequiredStops: missedStops.length,
};

console.log(JSON.stringify(metrics, null, 2));

if (classificationFailures.length) {
  console.error(`\nEscalated by classification (policy section B violated):`);
  for (const line of classificationFailures) console.error(line);
}
if (marketplaceBlocks.length) {
  console.error(`\nEscalated by empty marketplace (roster limitation, policy A.3):`);
  for (const line of marketplaceBlocks) console.error(line);
}
if (missedStops.length) {
  console.error(`\nRequired stops that did not happen:`);
  for (const line of missedStops) console.error(line);
}

const failed = [
  ['requiredStopAccuracyPercent', metrics.requiredStopAccuracyPercent === 100],
  ['classificationFailures', metrics.classificationFailures === 0],
].filter(([, ok]) => !ok);

if (failed.length) {
  console.error(`\nFailed gates: ${failed.map(([name]) => name).join(', ')}`);
  process.exitCode = 1;
}
