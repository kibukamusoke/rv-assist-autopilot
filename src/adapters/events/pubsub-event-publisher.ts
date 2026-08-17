import { PubSub } from '@google-cloud/pubsub';
import type { EventPublisher, WorkflowMessage } from './event-publisher.js';

export class PubSubEventPublisher implements EventPublisher {
  readonly #pubsub: PubSub;

  constructor(
    private readonly topicName: string,
    pubsub = new PubSub(),
  ) {
    this.#pubsub = pubsub;
  }

  async publish(message: WorkflowMessage): Promise<void> {
    await this.#pubsub.topic(this.topicName).publishMessage({ json: message });
  }
}
