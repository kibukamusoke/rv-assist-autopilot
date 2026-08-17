import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import type { NicheWaveAdapter } from '../adapters/nichewave/nichewave-adapter.js';
import { qualificationSchema, repairRequestSchema, serviceCategories } from '../domain/request.js';
import { technicianSchema } from '../domain/technician.js';
import { qualifyRequest } from './qualify-request.js';
import { rankTechnicians } from './rank-technicians.js';

export function createAdkTools(nicheWave: NicheWaveAdapter): FunctionTool[] {
  const qualify = new FunctionTool({
    name: 'qualify_repair_request',
    description: 'Extracts a deterministic initial category, urgency, and safety flags.',
    parameters: z.object({ request: repairRequestSchema }),
    execute: ({ request }) => qualifyRequest(request),
  });

  const search = new FunctionTool({
    name: 'search_qualified_technicians',
    description: 'Returns verified technicians within their service area for a repair category.',
    parameters: z.object({
      category: z.enum(serviceCategories),
      latitude: z.number(),
      longitude: z.number(),
      requireToday: z.boolean(),
    }),
    execute: (input) => nicheWave.searchTechnicians(input),
  });

  const rank = new FunctionTool({
    name: 'rank_candidate_technicians',
    description: 'Ranks already eligible technicians using transparent deterministic criteria.',
    parameters: z.object({
      technicians: z.array(technicianSchema),
      qualification: qualificationSchema,
    }),
    execute: ({ technicians, qualification }) => rankTechnicians(technicians, qualification),
  });

  return [qualify, search, rank];
}
