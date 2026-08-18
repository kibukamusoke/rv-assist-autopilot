import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import { InMemoryWorkflowScheduler } from '../../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowStore } from '../../src/adapters/state/in-memory-workflow-store.js';
import { createApp } from '../../src/api/app.js';
import { repairRequestSchema } from '../../src/domain/request.js';
import { WorkflowEngine } from '../../src/workflows/workflow-engine.js';

const servers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('observability dashboard route', () => {
  it('serves persisted evidence with a restrictive content security policy', async () => {
    const engine = new WorkflowEngine(
      new InMemoryWorkflowStore(),
      new MockNicheWaveAdapter(),
      new InMemoryWorkflowScheduler(),
    );
    await engine.start(repairRequestSchema.parse(request));
    const server = createApp(engine).listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    const response = await fetch(
      `http://127.0.0.1:${port}/demo?workflowId=${encodeURIComponent(request.id)}`,
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(html).toContain(request.id);
    expect(html).toContain('Technician attempts');
    expect(html).toContain('This view is read-only');
  });
});
