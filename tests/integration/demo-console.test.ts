import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { MockNicheWaveAdapter } from '../../src/adapters/nichewave/mock-nichewave-adapter.js';
import { InMemoryWorkflowScheduler } from '../../src/adapters/scheduling/in-memory-workflow-scheduler.js';
import { InMemoryWorkflowStore } from '../../src/adapters/state/in-memory-workflow-store.js';
import { createApp } from '../../src/api/app.js';
import { demoScenarios } from '../../src/api/demo-console.js';
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

async function startConsole(): Promise<string> {
  const engine = new WorkflowEngine(
    new InMemoryWorkflowStore(),
    new MockNicheWaveAdapter(),
    new InMemoryWorkflowScheduler(),
  );
  const server = createApp(engine).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** Follows the 303 redirect the console issues after every mutation. */
async function post(base: string, path: string, body: Record<string, string>): Promise<string> {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual',
  });
  expect(response.status).toBe(303);
  return response.headers.get('location') ?? '';
}

const workflowIdFrom = (location: string) =>
  decodeURIComponent(new URL(location, 'http://x').searchParams.get('workflowId') ?? '');

describe('demo console', () => {
  it('offers every preset scenario on the landing page', async () => {
    const base = await startConsole();
    const html = await (await fetch(`${base}/console`)).text();
    for (const scenario of demoScenarios) expect(html).toContain(scenario.label);
    expect(html).toContain('synthetic');
  });

  it('drives a request through decline, replan, acceptance, and confirmation', async () => {
    const base = await startConsole();
    const location = await post(base, '/console/scenarios', { scenario: 'urgent-ac' });
    const workflowId = workflowIdFrom(location);
    expect(workflowId).not.toBe('');

    let html = await (await fetch(`${base}${location}`)).text();
    expect(html).toContain('Awaiting Response');
    expect(html).toContain('Technician declines');

    await post(base, '/console/actions', { workflowId, action: 'technician-decline' });
    await post(base, '/console/actions', { workflowId, action: 'technician-accept' });
    html = await (
      await fetch(`${base}/console?workflowId=${encodeURIComponent(workflowId)}`)
    ).text();
    expect(html).toContain('Customer Confirmation');

    await post(base, '/console/actions', { workflowId, action: 'customer-confirm' });
    html = await (
      await fetch(`${base}/console?workflowId=${encodeURIComponent(workflowId)}`)
    ).text();
    expect(html).toContain('Completed');
    expect(html).toContain(`mock-job-${workflowId}`);
    expect(html).not.toContain('Technician accepts');
  });

  it('stops a hazard scenario before outreach and offers no actions', async () => {
    const base = await startConsole();
    const location = await post(base, '/console/scenarios', { scenario: 'gas-leak' });
    const html = await (await fetch(`${base}${location}`)).text();

    expect(html).toContain('Human Escalation');
    expect(html).toContain('safety-hazard');
    expect(html).toContain('None contacted');
    expect(html).not.toContain('Technician accepts');
    // A safety stop is a correct outcome but not a success; it must not be
    // coloured like one.
    expect(html).toContain('class="status stopped"');
  });

  it('routes an instruction-injection attempt to a person', async () => {
    const base = await startConsole();
    const location = await post(base, '/console/scenarios', { scenario: 'injection' });
    const html = await (await fetch(`${base}${location}`)).text();
    expect(html).toContain('Human Escalation');
    expect(html).toContain('suspected-injection');
  });

  it('ignores an unknown scenario and a stale action without erroring', async () => {
    const base = await startConsole();
    expect(await post(base, '/console/scenarios', { scenario: 'not-a-scenario' })).toBe('/console');
    const location = await post(base, '/console/scenarios', { scenario: 'gas-leak' });
    const workflowId = workflowIdFrom(location);
    // The workflow already escalated, so this button press is stale.
    await post(base, '/console/actions', { workflowId, action: 'technician-accept' });
    const html = await (
      await fetch(`${base}/console?workflowId=${encodeURIComponent(workflowId)}`)
    ).text();
    expect(html).toContain('Human Escalation');
  });

  it('keeps the evidence dashboard free of mutation controls', async () => {
    const base = await startConsole();
    const location = await post(base, '/console/scenarios', { scenario: 'urgent-ac' });
    const workflowId = workflowIdFrom(location);
    const html = await (
      await fetch(`${base}/demo?workflowId=${encodeURIComponent(workflowId)}`)
    ).text();

    expect(html).toContain('This view is read-only');
    expect(html).not.toContain('/console/actions');
    expect(html).not.toContain('Technician accepts');
  });
});
