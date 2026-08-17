import type { ServiceCategory } from '../../domain/request.js';
import type { Technician } from '../../domain/technician.js';

export interface TechnicianSearch {
  category: ServiceCategory;
  latitude: number;
  longitude: number;
  requireToday: boolean;
}

export interface AcceptedMatch {
  requestId: string;
  technicianId: string;
  acceptedAt: string;
  idempotencyKey: string;
}

export interface NicheWaveAdapter {
  searchTechnicians(search: TechnicianSearch): Promise<Technician[]>;
  getTechnician(technicianId: string): Promise<Technician | null>;
  createConfirmedJob(match: AcceptedMatch): Promise<{ externalJobId: string }>;
}
