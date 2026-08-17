import type { EventPublisher, WorkflowMessage } from './event-publisher.js';

export class InMemoryEventPublisher implements EventPublisher {
  readonly messages: WorkflowMessage[] = [];

  async publish(message: WorkflowMessage): Promise<void> {
    this.messages.push(structuredClone(message));
  }
}
