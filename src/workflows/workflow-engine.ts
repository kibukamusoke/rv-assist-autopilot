import { randomUUID } from 'node:crypto';
import type { WorkflowMessage } from '../adapters/events/event-publisher.js';
import type { NicheWaveAdapter } from '../adapters/nichewave/nichewave-adapter.js';
import type { WorkflowScheduler } from '../adapters/scheduling/workflow-scheduler.js';
import type { WorkflowStore } from '../adapters/state/workflow-store.js';
import {
  DeterministicRequestQualifier,
  type RequestQualifier,
} from '../agents/request-qualifier.js';
import type { RepairRequest } from '../domain/request.js';
import { rankTechnicians } from '../tools/rank-technicians.js';
import type { WorkflowState, WorkflowStatus } from './state.js';

export class WorkflowNotDueError extends Error {}
export class InvalidWorkflowActionError extends Error {}

export class WorkflowEngine {
  constructor(
    private readonly store: WorkflowStore,
    private readonly nicheWave: NicheWaveAdapter,
    private readonly scheduler: WorkflowScheduler,
    private readonly now: () => Date = () => new Date(),
    private readonly qualifier: RequestQualifier = new DeterministicRequestQualifier(),
    private readonly responseTimeoutMs = 15 * 60 * 1000,
  ) {}

  async start(request: RepairRequest): Promise<WorkflowState> {
    const existing = await this.store.get(request.id);
    if (existing) return existing;

    const timestamp = this.now().toISOString();
    let state: WorkflowState = {
      id: request.id,
      version: 0,
      status: 'REQUEST_RECEIVED',
      request,
      candidates: [],
      processedMessageKeys: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
    };
    state = this.transition(state, 'UNDERSTANDING_REQUEST');
    const result = await this.qualifier.qualify(request);
    state.qualification = result.qualification;
    state.qualificationTrace = result.trace;

    if (this.requiresHuman(state)) {
      state = this.transition(state, 'HUMAN_ESCALATION', { reason: 'safety-or-low-confidence' });
      await this.store.save(state);
      return state;
    }

    state = this.transition(state, 'SEARCHING_TECHNICIANS');
    const qualification = result.qualification;
    const technicians = await this.nicheWave.searchTechnicians({
      category: qualification.category,
      latitude: request.location.latitude,
      longitude: request.location.longitude,
      requireToday: ['high', 'emergency'].includes(qualification.urgency),
    });
    state.candidates = rankTechnicians(technicians, qualification);

    if (state.candidates.length === 0) {
      state = this.transition(state, 'HUMAN_ESCALATION', { reason: 'no-eligible-technicians' });
      await this.store.save(state);
      return state;
    }

    const resultState = this.beginOutreach(state, 0);
    await this.store.save(resultState);
    await this.scheduleResponseDue(resultState);
    return resultState;
  }

  async get(id: string): Promise<WorkflowState | null> {
    return this.store.get(id);
  }

  async handleMessage(message: WorkflowMessage): Promise<WorkflowState> {
    const current = await this.requireState(message.workflowId);
    if (current.processedMessageKeys.includes(message.idempotencyKey)) return current;

    if (message.type === 'TECHNICIAN_RESPONSE_DUE') {
      if (
        current.status !== 'AWAITING_RESPONSE' ||
        current.currentCandidateIndex !== message.candidateIndex
      ) {
        return this.markProcessed(current, message.idempotencyKey);
      }
      if (this.now().getTime() < new Date(message.dueAt).getTime()) {
        throw new WorkflowNotDueError(
          `Workflow ${message.workflowId} is not due until ${message.dueAt}`,
        );
      }
      return this.handleResponseDue(current, message);
    }
    if (message.type === 'TECHNICIAN_RESPONSE_RECEIVED') {
      return this.handleTechnicianResponse(current, message);
    }
    return this.handleCustomerConfirmation(current, message);
  }

  private async handleResponseDue(
    current: WorkflowState,
    message: Extract<WorkflowMessage, { type: 'TECHNICIAN_RESPONSE_DUE' }>,
  ): Promise<WorkflowState> {
    if (
      current.status !== 'AWAITING_RESPONSE' ||
      current.currentCandidateIndex !== message.candidateIndex
    ) {
      return this.markProcessed(current, message.idempotencyKey);
    }
    let next = this.appendEvent(current, 'TECHNICIAN_TIMED_OUT', {
      technicianId: current.candidates[message.candidateIndex]?.id,
    });
    next = this.moveToNextCandidate(next, message.idempotencyKey);
    await this.store.save(next, current.version);
    if (next.status === 'AWAITING_RESPONSE') await this.scheduleResponseDue(next);
    return next;
  }

