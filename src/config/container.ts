import { MockNicheWaveAdapter } from '../adapters/nichewave/mock-nichewave-adapter.js';
import { MockOutreachAdapter } from '../adapters/outreach/mock-outreach-adapter.js';
import { CloudTasksWorkflowScheduler } from '../adapters/scheduling/cloud-tasks-workflow-scheduler.js';
import { InMemoryWorkflowScheduler } from '../adapters/scheduling/in-memory-workflow-scheduler.js';
import type { WorkflowScheduler } from '../adapters/scheduling/workflow-scheduler.js';
import { FirestoreWorkflowStore } from '../adapters/state/firestore-workflow-store.js';
import { InMemoryWorkflowStore } from '../adapters/state/in-memory-workflow-store.js';
import type { WorkflowStore } from '../adapters/state/workflow-store.js';
import { WorkflowEngine } from '../workflows/workflow-engine.js';
import type { Environment } from './environment.js';
import { GoogleGenAI } from '@google/genai';
import {
  DeterministicRequestQualifier,
  type RequestQualifier,
} from '../agents/request-qualifier.js';
import {
  GeminiRequestQualifier,
  GoogleGenAiStructuredGenerator,
} from '../agents/gemini-request-qualifier.js';
import {
  AdkRequestQualifier,
  InMemoryAdkQualificationRunner,
} from '../agents/adk-request-qualifier.js';

export function createWorkflowEngine(environment: Environment): WorkflowEngine {
  if (environment.NICHEWAVE_ADAPTER !== 'mock') {
    throw new Error('The NicheWave HTTP adapter contract is not implemented yet');
  }
  const store: WorkflowStore =
    environment.STATE_STORE === 'firestore'
      ? new FirestoreWorkflowStore()
      : new InMemoryWorkflowStore();
  const scheduler: WorkflowScheduler =
    environment.WORKFLOW_SCHEDULER === 'cloud-tasks'
      ? createCloudTasksScheduler(environment)
      : new InMemoryWorkflowScheduler();
  return new WorkflowEngine(
    store,
    new MockNicheWaveAdapter(),
    scheduler,
    undefined,
    createRequestQualifier(environment),
    undefined,
    new MockOutreachAdapter(),
  );
}

function createCloudTasksScheduler(environment: Environment): WorkflowScheduler {
  const project = environment.CLOUD_TASKS_PROJECT ?? environment.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error('CLOUD_TASKS_PROJECT or GOOGLE_CLOUD_PROJECT is required for Cloud Tasks');
  }
  return new CloudTasksWorkflowScheduler(
    project,
    environment.CLOUD_TASKS_LOCATION,
    environment.CLOUD_TASKS_QUEUE,
    environment.CLOUD_TASKS_TARGET_URL,
  );
}

function createRequestQualifier(environment: Environment): RequestQualifier {
  const fallback = new DeterministicRequestQualifier();
  if (environment.QUALIFIER_MODE === 'deterministic') return fallback;
  if (environment.QUALIFIER_MODE === 'adk') {
    if (!environment.GOOGLE_GENAI_USE_VERTEXAI && !environment.GOOGLE_GENAI_API_KEY) {
      throw new Error('GOOGLE_GENAI_API_KEY is required when QUALIFIER_MODE=adk without Vertex AI');
    }
    return new AdkRequestQualifier(
      new InMemoryAdkQualificationRunner(environment.GEMINI_MODEL),
      environment.GEMINI_MODEL,
      fallback,
      environment.GEMINI_TIMEOUT_MS,
    );
  }

  const client = environment.GOOGLE_GENAI_USE_VERTEXAI
    ? createVertexClient(environment)
    : createDeveloperApiClient(environment);
  return new GeminiRequestQualifier(
    new GoogleGenAiStructuredGenerator(client),
    environment.GEMINI_MODEL,
    fallback,
    environment.GEMINI_TIMEOUT_MS,
  );
}

function createDeveloperApiClient(environment: Environment): GoogleGenAI {
  if (!environment.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is required when QUALIFIER_MODE=gemini');
  }
  return new GoogleGenAI({ apiKey: environment.GOOGLE_API_KEY });
}

function createVertexClient(environment: Environment): GoogleGenAI {
  if (!environment.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for Vertex AI qualification');
  }
  return new GoogleGenAI({
    vertexai: true,
    project: environment.GOOGLE_CLOUD_PROJECT,
    location: environment.GOOGLE_CLOUD_LOCATION,
  });
}
