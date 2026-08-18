import type { Qualification, RepairRequest, ServiceCategory } from '../domain/request.js';

/**
 * Canonical safety flag vocabulary.
 *
 * Every consumer (workflow escalation, ADK invariant enforcement, evaluations)
 * must classify flags through `isEscalationFlag` / `isPhysicalHazardFlag` rather
 * than by inspecting flag spelling. A previous revision escalated on
 * `flag.includes('hazard')`, which silently ignored `possible-gas-leak`.
 */
export const SAFETY_FLAGS = {
  electricalHazard: 'possible-electrical-hazard',
  gasLeak: 'possible-gas-leak',
  carbonMonoxide: 'possible-carbon-monoxide',
  fireHazard: 'possible-fire-hazard',
  promptInjection: 'possible-prompt-injection',
  vulnerableOccupant: 'vulnerable-occupant',
} as const;

/** Flags that do not, on their own, require a human. */
const NON_ESCALATING_FLAGS = new Set<string>([SAFETY_FLAGS.vulnerableOccupant]);

/** Flags describing a physical danger to occupants. These force emergency urgency. */
const PHYSICAL_HAZARD_FLAGS = new Set<string>([
  SAFETY_FLAGS.electricalHazard,
  SAFETY_FLAGS.gasLeak,
  SAFETY_FLAGS.carbonMonoxide,
  SAFETY_FLAGS.fireHazard,
]);

/**
 * Fail-safe by construction: any flag that is not explicitly allow-listed as
 * benign requires a human. An unrecognised flag invented by a model escalates
 * rather than being ignored.
 */
export function isEscalationFlag(flag: string): boolean {
  return !NON_ESCALATING_FLAGS.has(flag);
}

export function isPhysicalHazardFlag(flag: string): boolean {
  return PHYSICAL_HAZARD_FLAGS.has(flag);
}

export const urgencyOrder = ['low', 'medium', 'high', 'emergency'] as const;
export type Urgency = (typeof urgencyOrder)[number];

/** Returns the more severe of two urgencies. Used so a model can never downgrade. */
export function maxUrgency(left: Urgency, right: Urgency): Urgency {
  return urgencyOrder.indexOf(left) >= urgencyOrder.indexOf(right) ? left : right;
}

/**
 * Interior areas are the weakest possible signal: enough to show the request is
 * actionable, never enough to pick a trade. They are scored below every named
 * component so "bathroom sink drain" routes to plumbing, not to a generalist
 * on the strength of the word "bathroom".
 */
const GENERAL_AREA_TERMS = ['kitchen', 'bathroom', 'bedroom', 'living area'];
const AREA_TERM_WEIGHT = 1;

/**
 * Components and systems a general mobile RV technician handles. Without this
 * vocabulary an awning, slide-out, or stabilizer jack matched nothing, fell to
 * an unclassified state, and was escalated to a human — the exact failure mode
 * the autonomy policy exists to prevent.
 */
const GENERAL_COMPONENT_TERMS = [
  'awning',
  'slide',
  'slide out',
  'slideout',
  'slide-out',
  'jack',
  'jacks',
  'stabilizer',
  'leveling',
  'levelling',
  'step',
  'steps',
  'door',
  'doors',
  'latch',
  'lock',
  'window',
  'windshield',
  'screen',
  'ladder',
  'mount',
  'bumper',
  'hitch',
  'compartment',
  'storage',
  'cabinet',
  'cabinets',
  'drawer',
  'floor',
  'flooring',
  'carpet',
  'subfloor',
  'wall',
  'panel',
  'trim',
  'seal',
  'gasket',
  'table',
  'dinette',
  'bed',
  'bunk',
  'mattress',
  'sofa',
  'blind',
  'blinds',
  'shade',
  'vent',
  'fan',
  'camera',
  'monitor',
  'antenna',
  'tv',
  'television',
  'speaker',
  'tire',
  'tires',
  'wheel',
  'axle',
  'brake',
  'brakes',
  ...GENERAL_AREA_TERMS,
];

/**
 * `general` is a routable trade, not a failure state. Most RV service is general
 * mobile work, and the roster carries a `general` specialty for exactly that.
 * See docs/technical/autonomy-and-escalation-policy.md, section B.
 */