  private async handleTechnicianResponse(
    current: WorkflowState,
    message: Extract<WorkflowMessage, { type: 'TECHNICIAN_RESPONSE_RECEIVED' }>,
  ): Promise<WorkflowState> {
    const candidate = current.candidates[current.currentCandidateIndex ?? -1];
    if (current.status !== 'AWAITING_RESPONSE' || candidate?.id !== message.technicianId) {
      throw new InvalidWorkflowActionError(
        'Response does not match the technician currently being contacted',
      );
    }

    let next = this.appendEvent(current, `TECHNICIAN_${message.response.toUpperCase()}`, {
      technicianId: message.technicianId,
      respondedAt: message.respondedAt,
    });
    if (message.response === 'declined') {
      next = this.moveToNextCandidate(next, message.idempotencyKey);
      await this.store.save(next, current.version);
      if (next.status === 'AWAITING_RESPONSE') await this.scheduleResponseDue(next);
      return next;
    }

    next.technicianAcceptedAt = message.respondedAt;
    next = this.transition(next, 'MATCH_FOUND', { technicianId: message.technicianId });
    next = this.transition(next, 'CUSTOMER_CONFIRMATION');
    next = this.withProcessedKey(next, message.idempotencyKey);
    await this.store.save(next, current.version);
    return next;
  }

  private async handleCustomerConfirmation(
    current: WorkflowState,
    message: Extract<WorkflowMessage, { type: 'CUSTOMER_CONFIRMATION_RECEIVED' }>,
  ): Promise<WorkflowState> {
    if (current.status !== 'CUSTOMER_CONFIRMATION' || !current.technicianAcceptedAt) {
      throw new InvalidWorkflowActionError(
        'A verified technician acceptance must precede customer confirmation',
      );
    }
    let next = this.appendEvent(current, 'CUSTOMER_CONFIRMATION_RECEIVED', {
      confirmed: message.confirmed,
      respondedAt: message.respondedAt,
    });
    if (!message.confirmed) {
      next = this.transition(next, 'HUMAN_ESCALATION', { reason: 'customer-declined-match' });
      next = this.withProcessedKey(next, message.idempotencyKey);
      await this.store.save(next, current.version);
      return next;
    }

    const candidate = current.candidates[current.currentCandidateIndex ?? -1];
    if (!candidate) throw new InvalidWorkflowActionError('Accepted technician is missing');
    const job = await this.nicheWave.createConfirmedJob({
      requestId: current.request.id,
      technicianId: candidate.id,
      acceptedAt: current.technicianAcceptedAt,
      idempotencyKey: message.idempotencyKey,
    });
    next.customerConfirmedAt = message.respondedAt;
    next.externalJobId = job.externalJobId;
    next = this.transition(next, 'COMPLETED', { externalJobId: job.externalJobId });
    next = this.withProcessedKey(next, message.idempotencyKey);
    await this.store.save(next, current.version);
    return next;
  }

  private moveToNextCandidate(state: WorkflowState, processedKey: string): WorkflowState {
    const nextIndex = (state.currentCandidateIndex ?? -1) + 1;
    if (nextIndex >= state.candidates.length) {
      return this.withProcessedKey(
        this.transition(state, 'HUMAN_ESCALATION', { reason: 'candidate-pool-exhausted' }),
        processedKey,
      );
    }
    return this.withProcessedKey(this.beginOutreach(state, nextIndex), processedKey);
  }

  private beginOutreach(state: WorkflowState, candidateIndex: number): WorkflowState {
    let next = this.transition(
      { ...state, currentCandidateIndex: candidateIndex },
      'CONTACTING_TECHNICIAN',
      {
        technicianId: state.candidates[candidateIndex]?.id,
        candidateIndex,
      },
    );
    next = this.transition(next, 'AWAITING_RESPONSE');
    return next;
  }

  private async scheduleResponseDue(state: WorkflowState): Promise<void> {
    const candidateIndex = state.currentCandidateIndex;
    if (candidateIndex === undefined) return;
    await this.scheduler.schedule({
      type: 'TECHNICIAN_RESPONSE_DUE',
      workflowId: state.id,
      idempotencyKey: `${state.id}:${candidateIndex}:response-due`,
      candidateIndex,
      dueAt: new Date(this.now().getTime() + this.responseTimeoutMs).toISOString(),
    });
  }

  private requiresHuman(state: WorkflowState): boolean {
    const qualification = state.qualification;
    return (
      !qualification ||
      qualification.confidence < 0.6 ||
      qualification.safetyFlags.some((flag) => flag.includes('hazard'))
    );
  }

  private async requireState(id: string): Promise<WorkflowState> {
    const state = await this.store.get(id);
    if (!state) throw new InvalidWorkflowActionError(`Workflow ${id} was not found`);
    return state;
  }

  private async markProcessed(state: WorkflowState, key: string): Promise<WorkflowState> {
    const next = this.withProcessedKey(
      this.appendEvent(state, 'DUPLICATE_OR_STALE_MESSAGE_IGNORED', { idempotencyKey: key }),
      key,
    );
    await this.store.save(next, state.version);
    return next;
  }

  private withProcessedKey(state: WorkflowState, key: string): WorkflowState {
    return state.processedMessageKeys.includes(key)
      ? state
      : { ...state, processedMessageKeys: [...state.processedMessageKeys, key] };
  }

  private appendEvent(
    state: WorkflowState,
    type: string,
    details: Record<string, unknown> = {},
  ): WorkflowState {
    const occurredAt = this.now().toISOString();
    return {
      ...state,
      version: state.version + 1,
      updatedAt: occurredAt,
      events: [...state.events, { id: randomUUID(), type, occurredAt, details }],
    };
  }

  private transition(
    state: WorkflowState,
    status: WorkflowStatus,
    details: Record<string, unknown> = {},
  ): WorkflowState {
    return { ...this.appendEvent(state, status, details), status };
  }
}
