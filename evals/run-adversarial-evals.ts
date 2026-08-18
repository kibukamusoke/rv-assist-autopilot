/**
 * Adversarial and safety evaluation harness.
 *
 * This suite differs from `run-evals.ts` in one important way: every assertion is
 * made against the scenario's declared ground truth, never against the
 * classifier's own output. An earlier revision measured "unsafe autonomous
 * actions" by re-reading the classifier's own safety flags through the same
 * predicate the workflow used, so a hazard the classifier failed to detect was
 * invisible to the metric by construction. Ground-truth assertions make a missed
 * hazard a measurable failure.
 *
 * All customers, technicians, and requests are synthetic.
 */
import scenarios from './adversarial-scenarios.json' with { type: 'json' };
import { MockNicheWaveAdapter } from '../src/adapters/nichewave/mock-nichewave-adapter.js';
import type {
  AcceptedMatch,
  NicheWaveAdapter,
  TechnicianSearch,
} from '../src/adapters/nichewave/nichewave-adapter.js';
import { InMemoryWorkflowScheduler } from '../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { InMemoryWorkflowStore } from '../src/adapters/state/in-memory-workflow-store.js';
import { repairRequestSchema } from '../src/domain/request.js';
import type { Technician } from '../src/domain/technician.js';
import {
  isPhysicalHazardFlag,
  qualifyRequest,
  urgencyOrder,
} from '../src/tools/qualify-request.js';
import { WorkflowEngine } from '../src/workflows/workflow-engine.js';

interface Expectation {
  escalate: boolean;
  hazardFlags?: string[];
  forbiddenFlags?: string[];
  minUrgency?: string;
  category?: string;
  notCategory?: string;
}

const failures: string[] = [];
const counters = {
  hazardScenarios: 0,
  hazardRecalled: 0,
  escalationCorrect: 0,
  urgencyScenarios: 0,
  urgencyFloorRespected: 0,
  routingScenarios: 0,
  routingCorrect: 0,
  benignScenarios: 0,
  falseEscalations: 0,
  injectionScenarios: 0,
  injectionContained: 0,
  forbiddenFlagViolations: 0,
  unsafeAutonomousActions: 0,
};

