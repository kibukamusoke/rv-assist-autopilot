import type { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { qualificationSchema, type Qualification, type RepairRequest } from '../domain/request.js';
import { qualifyRequest } from '../tools/qualify-request.js';
import type { QualificationResult, RequestQualifier } from './request-qualifier.js';

export interface StructuredGenerator {
  generate(input: {
    model: string;
    prompt: string;
    jsonSchema: unknown;
    abortSignal: AbortSignal;
  }): Promise<string>;
}

export class GoogleGenAiStructuredGenerator implements StructuredGenerator {
  constructor(private readonly client: GoogleGenAI) {}

  async generate(input: {
    model: string;
    prompt: string;
    jsonSchema: unknown;
    abortSignal: AbortSignal;
  }): Promise<string> {
    const response = await this.client.models.generateContent({
      model: input.model,
      contents: input.prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: input.jsonSchema,
        temperature: 0.1,
        abortSignal: input.abortSignal,
      },
    });
    if (!response.text) throw new Error('Gemini returned no qualification text');
    return response.text;
  }
}

export class GeminiRequestQualifier implements RequestQualifier {
  constructor(
    private readonly generator: StructuredGenerator,
    private readonly model: string,
    private readonly fallback: RequestQualifier,
    private readonly timeoutMs = 8_000,
  ) {}

  async qualify(request: RepairRequest): Promise<QualificationResult> {
    const startedAt = performance.now();
    try {
      const text = await this.generator.generate({
        model: this.model,
        prompt: this.prompt(request),
        jsonSchema: z.toJSONSchema(qualificationSchema),
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });
      const modelQualification = qualificationSchema.parse(JSON.parse(text));
      return {
        qualification: this.enforceSafetyInvariants(request, modelQualification),
        trace: { source: 'gemini', model: this.model, durationMs: performance.now() - startedAt },
      };
    } catch (error) {
      const fallback = await this.fallback.qualify(request);
      const reason =
        error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown Gemini error';
      return {
        qualification: fallback.qualification,
        trace: {
          source: 'deterministic-fallback',
          model: this.model,
          fallbackReason: reason.slice(0, 240),
          durationMs: performance.now() - startedAt,
        },
      };
    }
  }

  private enforceSafetyInvariants(
    request: RepairRequest,
    modelQualification: Qualification,
  ): Qualification {
    const baseline = qualifyRequest(request);
    const safetyFlags = [...new Set([...modelQualification.safetyFlags, ...baseline.safetyFlags])];
    const hasHazard = safetyFlags.some((flag) => flag.includes('hazard'));
    return {
      ...modelQualification,
      urgency: hasHazard ? 'emergency' : modelQualification.urgency,
      safetyFlags,
    };
  }

  private prompt(request: RepairRequest): string {
    return `Classify this RV repair request for operational routing.
Return only the requested structured object. Base confidence on the clarity of the customer's words.
Use emergency only for immediate safety hazards such as smoke, sparks, gas/propane smell, or fire.
Do not invent symptoms, availability, or technician facts.

Repair request:
${JSON.stringify(request)}`;
  }
}
