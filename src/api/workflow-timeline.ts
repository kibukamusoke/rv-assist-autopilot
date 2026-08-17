import type { WorkflowState } from '../workflows/state.js';

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
