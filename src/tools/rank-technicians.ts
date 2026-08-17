import type { Qualification } from '../domain/request.js';
import type { RankedTechnician, Technician } from '../domain/technician.js';

export function rankTechnicians(
  technicians: Technician[],
  qualification: Qualification,
): RankedTechnician[] {
  return technicians
    .map((technician) => {
      const specialty = technician.specialties.includes(qualification.category) ? 40 : 0;
      const availability = technician.availableToday ? 20 : 0;
      const reliability = technician.responseRate * 20;
      const quality = (technician.rating / 5) * 15;
      const distance = Math.max(0, 5 - technician.syntheticDistanceMiles / 10);
      return {
        ...technician,
        score: Math.round((specialty + availability + reliability + quality + distance) * 10) / 10,
        reasons: [
          `${qualification.category} specialist`,
          technician.availableToday ? 'available today' : 'future availability only',
          `${Math.round(technician.responseRate * 100)}% response rate`,
        ],
      };
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}
