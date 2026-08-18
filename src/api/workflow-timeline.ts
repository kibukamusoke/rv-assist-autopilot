import type { WorkflowState } from '../workflows/state.js';

export interface WorkflowMetrics {
  totalDurationMs: number;
  qualificationDurationMs: number | null;
  technicianContactAttempts: number;
  technicianDeliveryFailures: number;
  technicianDeclines: number;
  technicianTimeouts: number;
  candidateRetries: number;
  customerContactAttempts: number;
  usedDeterministicFallback: boolean;
  completed: boolean;
  humanEscalated: boolean;
}

const labels: Record<string, string> = {
  UNDERSTANDING_REQUEST: 'Understanding repair request',
  SEARCHING_TECHNICIANS: 'Searching eligible technicians',
  CONTACTING_TECHNICIAN: 'Contacting technician',
  TECHNICIAN_CONTACTED: 'Synthetic technician outreach delivered',
  TECHNICIAN_CONTACT_FAILED: 'Technician outreach failed',
  AWAITING_RESPONSE: 'Awaiting technician response',
  TECHNICIAN_DECLINED: 'Technician declined',
  TECHNICIAN_ACCEPTED: 'Technician accepted',
  TECHNICIAN_TIMED_OUT: 'Technician response timed out',
  MATCH_FOUND: 'Verified match found',
  CUSTOMER_CONFIRMATION: 'Awaiting customer confirmation',
  CUSTOMER_CONTACTED: 'Synthetic customer notification delivered',
  CUSTOMER_CONTACT_FAILED: 'Customer notification failed',
  CUSTOMER_CONFIRMATION_RECEIVED: 'Customer responded',
  HUMAN_ESCALATION: 'Escalated to human operator',
  COMPLETED: 'Repair job confirmed',
};

export function presentWorkflowTimeline(state: WorkflowState): Record<string, unknown> {
  const candidate = state.candidates[state.currentCandidateIndex ?? -1];
  return {
    workflowId: state.id,
    status: state.status,
    requestSummary: state.qualification?.summary ?? state.request.description,
    qualification: state.qualification,
    qualificationTrace: state.qualificationTrace,
    metrics: calculateWorkflowMetrics(state),
    activeTechnician: candidate
      ? { id: candidate.id, businessName: candidate.businessName, score: candidate.score }
      : null,
    externalJobId: state.externalJobId ?? null,
    timeline: state.events.map((event, index) => ({
      sequence: index + 1,
      type: event.type,
      label: labels[event.type] ?? event.type,
      occurredAt: event.occurredAt,
      details: event.details,
    })),
  };
}

export function calculateWorkflowMetrics(state: WorkflowState): WorkflowMetrics {
  const count = (type: string): number =>
    state.events.filter((event) => event.type === type).length;
  const successfulTechnicianContacts = count('TECHNICIAN_CONTACTED');
  const failedTechnicianContacts = count('TECHNICIAN_CONTACT_FAILED');
  const technicianContactAttempts = successfulTechnicianContacts + failedTechnicianContacts;
  const terminalEvent = state.events.find(
    (event) => event.type === 'COMPLETED' || event.type === 'HUMAN_ESCALATION',
  );
  const observedEndAt = terminalEvent?.occurredAt ?? state.updatedAt;

  return {
    totalDurationMs: Math.max(0, Date.parse(observedEndAt) - Date.parse(state.createdAt)),
    qualificationDurationMs: state.qualificationTrace?.durationMs ?? null,
    technicianContactAttempts,
    technicianDeliveryFailures: failedTechnicianContacts,
    technicianDeclines: count('TECHNICIAN_DECLINED'),
    technicianTimeouts: count('TECHNICIAN_TIMED_OUT'),
    candidateRetries: Math.max(0, technicianContactAttempts - 1),
    customerContactAttempts: count('CUSTOMER_CONTACTED') + count('CUSTOMER_CONTACT_FAILED'),
    usedDeterministicFallback: state.qualificationTrace?.source === 'deterministic-fallback',
    completed: state.status === 'COMPLETED',
    humanEscalated:
      state.status === 'HUMAN_ESCALATION' ||
      state.events.some((event) => event.type === 'HUMAN_ESCALATION'),
  };
}
