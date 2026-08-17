import { createEvent, type Event } from '@google/adk';
import { describe, expect, it } from 'vitest';
import requestFixture from '../../samples/urgent-ac-request.json' with { type: 'json' };
import {
  AdkRequestQualifier,
  type AdkQualificationRunner,
} from '../../src/agents/adk-request-qualifier.js';
import { DeterministicRequestQualifier } from '../../src/agents/request-qualifier.js';
import { repairRequestSchema } from '../../src/domain/request.js';

class StubAdkRunner implements AdkQualificationRunner {
  constructor(private readonly events: Event[] | Error) {}

  async *run(): AsyncIterable<Event> {
    if (this.events instanceof Error) throw this.events;
    yield* this.events;
  }
}

describe('AdkRequestQualifier', () => {
  it('captures ADK tool and model evidence while enforcing deterministic safety flags', async () => {
    const toolEvent = createEvent({
      content: {
        role: 'model',
        parts: [
          {
            functionCall: {
              id: 'adk-safety-1',
              name: 'calculate_safety_baseline',
              args: { request: requestFixture },
            },
          },
        ],
      },
    });
    const finalEvent = createEvent({
      content: {
        role: 'model',
        parts: [
          {
            text: JSON.stringify({
              qualification: {
                category: 'hvac',
                urgency: 'high',
                summary: 'AC failure during extreme heat',
                safetyFlags: [],
                confidence: 0.96,
              },
              decisionSummary: 'Urgent HVAC routing is appropriate because cooling failed today.',
              evidence: ['Customer reports failed cooling', 'Temperature is 105°F'],
            }),
          },
        ],
      },
      turnComplete: true,
      modelVersion: 'gemini-test-version',
      usageMetadata: { totalTokenCount: 123 },
    });
    const qualifier = new AdkRequestQualifier(
      new StubAdkRunner([toolEvent, finalEvent]),
      'gemini-test',
      new DeterministicRequestQualifier(),
    );

    const result = await qualifier.qualify(repairRequestSchema.parse(requestFixture));

    expect(result.trace).toMatchObject({
      source: 'adk-gemini',
      framework: 'google-adk',
      agentName: 'rv_request_qualifier',
      model: 'gemini-test',
      modelVersion: 'gemini-test-version',
      toolCalls: ['calculate_safety_baseline'],
      tokenCount: 123,
    });
    expect(result.qualification.safetyFlags).toContain('vulnerable-occupant');
  });

  it('falls back when the ADK run fails', async () => {
    const qualifier = new AdkRequestQualifier(
      new StubAdkRunner(new Error('simulated ADK outage')),
      'gemini-test',
      new DeterministicRequestQualifier(),
    );

    const result = await qualifier.qualify(repairRequestSchema.parse(requestFixture));

    expect(result.trace).toMatchObject({
      source: 'deterministic-fallback',
      framework: 'google-adk',
    });
    expect(result.trace.fallbackReason).toContain('simulated ADK outage');
    expect(result.qualification).toMatchObject({ category: 'hvac', urgency: 'high' });
  });

  it('rejects an agent response that skipped the required safety tool', async () => {
    const finalEvent = createEvent({
      content: {
        role: 'model',
        parts: [
          {
            text: JSON.stringify({
              qualification: {
                category: 'hvac',
                urgency: 'high',
                summary: 'AC failure',
                safetyFlags: [],
                confidence: 0.9,
              },
              decisionSummary: 'HVAC assistance is needed.',
              evidence: ['Cooling failed'],
            }),
          },
        ],
      },
      turnComplete: true,
    });
    const qualifier = new AdkRequestQualifier(
      new StubAdkRunner([finalEvent]),
      'gemini-test',
      new DeterministicRequestQualifier(),
    );

    const result = await qualifier.qualify(repairRequestSchema.parse(requestFixture));

    expect(result.trace.source).toBe('deterministic-fallback');
    expect(result.trace.fallbackReason).toContain('required safety baseline tool');
  });
});
