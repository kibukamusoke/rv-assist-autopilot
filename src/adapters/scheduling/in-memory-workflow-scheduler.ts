import type { ScheduledWorkflowMessage, WorkflowScheduler } from './workflow-scheduler.js';

export class InMemoryWorkflowScheduler implements WorkflowScheduler {
  readonly messages: ScheduledWorkflowMessage[] = [];

  async schedule(message: ScheduledWorkflowMessage): Promise<void> {
    this.messages.push(structuredClone(message));
  }
}
