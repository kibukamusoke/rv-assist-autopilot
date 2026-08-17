import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import {
  GeminiRequestQualifier,
  type StructuredGenerator,
} from '../../src/agents/gemini-request-qualifier.js';
import { DeterministicRequestQualifier } from '../../src/agents/request-qualifier.js';
import { repairRequestSchema } from '../../src/domain/request.js';

class StubGenerator implements StructuredGenerator {
  constructor(private readonly result: string | Error) {}

  async generate(): Promise<string> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

describe('GeminiRequestQualifier', () => {
  it('accepts schema-validated model output and records its provenance', async () => {
    const qualifier = new GeminiRequestQualifier(
      new StubGenerator(
        JSON.stringify({
          category: 'hvac',
          urgency: 'high',
          summary: 'AC failure in extreme heat',
          safetyFlags: [],
          confidence: 0.95,
        }),
      ),
      'gemini-test',
      new DeterministicRequestQualifier(),
    );
    const result = await qualifier.qualify(repairRequestSchema.parse(request));
    expect(result.trace).toMatchObject({ source: 'gemini', model: 'gemini-test' });
    expect(result.qualification.safetyFlags).toContain('vulnerable-occupant');
  });

  it('falls back deterministically on model or schema failure', async () => {
    const qualifier = new GeminiRequestQualifier(
      new StubGenerator(new Error('simulated outage')),
      'gemini-test',
      new DeterministicRequestQualifier(),
    );
    const result = await qualifier.qualify(repairRequestSchema.parse(request));
    expect(result.trace.source).toBe('deterministic-fallback');
    expect(result.trace.fallbackReason).toContain('simulated outage');
    expect(result.qualification).toMatchObject({ category: 'hvac', urgency: 'high' });
  });
});
