import type { Qualification, RepairRequest, ServiceCategory } from '../domain/request.js';

const categoryTerms: Array<[ServiceCategory, string[]]> = [
  ['appliance', ['refrigerator', 'fridge', 'oven', 'appliance']],
  ['roof', ['roof', 'ceiling leak']],
  ['electrical', ['electrical', 'outlet', 'breaker', 'sparking', 'smoke']],
  ['plumbing', ['plumbing', 'water', 'toilet', 'pipe', 'leak']],
  ['hvac', ['ac', 'air conditioner', 'cooling', 'furnace']],
  ['general', []],
];

export function qualifyRequest(request: RepairRequest): Qualification {
  const text = `${request.description} ${request.constraints.join(' ')}`.toLowerCase();
  const matched = categoryTerms.find(([, terms]) => terms.some((term) => text.includes(term)));
  const category = matched?.[0] ?? 'general';
  const safetyFlags = [
    ...(hasUnnegatedTerm(text, 'smoke') || hasUnnegatedTerm(text, 'sparking')
      ? ['possible-electrical-hazard']
      : []),
    ...(hasUnnegatedTerm(text, 'gas smell') || hasUnnegatedTerm(text, 'propane smell')
      ? ['possible-gas-leak']
      : []),
    ...(text.includes('pet') || text.includes('dog') ? ['vulnerable-occupant'] : []),
  ];
  const emergency = safetyFlags.some((flag) => flag !== 'vulnerable-occupant');
  const high = /today|urgent|105|extreme heat|dog|pet/.test(text);

  return {
    category,
    urgency: emergency ? 'emergency' : high ? 'high' : 'medium',
    summary: request.description.trim(),
    safetyFlags,
    confidence: category === 'general' ? 0.55 : 0.9,
  };
}

function hasUnnegatedTerm(text: string, term: string): boolean {
  const index = text.indexOf(term);
  if (index < 0) return false;
  const prefix = text.slice(Math.max(0, index - 12), index);
  return !/\b(no|not|without)\s+$/.test(prefix);
}
