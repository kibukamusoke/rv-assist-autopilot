import type { Qualification, RepairRequest } from '../domain/request.js';
import { qualifyRequest } from '../tools/qualify-request.js';

export interface QualificationTrace {
  source: 'deterministic' | 'gemini' | 'adk-gemini' | 'deterministic-fallback';
  framework?: 'google-adk';
  agentName?: string;
  model?: string;
  modelVersion?: string;
  toolCalls?: string[];
  tokenCount?: number;
  decisionSummary?: string;
  evidence?: string[];
  fallbackReason?: string;
  durationMs: number;
}

export interface QualificationResult {
  qualification: Qualification;
  trace: QualificationTrace;
}

export interface RequestQualifier {
  qualify(request: RepairRequest): Promise<QualificationResult>;
}

export class DeterministicRequestQualifier implements RequestQualifier {
  async qualify(request: RepairRequest): Promise<QualificationResult> {
    const startedAt = performance.now();
    return {
      qualification: qualifyRequest(request),
      trace: { source: 'deterministic', durationMs: performance.now() - startedAt },
    };
  }
}