const categoryTerms: Array<[ServiceCategory, string[]]> = [
  ['appliance', ['refrigerator', 'fridge', 'freezer', 'oven', 'stove', 'microwave', 'appliance']],
  ['roof', ['roof', 'ceiling leak']],
  [
    'electrical',
    [
      'electrical',
      'outlet',
      'breaker',
      'sparking',
      'smoke',
      'wiring',
      'converter',
      'inverter',
      'generator',
      'solar',
      'battery',
      'batteries',
      'shore power',
    ],
  ],
  [
    'plumbing',
    [
      'plumbing',
      'toilet',
      'pipe',
      'water',
      'leak',
      'faucet',
      'sewer',
      'tank',
      'sink',
      'drain',
      'shower',
      'water pump',
    ],
  ],
  [
    'hvac',
    [
      'ac',
      'a/c',
      'air conditioner',
      'air conditioning',
      'cooling',
      'furnace',
      'hvac',
      'thermostat',
    ],
  ],
  ['general', GENERAL_COMPONENT_TERMS],
];

const electricalTerms = [
  'smoke',
  'smoking',
  'sparking',
  'sparks',
  'sparked',
  'arcing',
  'electric shock',
  'electrical shock',
  'shocked me',
  'got shocked',
  'exposed wire',
  'live wire',
  'melted wire',
  'burning wire',
];

const electricalNouns = [
  'wiring',
  'wire',
  'wires',
  'cable',
  'cabling',
  'converter',
  'inverter',
  'outlet',
  'breaker',
  'panel',
  'socket',
  'terminal',
];
const electricalDamageCues = [
  'melted',
  'melting',
  'burnt',
  'burned',
  'burning',
  'charred',
  'scorched',
  'smoking',
  'smoked',
  'sparking',
  'sparked',
  'arcing',
  'hot to the touch',
];

const gasNouns = ['propane', 'gas', 'lpg', 'lp gas'];
const gasCues = [
  'smell',
  'smells',
  'smelling',
  'smelt',
  'odor',
  'odour',
  'fumes',
  'leak',
  'leaks',
  'leaking',
  'leaked',
  'hiss',
  'hissing',
  'rotten egg',
  // Phoenix is a heavily bilingual service area; the highest-consequence hazard
  // cue is worth recognising in Spanish rather than relying on the model alone.
  'huele',
  'huele a',
  'olor',
  'fuga',
  'fugas',
];

const carbonMonoxideTerms = ['carbon monoxide', 'co alarm', 'co detector', 'co alert'];

const fireTerms = [
  'fire',
  'flame',
  'flames',
  'burning smell',
  'smell of burning',
  'smells like burning',
  'burning',
  'smoldering',
  'smouldering',
  'charred',
  'scorched',
  'melting',
];

const vulnerableOccupantTerms = [
  'pet',
  'pets',
  'dog',
  'dogs',
  'cat',
  'cats',
  'puppy',
  'kitten',
  'infant',
  'baby',
  'babies',
  'toddler',
  'child',
  'children',
  'kids',
  'elderly',
  'disabled',
  'wheelchair',
  'oxygen',
];

/**
 * High-signal instruction-injection phrases. Customer free text is untrusted
 * input that reaches an LLM prompt, so an apparent attempt to steer the agent
 * is treated as a reason for human review rather than something to sanitise.
 */
const injectionPhrases = [
  'ignore previous instruction',
  'ignore all previous',
  'ignore the above',
  'ignore your instruction',
  'disregard previous',
  'disregard the above',
  'disregard all previous',
  'system prompt',
  'you are now',
  'new instructions',
  'do not escalate',
  'skip the safety',
  'skip safety',
  'set urgency',
  'set the urgency',
  'mark this as',
  'classify this as',
  'safetyflags',
  'safety_flags',
  'respond only with',
  'output only',
  'developer mode',
  'pretend you',
];

const urgentPhrase = /\b(today|tonight|urgent|urgently|asap|immediately|right now)\b/;
const extremeHeat = /\b(1[0-9]{2})\s*(°|deg|degrees|f\b|fahrenheit)|\bextreme heat\b/;

