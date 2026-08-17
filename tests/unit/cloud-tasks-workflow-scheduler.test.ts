import { describe, expect, it } from 'vitest';
import {
  CloudTasksWorkflowScheduler,
  type CloudTasksClientLike,
} from '../../src/adapters/scheduling/cloud-tasks-workflow-scheduler.js';

describe('CloudTasksWorkflowScheduler', () => {
  it('creates a deterministic authenticated queue task at the response deadline', async () => {
    let request: Parameters<CloudTasksClientLike['createTask']>[0] | undefined;
    const client: CloudTasksClientLike = {
      queuePath: (project, location, queue) =>
        `projects/${project}/locations/${location}/queues/${queue}`,
      createTask: (input) => {
        request = input;
        return Promise.resolve([{}]);
      },
    };
    const scheduler = new CloudTasksWorkflowScheduler(
      'rv-assist-autopilot',
      'us-west4',
      'rv-assist-response-deadlines',
      'https://placeholder.invalid/v1/events/tasks',
      client,
    );
    const message = {
      type: 'TECHNICIAN_RESPONSE_DUE' as const,
      workflowId: 'workflow-1',
      idempotencyKey: 'workflow-1:0:response-due',
      candidateIndex: 0,
      dueAt: '2026-08-17T10:15:00.000Z',
    };

    await scheduler.schedule(message);

    expect(request).toBeDefined();
    if (!request?.task?.httpRequest) throw new Error('Expected an HTTP Cloud Task');
    const task = request.task;
    const httpRequest = task.httpRequest;
    if (!httpRequest) throw new Error('Expected an HTTP Cloud Task');
    expect(request.parent).toBe(
      'projects/rv-assist-autopilot/locations/us-west4/queues/rv-assist-response-deadlines',
    );
    expect(task.scheduleTime?.seconds).toBe(Date.parse(message.dueAt) / 1000);
    expect(httpRequest.url).toBe('https://placeholder.invalid/v1/events/tasks');
    if (typeof httpRequest.body !== 'string') throw new Error('Expected a base64 task body');
    expect(JSON.parse(Buffer.from(httpRequest.body, 'base64').toString('utf8'))).toEqual(message);
    expect(task.name).toMatch(/\/tasks\/[0-9a-f]{64}$/);
  });
});
