import { describe, expect, it } from 'vitest';
import request from '../../samples/urgent-ac-request.json' with { type: 'json' };
import {
  renderDashboardLanding,
  renderWorkflowDashboard,
} from '../../src/api/observability-dashboard.js';
import { repairRequestSchema } from '../../src/domain/request.js';

describe('observability dashboard', () => {
  it('renders a read-only synthetic-data landing page', () => {
    const html = renderDashboardLanding();
    expect(html).toContain('Workflow evidence');
    expect(html).toContain('synthetic technician');
    expect(html).not.toContain('<script');
  });

  it('escapes workflow content and presents agent and delivery evidence', () => {
    const html = renderWorkflowDashboard({
      id: 'dashboard-001',
      version: 1,
      status: 'AWAITING_RESPONSE',
      request: repairRequestSchema.parse({
        ...request,
        description: 'The AC failed today <script>alert(1)</script>',
      }),
      qualification: {
        category: 'hvac',
        urgency: 'high',
        summary: 'AC failure with synthetic delivery evidence',
        safetyFlags: [],
        confidence: 0.95,
      },
      qualificationTrace: {
        source: 'adk-gemini',
        framework: 'google-adk',
        agentName: 'rv_request_qualifier',
        model: 'gemini-3.6-flash',
        toolCalls: ['calculate_safety_baseline'],
        durationMs: 1200,
      },
      candidates: [],
      processedMessageKeys: [],
      createdAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:00:02.000Z',
      events: [
        {
          id: '1',
          type: 'TECHNICIAN_CONTACTED',
          occurredAt: '2026-08-17T10:00:02.000Z',
          details: { deliveryId: 'mock-delivery-001', channel: 'synthetic' },
        },
      ],
    });

    expect(html).toContain('gemini-3.6-flash');
    expect(html).toContain('calculate_safety_baseline');
    expect(html).toContain('mock-delivery-001');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
