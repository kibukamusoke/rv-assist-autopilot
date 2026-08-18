import { randomUUID } from 'node:crypto';
import type { WorkflowMessage } from '../adapters/events/event-publisher.js';
import type { NicheWaveAdapter } from '../adapters/nichewave/nichewave-adapter.js';
import { MockOutreachAdapter } from '../adapters/outreach/mock-outreach-adapter.js';
import type { OutreachAdapter, OutreachDelivery } from '../adapters/outreach/outreach-adapter.js';
import type { WorkflowScheduler } from '../adapters/scheduling/workflow-scheduler.js';
import type { WorkflowStore } from '../adapters/state/workflow-store.js';
import {
  DeterministicRequestQualifier,
  type RequestQualifier,
} from '../agents/request-qualifier.js';
import type { RepairRequest } from '../domain/request.js';
import {
  NO_ACTIONABLE_SIGNAL_CONFIDENCE,
  SAFETY_FLAGS,
  isEscalationFlag,
  isPhysicalHazardFlag,
} from '../tools/qualify-request.js';
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
    private readonly outreach: OutreachAdapter = new MockOutreachAdapter(),
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

    const escalation = this.escalationReason(state);
    if (escalation) {
      state = this.transition(state, 'HUMAN_ESCALATION', { reason: escalation });
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
    // Defence in depth: NicheWave is an external dependency, so its results are
    // re-checked here rather than trusted. A compromised or faulty adapter must
    // not be able to place an unverified or mis-specialised technician into outreach.
    const eligible = technicians.filter(
      (technician) =>
        technician.verified && technician.specialties.includes(qualification.category),
    );
    if (eligible.length !== technicians.length) {
      state = this.appendEvent(state, 'INELIGIBLE_CANDIDATES_REJECTED', {
        rejected: technicians.length - eligible.length,
        returned: technicians.length,
      });
    }
    state.candidates = rankTechnicians(eligible, qualification);

    if (state.candidates.length === 0) {
      state = this.transition(state, 'HUMAN_ESCALATION', { reason: 'no-eligible-technicians' });
      await this.store.save(state);
      return state;
    }

    const resultState = await this.beginOutreach(state, 0);
    await this.store.save(resultState);
    if (resultState.status === 'AWAITING_RESPONSE') await this.scheduleResponseDue(resultState);
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
    next = await this.moveToNextCandidate(next, message.idempotencyKey);
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
      next = await this.moveToNextCandidate(next, message.idempotencyKey);
      await this.store.save(next, current.version);
      if (next.status === 'AWAITING_RESPONSE') await this.scheduleResponseDue(next);
      return next;
    }

    next.technicianAcceptedAt = message.respondedAt;
    next = this.transition(next, 'MATCH_FOUND', { technicianId: message.technicianId });
    try {
      const customerDelivery = await this.outreach.send({
        workflowId: current.id,
        audience: 'customer',
        recipientId: current.request.customerId,
        message: `${candidate.businessName} accepted the repair request. Please confirm this match.`,
        requestedAt: this.now().toISOString(),
        idempotencyKey: `${current.id}:customer-confirmation-outreach`,
      });
      next = this.recordDelivery(
        next,
        customerDelivery.status === 'delivered' ? 'CUSTOMER_CONTACTED' : 'CUSTOMER_CONTACT_FAILED',
        customerDelivery,
      );
      if (customerDelivery.status === 'delivered') {
        next = this.transition(next, 'CUSTOMER_CONFIRMATION');
        next = this.withProcessedKey(next, message.idempotencyKey);
        await this.store.save(next, current.version);
        return next;
      }
    } catch (error) {
      next = this.appendEvent(next, 'CUSTOMER_CONTACT_FAILED', {
        customerId: current.request.customerId,
        reason: error instanceof Error ? error.message.slice(0, 160) : 'unknown outreach error',
      });
    }
    next = this.transition(next, 'HUMAN_ESCALATION', { reason: 'customer-contact-failed' });
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

  private async moveToNextCandidate(
    state: WorkflowState,
    processedKey: string,
  ): Promise<WorkflowState> {
    const nextIndex = (state.currentCandidateIndex ?? -1) + 1;
    if (nextIndex >= state.candidates.length) {
      return this.withProcessedKey(
        this.transition(state, 'HUMAN_ESCALATION', { reason: 'candidate-pool-exhausted' }),
        processedKey,
      );
    }
    return this.withProcessedKey(await this.beginOutreach(state, nextIndex), processedKey);
  }

  private async beginOutreach(
    state: WorkflowState,
    candidateIndex: number,
  ): Promise<WorkflowState> {
    let next = state;
    for (let index = candidateIndex; index < state.candidates.length; index += 1) {
      const candidate = state.candidates[index];
      if (!candidate) continue;
      next = this.transition({ ...next, currentCandidateIndex: index }, 'CONTACTING_TECHNICIAN', {
        technicianId: candidate.id,
        candidateIndex: index,
      });
      const dueAt = new Date(this.now().getTime() + this.responseTimeoutMs).toISOString();
      try {
        const delivery = await this.outreach.send({
          workflowId: state.id,
          audience: 'technician',
          recipientId: candidate.id,
          message: `${state.qualification?.summary ?? state.request.description} Urgency: ${state.qualification?.urgency ?? 'unknown'}.`,
          requestedAt: this.now().toISOString(),
          responseDueAt: dueAt,
          idempotencyKey: `${state.id}:${index}:technician-outreach`,
        });
        next = this.recordDelivery(
          next,
          delivery.status === 'delivered' ? 'TECHNICIAN_CONTACTED' : 'TECHNICIAN_CONTACT_FAILED',
          delivery,
          { responseDueAt: dueAt },
        );
        if (delivery.status === 'delivered') return this.transition(next, 'AWAITING_RESPONSE');
      } catch (error) {
        next = this.appendEvent(next, 'TECHNICIAN_CONTACT_FAILED', {
          technicianId: candidate.id,
          reason: error instanceof Error ? error.message.slice(0, 160) : 'unknown outreach error',
        });
      }
    }
    return this.transition(next, 'HUMAN_ESCALATION', { reason: 'outreach-delivery-failed' });
  }

  private recordDelivery(
    state: WorkflowState,
    eventType: string,
    delivery: OutreachDelivery,
    details: Record<string, unknown> = {},
  ): WorkflowState {
    return this.appendEvent(state, eventType, { ...delivery, ...details });
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

  /**
   * Returns a named reason to involve a person, or null to proceed.
   *
   * Escalation must always be attributable. Absence of confidence is not a
   * reason on its own: a request classified as `general` is routable general
   * mobile work, not a failure. Only a request that named no RV system,
   * component, or trade at all lacks the signal needed to act.
   *
   * See docs/technical/autonomy-and-escalation-policy.md.
   */
  private escalationReason(state: WorkflowState): string | null {
    const qualification = state.qualification;
    if (!qualification) return 'qualification-unavailable';
    if (qualification.safetyFlags.includes(SAFETY_FLAGS.promptInjection)) {
      return 'suspected-injection';
    }
    if (qualification.safetyFlags.some(isPhysicalHazardFlag)) return 'safety-hazard';
    if (qualification.safetyFlags.some(isEscalationFlag)) return 'unrecognised-safety-flag';
    if (qualification.confidence < NO_ACTIONABLE_SIGNAL_CONFIDENCE) return 'no-actionable-signal';
    return null;
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
