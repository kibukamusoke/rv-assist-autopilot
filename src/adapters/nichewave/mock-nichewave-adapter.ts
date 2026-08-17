import type { Technician } from '../../domain/technician.js';
import { syntheticTechnicians } from './mock-data.js';
import type { AcceptedMatch, NicheWaveAdapter, TechnicianSearch } from './nichewave-adapter.js';

export class MockNicheWaveAdapter implements NicheWaveAdapter {
  readonly createdJobs: AcceptedMatch[] = [];

  async searchTechnicians(search: TechnicianSearch): Promise<Technician[]> {
    return syntheticTechnicians.filter(
      (technician) =>
        technician.verified &&
        technician.specialties.includes(search.category) &&
        technician.syntheticDistanceMiles <= technician.serviceRadiusMiles &&
        (!search.requireToday || technician.availableToday),
    );
  }

  async getTechnician(technicianId: string): Promise<Technician | null> {
    return syntheticTechnicians.find(({ id }) => id === technicianId) ?? null;
  }

  async createConfirmedJob(match: AcceptedMatch): Promise<{ externalJobId: string }> {
    if (!match.acceptedAt) throw new Error('Technician acceptance is required');
    const existing = this.createdJobs.find(
      ({ idempotencyKey }) => idempotencyKey === match.idempotencyKey,
    );
    if (existing) return { externalJobId: `mock-job-${existing.requestId}` };
    this.createdJobs.push(match);
    return { externalJobId: `mock-job-${match.requestId}` };
  }
}
