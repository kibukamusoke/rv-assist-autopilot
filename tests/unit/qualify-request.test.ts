import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import { repairRequestSchema } from '../../src/domain/request.js';
import { qualifyRequest } from '../../src/tools/qualify-request.js';

describe('qualifyRequest', () => {
  it('classifies the synthetic Phoenix request as high-urgency HVAC', () => {
    const result = qualifyRequest(repairRequestSchema.parse(request));
    expect(result).toMatchObject({ category: 'hvac', urgency: 'high', confidence: 0.9 });
    expect(result.safetyFlags).toContain('vulnerable-occupant');
  });

  it('flags dangerous electrical symptoms for escalation', () => {
    const result = qualifyRequest(
      repairRequestSchema.parse({
        ...request,
        id: 'dangerous-electrical',
        description: 'The electrical panel is sparking and smoke is coming from the breaker.',
        constraints: [],
      }),
    );
    expect(result.urgency).toBe('emergency');
    expect(result.safetyFlags).toContain('possible-electrical-hazard');
  });

  it('respects appliance and roof specificity and simple hazard negation', () => {
    const base = repairRequestSchema.parse(request);
    expect(
      qualifyRequest({ ...base, description: 'The refrigerator stopped cooling our food.' })
        .category,
    ).toBe('appliance');
    expect(
      qualifyRequest({ ...base, description: 'Rain is coming through a leak in the RV roof.' })
        .category,
    ).toBe('roof');
    const outlet = qualifyRequest({
      ...base,
      description: 'An electrical outlet stopped working but there is no smoke.',
      constraints: [],
    });
    expect(outlet.urgency).toBe('medium');
    expect(outlet.safetyFlags).not.toContain('possible-electrical-hazard');
  });
});
