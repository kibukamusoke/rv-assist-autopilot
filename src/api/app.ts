import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  InvalidWorkflowActionError,
  WorkflowNotDueError,
  type WorkflowEngine,
} from '../workflows/workflow-engine.js';
import { repairRequestSchema } from '../domain/request.js';
import { z } from 'zod';
import { workflowMessageSchema } from '../adapters/events/event-publisher.js';
import { presentWorkflowTimeline } from './workflow-timeline.js';
import { renderDashboardLanding, renderWorkflowDashboard } from './observability-dashboard.js';
import {
  buildScenarioRequest,
  consoleContentSecurityPolicy,
  findScenario,
  renderConsoleLanding,
  renderConsoleWorkflow,
} from './demo-console.js';

const pubSubEnvelopeSchema = z.object({
  message: z.object({ data: z.string(), messageId: z.string().optional() }),
});

const technicianResponseSchema = z.object({
  technicianId: z.string(),
  response: z.enum(['accepted', 'declined']),
  respondedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().optional(),
});

const consoleScenarioSchema = z.object({ scenario: z.string().max(64) });
const consoleActionSchema = z.object({
  workflowId: z.string().min(1).max(256),
  action: z.string().max(64),
});

const customerConfirmationSchema = z.object({
  confirmed: z.boolean(),
  respondedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().optional(),
});

export function createApp(engine: WorkflowEngine): express.Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  // The demo console posts plain HTML forms; no client-side script is used.
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/demo', async (request, response, next) => {
    try {
      const workflowId =
        typeof request.query.workflowId === 'string' ? request.query.workflowId : '';
      if (!workflowId) return response.type('html').send(renderDashboardLanding());
      const state = await engine.get(workflowId);
      if (!state) return response.status(404).type('html').send(renderDashboardLanding(workflowId));
      return response
        .set(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
        )
        .type('html')
        .send(renderWorkflowDashboard(state));
    } catch (error) {
      next(error);
    }
  });
  app.get('/console', async (request, response, next) => {
    try {
      const workflowId =
        typeof request.query.workflowId === 'string' ? request.query.workflowId : '';
      const html = workflowId ? await renderExistingWorkflow(workflowId) : null;
      if (!workflowId) {
        return response
          .set('Content-Security-Policy', consoleContentSecurityPolicy)
          .type('html')
          .send(renderConsoleLanding());
      }
      if (!html) {
        return response
          .status(404)
          .set('Content-Security-Policy', consoleContentSecurityPolicy)
          .type('html')
          .send(renderConsoleLanding(workflowId, true));
      }
      return response
        .set('Content-Security-Policy', consoleContentSecurityPolicy)
        .type('html')
        .send(html);
    } catch (error) {
      next(error);
    }
  });

  app.post('/console/scenarios', async (request, response, next) => {
    try {
      const form = consoleScenarioSchema.safeParse(request.body);
      const scenario = form.success ? findScenario(form.data.scenario) : undefined;
      if (!scenario) return response.redirect(303, '/console');
      const id = `demo-${scenario.key}-${Date.now().toString(36)}`;
      await engine.start(buildScenarioRequest(scenario, id, new Date()));
      return response.redirect(303, `/console?workflowId=${encodeURIComponent(id)}`);
    } catch (error) {
      next(error);
    }
  });

  app.post('/console/actions', async (request, response, next) => {
    const form = consoleActionSchema.safeParse(request.body);
    if (!form.success) return response.redirect(303, '/console');
    const { workflowId, action } = form.data;
    try {
      const state = await engine.get(workflowId);
      if (!state) return response.redirect(303, '/console');
      const respondedAt = new Date().toISOString();
      const candidateIndex = state.currentCandidateIndex ?? 0;
      const technicianId = state.candidates[candidateIndex]?.id;

      if ((action === 'technician-accept' || action === 'technician-decline') && technicianId) {
        await engine.handleMessage({
          type: 'TECHNICIAN_RESPONSE_RECEIVED',
          workflowId,
          technicianId,
          response: action === 'technician-accept' ? 'accepted' : 'declined',
          respondedAt,
          idempotencyKey: `console:${workflowId}:${candidateIndex}:${action}`,
        });
      } else if (action === 'customer-confirm' || action === 'customer-decline') {
        await engine.handleMessage({
          type: 'CUSTOMER_CONFIRMATION_RECEIVED',
          workflowId,
          confirmed: action === 'customer-confirm',
          respondedAt,
          idempotencyKey: `console:${workflowId}:customer:${action}`,
        });
      }
      return response.redirect(303, `/console?workflowId=${encodeURIComponent(workflowId)}`);
    } catch (error) {
      // A stale button press is a demo nuisance, not a failure: the workflow
      // view the user lands on shows the authoritative state.
      if (error instanceof InvalidWorkflowActionError) {
        return response.redirect(303, `/console?workflowId=${encodeURIComponent(workflowId)}`);
      }
      next(error);
    }
  });

  async function renderExistingWorkflow(workflowId: string): Promise<string | null> {
    const state = await engine.get(workflowId);
    return state ? renderConsoleWorkflow(state) : null;
  }

  app.post('/v1/requests', async (request, response, next) => {
    try {
      const state = await engine.start(repairRequestSchema.parse(request.body));
      response.status(202).json(state);
    } catch (error) {
      next(error);
    }
  });
  app.get('/v1/workflows/:id', async (request, response, next) => {
    try {
      const state = await engine.get(request.params.id);
      if (!state) return response.status(404).json({ error: 'workflow_not_found' });
      return response.json(state);
    } catch (error) {
      next(error);
    }
  });
  app.get('/v1/workflows/:id/timeline', async (request, response, next) => {
    try {
      const state = await engine.get(request.params.id);
      if (!state) return response.status(404).json({ error: 'workflow_not_found' });
      return response.json(presentWorkflowTimeline(state));
    } catch (error) {
      next(error);
    }
  });
  app.post('/v1/workflows/:id/technician-responses', async (request, response, next) => {
    try {
      const input = technicianResponseSchema.parse(request.body);
      const state = await engine.handleMessage({
        type: 'TECHNICIAN_RESPONSE_RECEIVED',
        workflowId: request.params.id,
        technicianId: input.technicianId,
        response: input.response,
        respondedAt: input.respondedAt ?? new Date().toISOString(),
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
      });
      response.json(state);
    } catch (error) {
      next(error);
    }
  });
  app.post('/v1/workflows/:id/customer-confirmation', async (request, response, next) => {
    try {
      const input = customerConfirmationSchema.parse(request.body);
      const state = await engine.handleMessage({
        type: 'CUSTOMER_CONFIRMATION_RECEIVED',
        workflowId: request.params.id,
        confirmed: input.confirmed,
        respondedAt: input.respondedAt ?? new Date().toISOString(),
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
      });
      response.json(state);
    } catch (error) {
      next(error);
    }
  });
  app.post('/v1/events/pubsub', async (request, response, next) => {
    try {
      const envelope = pubSubEnvelopeSchema.parse(request.body);
      const message = workflowMessageSchema.parse(
        JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8')),
      );
      await engine.handleMessage(message);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  app.post('/v1/events/tasks', async (request, response, next) => {
    try {
      await engine.handleMessage(workflowMessageSchema.parse(request.body));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (error instanceof WorkflowNotDueError) {
      return response.status(503).json({ error: 'workflow_not_due', message });
    }
    if (error instanceof InvalidWorkflowActionError) {
      return response.status(409).json({ error: 'invalid_workflow_action', message });
    }
    return response.status(400).json({ error: 'invalid_request', message });
  });
  return app;
}