export function qualifyRequest(request: RepairRequest): Qualification {
  const text = `${request.description} ${request.constraints.join(' ')}`.toLowerCase();

  const match = selectCategory(text);
  const category = match?.category ?? 'general';

  const safetyFlags: string[] = [];
  if (
    electricalTerms.some((term) => hasUnnegatedTerm(text, term)) ||
    hasProximityHazard(text, electricalNouns, electricalDamageCues)
  ) {
    safetyFlags.push(SAFETY_FLAGS.electricalHazard);
  }
  if (hasGasHazard(text)) safetyFlags.push(SAFETY_FLAGS.gasLeak);
  if (carbonMonoxideTerms.some((term) => hasUnnegatedTerm(text, term))) {
    safetyFlags.push(SAFETY_FLAGS.carbonMonoxide);
  }
  if (fireTerms.some((term) => hasUnnegatedTerm(text, term))) {
    safetyFlags.push(SAFETY_FLAGS.fireHazard);
  }
  if (injectionPhrases.some((phrase) => text.includes(phrase))) {
    safetyFlags.push(SAFETY_FLAGS.promptInjection);
  }
  if (vulnerableOccupantTerms.some((term) => matchesTerm(text, term))) {
    safetyFlags.push(SAFETY_FLAGS.vulnerableOccupant);
  }

  const physicalHazard = safetyFlags.some(isPhysicalHazardFlag);
  const elevated =
    urgentPhrase.test(text) ||
    extremeHeat.test(text) ||
    safetyFlags.includes(SAFETY_FLAGS.vulnerableOccupant);

  const baseConfidence = confidenceFor(match);

  return {
    category,
    urgency: physicalHazard ? 'emergency' : elevated ? 'high' : 'medium',
    summary: request.description.trim(),
    safetyFlags,
    // Suspected injection is never treated as a confident classification.
    confidence: safetyFlags.includes(SAFETY_FLAGS.promptInjection)
      ? Math.min(baseConfidence, 0.4)
      : baseConfidence,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary match, so `ac` does not match `jack` and `pet` does not match `carpet`. */
function matchesTerm(text: string, term: string): boolean {
  return new RegExp(`(?<![\\w/])${escapeRegExp(term)}(?![\\w/])`).test(text);
}

const negationPrefix = /\b(no|not|without|never|zero|isn't|aren't|wasn't)\b[\w\s'-]{0,12}$/;

/**
 * True when the term appears at least once *without* a nearby negation.
 * Checks every occurrence: "no smoke detector, but smoke is pouring out"
 * must still raise the hazard.
 */
function hasUnnegatedTerm(text: string, term: string): boolean {
  const pattern = new RegExp(`(?<![\\w/])${escapeRegExp(term)}(?![\\w/])`, 'g');
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const prefix = text.slice(Math.max(0, index - 26), index);
    if (!negationPrefix.test(prefix)) return true;
  }
  return false;
}

const proximityWindow = 45;

/**
 * True when a subject noun appears near a hazard cue, in either order.
 * Fixed phrase lists alone missed "I smell gas", "the propane line is leaking",
 * and "the wiring near the converter had melted".
 */
function hasProximityHazard(text: string, nouns: string[], cues: string[]): boolean {
  for (const noun of nouns) {
    const pattern = new RegExp(`(?<![\\w/])${escapeRegExp(noun)}(?![\\w/])`, 'g');
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const prefix = text.slice(Math.max(0, index - 26), index);
      if (negationPrefix.test(prefix)) continue;
      const window = text.slice(
        Math.max(0, index - proximityWindow),
        index + noun.length + proximityWindow,
      );
      if (cues.some((cue) => matchesTerm(window, cue))) return true;
    }
  }
  return false;
}

function hasGasHazard(text: string): boolean {
  return hasProximityHazard(text, gasNouns, gasCues);
}

/**
 * Most specific match wins, measured by matched term length, with declaration
 * order breaking ties. First-list-wins mis-routed "roof air conditioner" to the
 * roofing trade because `roof` was checked before `air conditioner`.
 */
/**
 * Confidence below this threshold means the request named no RV system,
 * component, or trade — the only classification-derived reason to involve a
 * human. A recognised component always scores above it, so `general` no longer
 * escalates by itself.
 */
export const NO_ACTIONABLE_SIGNAL_CONFIDENCE = 0.5;

const SPECIALTY_CONFIDENCE = 0.9;
const GENERAL_CONFIDENCE = 0.75;
const NO_SIGNAL_CONFIDENCE = 0.3;

interface CategoryMatch {
  category: ServiceCategory;
  length: number;
}

function confidenceFor(match: CategoryMatch | undefined): number {
  if (!match) return NO_SIGNAL_CONFIDENCE;
  return match.category === 'general' ? GENERAL_CONFIDENCE : SPECIALTY_CONFIDENCE;
}

function selectCategory(text: string): CategoryMatch | undefined {
  let best: CategoryMatch | undefined;
  for (const [category, terms] of categoryTerms) {
    for (const term of terms) {
      if (!matchesTerm(text, term)) continue;
      const weight = GENERAL_AREA_TERMS.includes(term) ? AREA_TERM_WEIGHT : term.length;
      if (!best || weight > best.length) best = { category, length: weight };
    }
  }
  return best;
}
