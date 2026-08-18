import {
  FunctionTool,
  InMemoryRunner,
  LlmAgent,
  getFunctionCalls,
  isFinalResponse,
  stringifyContent,
  type Event,
} from '@google/adk';
import { z } from 'zod';
import {
  qualificationSchema,
  repairRequestSchema,
  type Qualification,
  type RepairRequest,
} from '../domain/request.js';
import { isPhysicalHazardFlag, maxUrgency, qualifyRequest } from '../tools/qualify-request.js';
import type { QualificationResult, RequestQualifier } from './request-qualifier.js';

const agentOutputSchema = z.object({
  qualification: qualificationSchema,
  decisionSummary: z.string().min(1).max(320),
  evidence: z.array(z.string().min(1).max(160)).max(5),
});

export interface AdkQualificationRunner {
  run(input: { request: RepairRequest; abortSignal: AbortSignal }): AsyncIterable<Event>;
}

export class InMemoryAdkQualificationRunner implements AdkQualificationRunner {
  private readonly runner: InMemoryRunner;

  constructor(model: string) {
    const safetyBaseline = new FunctionTool({
      name: 'calculate_safety_baseline',
      description:
        'Calculates deterministic category, urgency, and safety flags that must be preserved.',
      parameters: z.object({ request: repairRequestSchema }),
      execute: ({ request }) => qualifyRequest(request),
    });
    const agent = new LlmAgent({
      name: 'rv_request_qualifier',
      description: 'Produces a grounded, structured qualification for one RV repair request.',
      model,
      instruction: `Classify the supplied RV repair request for operational routing.
You must call calculate_safety_baseline with the exact supplied request before responding.
Preserve every safety flag returned by that tool. Never reduce its urgency when a hazard is present.
Do not invent symptoms, technician facts, availability, or a booking.
Provide a concise decisionSummary and up to five short evidence statements based only on customer input or tool output.
Return only the required structured result. Do not reveal hidden reasoning or chain-of-thought.`,
      tools: [safetyBaseline],
      outputSchema: agentOutputSchema,
      disallowTransferToParent: true,
      disallowTransferToPeers: true,
    });
    this.runner = new InMemoryRunner({ appName: 'rv-assist-autopilot', agent });
  }

  run(input: { request: RepairRequest; abortSignal: AbortSignal }): AsyncIterable<Event> {
    return this.runner.runEphemeral({
      userId: input.request.customerId,
      newMessage: {
        role: 'user',
        parts: [{ text: JSON.stringify({ repairRequest: input.request }) }],
      },
      customMetadata: { workflowId: input.request.id },
    });
  }
}

export class AdkRequestQualifier implements RequestQualifier {
  constructor(
    private readonly runner: AdkQualificationRunner,
    private readonly model: string,
    private readonly fallback: RequestQualifier,
    private readonly timeoutMs = 8_000,
  ) {}

  async qualify(request: RepairRequest): Promise<QualificationResult> {
    const startedAt = performance.now();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);
    try {
      const trace = await this.collectEvents(request, abortController.signal);
      const output = agentOutputSchema.parse(JSON.parse(trace.finalText));
      return {
        qualification: this.enforceSafetyInvariants(request, output.qualification),
        trace: {
          source: 'adk-gemini',
          framework: 'google-adk',
          agentName: 'rv_request_qualifier',
          model: this.model,
          ...(trace.modelVersion ? { modelVersion: trace.modelVersion } : {}),
          toolCalls: trace.toolCalls,
          tokenCount: trace.tokenCount,
          decisionSummary: output.decisionSummary,
          evidence: output.evidence,
          durationMs: performance.now() - startedAt,
        },
      };
    } catch (error) {
      const fallback = await this.fallback.qualify(request);
      const reason =
        error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown ADK error';
      return {
        qualification: fallback.qualification,
        trace: {
          source: 'deterministic-fallback',
          framework: 'google-adk',
          agentName: 'rv_request_qualifier',
          model: this.model,
          fallbackReason: reason.slice(0, 240),
          durationMs: performance.now() - startedAt,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async collectEvents(
    request: RepairRequest,
    abortSignal: AbortSignal,
  ): Promise<{
    finalText: string;
    toolCalls: string[];
    tokenCount: number;
    modelVersion?: string;
  }> {
    const toolCalls = new Set<string>();
    let finalText = '';
    let tokenCount = 0;
    let modelVersion: string | undefined;
    const events = this.runner.run({ request, abortSignal });

    for await (const event of abortable(events, abortSignal)) {
      if (event.errorCode || event.errorMessage) {
        throw new Error(
          `${event.errorCode ?? 'ADK_ERROR'}: ${event.errorMessage ?? 'unknown error'}`,
        );
      }
      for (const call of getFunctionCalls(event)) {
        if (call.name) toolCalls.add(call.name);
      }
      tokenCount += event.usageMetadata?.totalTokenCount ?? 0;
      modelVersion = event.modelVersion ?? modelVersion;
      if (isFinalResponse(event)) finalText = stringifyContent(event);
    }

    if (!finalText) throw new Error('ADK returned no final qualification response');
    if (!toolCalls.has('calculate_safety_baseline')) {
      throw new Error('ADK did not call the required safety baseline tool');
    }
    return {
      finalText,
      toolCalls: [...toolCalls],
      tokenCount,
      ...(modelVersion ? { modelVersion } : {}),
    };
  }

  private enforceSafetyInvariants(
    request: RepairRequest,
    modelQualification: Qualification,
  ): Qualification {
    const baseline = qualifyRequest(request);
    const safetyFlags = [...new Set([...modelQualification.safetyFlags, ...baseline.safetyFlags])];
    const physicalHazard = safetyFlags.some(isPhysicalHazardFlag);
    return {
      ...modelQualification,
      // The model may raise urgency but never lower it below the deterministic baseline.
      urgency: physicalHazard
        ? 'emergency'
        : maxUrgency(modelQualification.urgency, baseline.urgency),
      safetyFlags,
      // Bounded uplift: untrusted customer text cannot talk the model past the
      // low-confidence escalation gate.
      confidence: Math.min(modelQualification.confidence, baseline.confidence + 0.25),
    };
  }
}

async function* abortable<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]();
  try {
    while (true) {
      const result = await nextWithAbort(iterator, signal);
      if (result.done) return;
      yield result.value;
    }
  } finally {
    await iterator.return?.();
  }
}

async function nextWithAbort<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal,
): Promise<IteratorResult<T>> {
  if (signal.aborted) throw new DOMException('ADK qualification timed out', 'TimeoutError');
  return new Promise<IteratorResult<T>>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('ADK qualification timed out', 'TimeoutError'));
    signal.addEventListener('abort', onAbort, { once: true });
    iterator.next().then(
      (result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
