import { createHash } from 'node:crypto';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import type { ScheduledWorkflowMessage, WorkflowScheduler } from './workflow-scheduler.js';

type CreateTaskRequest = protos.google.cloud.tasks.v2.ICreateTaskRequest;

export interface CloudTasksClientLike {
  queuePath(project: string, location: string, queue: string): string;
  createTask(request: CreateTaskRequest): Promise<unknown>;
}

export class CloudTasksWorkflowScheduler implements WorkflowScheduler {
  readonly #client: CloudTasksClientLike;

  constructor(
    private readonly project: string,
    private readonly location: string,
    private readonly queue: string,
    private readonly targetUrl: string,
    client: CloudTasksClientLike = new CloudTasksClient(),
  ) {
    this.#client = client;
  }

  async schedule(message: ScheduledWorkflowMessage): Promise<void> {
    const parent = this.#client.queuePath(this.project, this.location, this.queue);
    const taskId = createHash('sha256').update(message.idempotencyKey).digest('hex');
    await this.#client.createTask({
      parent,
      task: {
        name: `${parent}/tasks/${taskId}`,
        scheduleTime: {
          seconds: Math.floor(new Date(message.dueAt).getTime() / 1000),
        },
        httpRequest: {
          httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
          url: this.targetUrl,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify(message)).toString('base64'),
        },
      },
    });
  }
}
