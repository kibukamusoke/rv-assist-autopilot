import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.string().default('info'),
  STATE_STORE: z.enum(['memory', 'firestore']).default('memory'),
  EVENT_BUS: z.enum(['memory', 'pubsub']).default('memory'),
  WORKFLOW_SCHEDULER: z.enum(['memory', 'cloud-tasks']).default('memory'),
  NICHEWAVE_ADAPTER: z.enum(['mock', 'http']).default('mock'),
  OUTREACH_ADAPTER: z.literal('mock').default('mock'),
  QUALIFIER_MODE: z.enum(['deterministic', 'gemini', 'adk']).default('deterministic'),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  GOOGLE_GENAI_USE_VERTEXAI: z.stringbool().default(false),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default('global'),
  PUBSUB_WORKFLOW_TOPIC: z.string().default('rv-assist-workflow-events'),
  CLOUD_TASKS_PROJECT: z.string().optional(),
  CLOUD_TASKS_LOCATION: z.string().default('us-west4'),
  CLOUD_TASKS_QUEUE: z.string().default('rv-assist-response-deadlines'),
  CLOUD_TASKS_TARGET_URL: z.url().default('https://placeholder.invalid/v1/events/tasks'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}
