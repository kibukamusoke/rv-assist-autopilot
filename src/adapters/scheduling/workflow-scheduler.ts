import type { WorkflowMessage } from '../events/event-publisher.js';

export type ScheduledWorkflowMessage = Extract<
  WorkflowMessage,
  { type: 'TECHNICIAN_RESPONSE_DUE' }
>;

export interface WorkflowScheduler {
  schedule(message: ScheduledWorkflowMessage): Promise<void>;
}
