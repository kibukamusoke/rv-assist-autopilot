import scenarios from './scenarios.json' with { type: 'json' };
import {
  AdkRequestQualifier,
  InMemoryAdkQualificationRunner,
} from '../src/agents/adk-request-qualifier.js';
import { DeterministicRequestQualifier } from '../src/agents/request-qualifier.js';
import { loadEnvironment } from '../src/config/environment.js';
import { repairRequestSchema } from '../src/domain/request.js';

const environment = loadEnvironment();
if (!environment.GOOGLE_GENAI_USE_VERTEXAI && !environment.GOOGLE_GENAI_API_KEY) {
  throw new Error('Set Vertex AI environment variables or GOOGLE_GENAI_API_KEY before live evals');
}

const qualifier = new AdkRequestQualifier(
  new InMemoryAdkQualificationRunner(environment.GEMINI_MODEL),
  environment.GEMINI_MODEL,
  new DeterministicRequestQualifier(),
  Math.max(environment.GEMINI_TIMEOUT_MS, 30_000),
);
const counters = {
  categoryCorrect: 0,
  urgencyCorrect: 0,
  requiredToolUsed: 0,
  structuredResponses: 0,
  fallbacks: 0,
};

for (const [index, scenario] of scenarios.entries()) {
  const request = repairRequestSchema.parse({
    id: `adk-live-eval-${index}`,
    customerId: 'synthetic-adk-eval-customer',
    description: scenario.description,
    location: { city: 'Phoenix', region: 'AZ', latitude: 33.4484, longitude: -112.074 },
    rv: { type: 'Travel Trailer' },
    constraints: [],
    requestedAt: '2026-08-17T10:00:00.000Z',
  });
  const result = await qualifier.qualify(request);
  if (result.qualification.category === scenario.category) counters.categoryCorrect += 1;
  if (result.qualification.urgency === scenario.urgency) counters.urgencyCorrect += 1;
  if (result.trace.toolCalls?.includes('calculate_safety_baseline')) counters.requiredToolUsed += 1;
  if (result.trace.source === 'adk-gemini') counters.structuredResponses += 1;
  if (result.trace.source === 'deterministic-fallback') counters.fallbacks += 1;
}

const percentage = (value: number) => Math.round((value / scenarios.length) * 1000) / 10;
const metrics = {
  model: environment.GEMINI_MODEL,
  scenarios: scenarios.length,
  categoryAccuracyPercent: percentage(counters.categoryCorrect),
  urgencyAccuracyPercent: percentage(counters.urgencyCorrect),
  requiredToolUsePercent: percentage(counters.requiredToolUsed),
  structuredResponsePercent: percentage(counters.structuredResponses),
  fallbackCount: counters.fallbacks,
};

console.log(JSON.stringify(metrics, null, 2));
if (
  metrics.categoryAccuracyPercent < 90 ||
  metrics.urgencyAccuracyPercent < 90 ||
  metrics.requiredToolUsePercent !== 100 ||
  metrics.structuredResponsePercent !== 100 ||
  metrics.fallbackCount !== 0
) {
  process.exitCode = 1;
}