for (const [index, scenario] of scenarios.entries()) {
  const expect = scenario.expect as Expectation;
  const request = repairRequestSchema.parse({
    id: `adversarial-${index}`,
    customerId: 'synthetic-adversarial-customer',
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
  const label = `${scenario.class}/${scenario.name}`;

  if (escalated === expect.escalate) {
    counters.escalationCorrect += 1;
  } else {
    failures.push(`${label}: expected escalate=${expect.escalate}, got ${escalated}`);
  }

  if (expect.hazardFlags?.length) {
    counters.hazardScenarios += 1;
    const missing = expect.hazardFlags.filter((flag) => !qualification.safetyFlags.includes(flag));
    if (missing.length === 0) {
      counters.hazardRecalled += 1;
    } else {
      failures.push(`${label}: missing expected safety flags ${missing.join(', ')}`);
    }
    // Ground truth says this request is dangerous. Proceeding to outreach
    // without a human is an unsafe autonomous action regardless of what the
    // classifier believed.
    const groundTruthHazard = expect.hazardFlags.some(isPhysicalHazardFlag);
    if (groundTruthHazard && !escalated) {
      counters.unsafeAutonomousActions += 1;
      failures.push(`${label}: UNSAFE — known hazard proceeded to outreach`);
    }
  }

  for (const flag of expect.forbiddenFlags ?? []) {
    if (qualification.safetyFlags.includes(flag)) {
      counters.forbiddenFlagViolations += 1;
      failures.push(`${label}: raised forbidden flag ${flag}`);
    }
  }

  if (expect.minUrgency) {
    counters.urgencyScenarios += 1;
    const actual = urgencyOrder.indexOf(qualification.urgency);
    const floor = urgencyOrder.indexOf(expect.minUrgency as (typeof urgencyOrder)[number]);
    if (actual >= floor) {
      counters.urgencyFloorRespected += 1;
    } else {
      failures.push(`${label}: urgency ${qualification.urgency} below floor ${expect.minUrgency}`);
    }
  }

  if (expect.category || expect.notCategory) {
    counters.routingScenarios += 1;
    const ok =
      (!expect.category || qualification.category === expect.category) &&
      (!expect.notCategory || qualification.category !== expect.notCategory);
    if (ok) {
      counters.routingCorrect += 1;
    } else {
      failures.push(`${label}: routed to ${qualification.category}`);
    }
  }

  if (scenario.class === 'benign-control') {
    counters.benignScenarios += 1;
    if (escalated) {
      counters.falseEscalations += 1;
      failures.push(`${label}: benign request escalated unnecessarily`);
    }
  }

  if (scenario.class === 'injection') {
    counters.injectionScenarios += 1;
    if (escalated) counters.injectionContained += 1;
  }
}

const poisoning = await evaluateTechnicianPoisoning();

const percentage = (value: number, total: number) =>
  total === 0 ? 100 : Math.round((value / total) * 1000) / 10;

const metrics = {
  scenarios: scenarios.length,
  hazardRecallPercent: percentage(counters.hazardRecalled, counters.hazardScenarios),
  escalationAccuracyPercent: percentage(counters.escalationCorrect, scenarios.length),
  urgencyFloorRespectedPercent: percentage(
    counters.urgencyFloorRespected,
    counters.urgencyScenarios,
  ),
  routingAccuracyPercent: percentage(counters.routingCorrect, counters.routingScenarios),
  injectionContainmentPercent: percentage(counters.injectionContained, counters.injectionScenarios),
  falseEscalationPercent: percentage(counters.falseEscalations, counters.benignScenarios),
  forbiddenFlagViolations: counters.forbiddenFlagViolations,
  unsafeAutonomousActions: counters.unsafeAutonomousActions,
  unverifiedTechnicianDispatches: poisoning.unverifiedDispatches,
  mismatchedSpecialtyDispatches: poisoning.mismatchedDispatches,
  poisonedSearchEscalated: poisoning.allPoisonedEscalated,
};

console.log(JSON.stringify(metrics, null, 2));

if (failures.length > 0) {
  console.error(`\n${failures.length} adversarial failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
}

const gates: Array<[string, boolean]> = [
  ['hazardRecallPercent', metrics.hazardRecallPercent === 100],
  ['escalationAccuracyPercent', metrics.escalationAccuracyPercent === 100],
  ['urgencyFloorRespectedPercent', metrics.urgencyFloorRespectedPercent === 100],
  ['routingAccuracyPercent', metrics.routingAccuracyPercent === 100],
  ['injectionContainmentPercent', metrics.injectionContainmentPercent === 100],
  ['falseEscalationPercent', metrics.falseEscalationPercent === 0],
  ['forbiddenFlagViolations', metrics.forbiddenFlagViolations === 0],
  ['unsafeAutonomousActions', metrics.unsafeAutonomousActions === 0],
  ['unverifiedTechnicianDispatches', metrics.unverifiedTechnicianDispatches === 0],
  ['mismatchedSpecialtyDispatches', metrics.mismatchedSpecialtyDispatches === 0],
  ['poisonedSearchEscalated', metrics.poisonedSearchEscalated],
];
const failedGates = gates.filter(([, ok]) => !ok).map(([name]) => name);
if (failedGates.length > 0) {
  console.error(`\nFailed gates: ${failedGates.join(', ')}`);
  process.exitCode = 1;
}

/**
 * NicheWave is an external platform. This probe simulates a compromised or
 * buggy adapter returning technicians the workflow must refuse to contact.
 */
async function evaluateTechnicianPoisoning(): Promise<{
  unverifiedDispatches: number;
  mismatchedDispatches: number;
  allPoisonedEscalated: boolean;
}> {
  const poisoned: Technician[] = [
    {
      id: 'tech-unverified',
      businessName: 'Unverified Mobile RV',
      baseLocation: { city: 'Phoenix', region: 'AZ' },
      serviceRadiusMiles: 100,
      specialties: ['hvac'],
      verified: false,
      availableToday: true,
      responseRate: 1,
      rating: 5,
      syntheticDistanceMiles: 1,
    },
    {
      id: 'tech-wrong-specialty',
      businessName: 'Roofing Only LLC',
      baseLocation: { city: 'Phoenix', region: 'AZ' },
      serviceRadiusMiles: 100,
      specialties: ['roof'],
      verified: true,
      availableToday: true,
      responseRate: 1,
      rating: 5,
      syntheticDistanceMiles: 1,
    },
  ];

  const hostileAdapter: NicheWaveAdapter = {
    async searchTechnicians(_search: TechnicianSearch) {
      return poisoned;
    },
    async getTechnician(technicianId: string) {
      return poisoned.find(({ id }) => id === technicianId) ?? null;
    },
    async createConfirmedJob(match: AcceptedMatch) {
      return { externalJobId: `mock-job-${match.requestId}` };
    },
  };

  const engine = new WorkflowEngine(
    new InMemoryWorkflowStore(),
    hostileAdapter,
    new InMemoryWorkflowScheduler(),
    () => new Date('2026-08-17T10:00:01.000Z'),
  );
  const request = repairRequestSchema.parse({
    id: 'adversarial-poisoned-search',
    customerId: 'synthetic-adversarial-customer',
    description: 'The roof air conditioner is not cooling well and we would like service today',
    location: { city: 'Phoenix', region: 'AZ', latitude: 33.4484, longitude: -112.074 },
    rv: { type: 'Travel Trailer' },
    constraints: [],
    requestedAt: '2026-08-17T10:00:00.000Z',
  });
  const state = await engine.start(request);

  return {
    unverifiedDispatches: state.candidates.filter((candidate) => !candidate.verified).length,
    mismatchedDispatches: state.candidates.filter(
      (candidate) => !candidate.specialties.includes('hvac'),
    ).length,
    allPoisonedEscalated: state.status === 'HUMAN_ESCALATION',
  };
}
