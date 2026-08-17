import { describe, expect, it } from 'vitest';
import { syntheticTechnicians } from '../../src/adapters/nichewave/mock-data.js';
import { rankTechnicians } from '../../src/tools/rank-technicians.js';

describe('rankTechnicians', () => {
  it('ranks reliably and deterministically', () => {
    const ranked = rankTechnicians(syntheticTechnicians.slice(0, 2), {
      category: 'hvac',
      urgency: 'high',
      summary: 'AC failure',
      safetyFlags: [],
      confidence: 0.9,
    });
    expect(ranked.map(({ id }) => id)).toEqual(['tech-desert-mobile', 'tech-phoenix-rv']);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});
