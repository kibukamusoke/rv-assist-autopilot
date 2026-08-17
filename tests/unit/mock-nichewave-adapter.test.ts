import { describe, expect, it } from 'vitest';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';

describe('MockNicheWaveAdapter', () => {
  it('excludes unverified and unavailable technicians from urgent searches', async () => {
    const results = await new MockNicheWaveAdapter().searchTechnicians({
      category: 'hvac',
      latitude: 33.4484,
      longitude: -112.074,
      requireToday: true,
    });
    expect(results.map(({ id }) => id)).toEqual(['tech-desert-mobile', 'tech-phoenix-rv']);
  });
});
