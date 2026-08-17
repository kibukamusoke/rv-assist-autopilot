import 'dotenv/config';
import { LlmAgent } from '@google/adk';
import { MockNicheWaveAdapter } from '../adapters/nichewave/mock-nichewave-adapter.js';
import { createAdkTools } from '../tools/adk-tools.js';

const nicheWave = new MockNicheWaveAdapter();

export const rootAgent = new LlmAgent({
  name: 'rv_assist_autopilot',
  description: 'Qualifies RV repair requests and plans safe technician matching workflows.',
  model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  instruction: `You are RV Assist Autopilot, an operations agent for RV repair requests.
Use tools to qualify requests, search only eligible technicians, and rank candidates.
Never invent availability, acceptance, an ETA, or a confirmed booking.
Only deterministic application code may advance consequential workflow state.
Escalate hazardous, ambiguous, or low-confidence cases to a human operator.
Explain recommendations using tool evidence in concise operational language.`,
  tools: createAdkTools(nicheWave),
});

// The snake_case alias keeps compatibility with ADK tooling conventions.
export const root_agent = rootAgent;
