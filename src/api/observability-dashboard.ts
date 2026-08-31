import type { WorkflowState } from '../workflows/state.js';
import { escapeHtml, formatDuration, page, title } from './html.js';
import { calculateWorkflowMetrics } from './workflow-timeline.js';

export function renderDashboardLanding(workflowId = ''): string {
  return page(
    `<div class="eyebrow">RV Assist Autopilot</div><h1>Workflow evidence</h1>
     <p>Inspect a persisted synthetic workflow without changing it.</p>
     <section class="panel"><form method="get" action="/demo">
       <label for="workflowId">Workflow ID</label>
       <input id="workflowId" name="workflowId" value="${escapeHtml(workflowId)}" required autocomplete="off">
       <button type="submit">Open evidence</button>
     </form></section>
     <p class="disclosure">This demonstration uses synthetic technician, customer, outreach, and job data. NicheWave/RV Assist is a pre-existing external platform and is not included here.</p>`,
    'RV Assist Autopilot — Workflow evidence',
  );
}

export function renderWorkflowDashboard(state: WorkflowState): string {
  const metrics = calculateWorkflowMetrics(state);
  const trace = state.qualificationTrace;
  const candidate = state.candidates[state.currentCandidateIndex ?? -1];
  const events = state.events
    .map(
      (
        event,
        index,
      ) => `<li><div class="step"><strong>${index + 1}. ${escapeHtml(title(event.type))}</strong>
        <time datetime="${escapeHtml(event.occurredAt)}">${escapeHtml(event.occurredAt)}</time></div>
        <pre>${escapeHtml(JSON.stringify(event.details, null, 2))}</pre></li>`,
    )
    .join('');

  return page(
    `<a href="/demo">← Another workflow</a><div class="eyebrow">Workflow evidence · synthetic data</div>
     <h1>${escapeHtml(state.id)}</h1><p>${escapeHtml(state.qualification?.summary ?? state.request.description)}</p>
     <div class="grid">
       <div class="card"><span>Outcome</span><strong class="status">${escapeHtml(state.status)}</strong></div>
       <div class="card"><span>Total duration</span><strong>${formatDuration(metrics.totalDurationMs)}</strong></div>
       <div class="card"><span>Qualification</span><strong>${formatDuration(metrics.qualificationDurationMs)}</strong></div>
       <div class="card"><span>Technician attempts</span><strong>${metrics.technicianContactAttempts}</strong></div>
       <div class="card"><span>Retries</span><strong>${metrics.candidateRetries}</strong></div>
       <div class="card"><span>Fallback used</span><strong>${metrics.usedDeterministicFallback ? 'Yes' : 'No'}</strong></div>
     </div>
     <section class="panel"><h2>Agent decision evidence</h2><div class="trace">
       <dl><dt>Framework</dt><dd>${escapeHtml(trace?.framework ?? 'deterministic')}</dd><dt>Agent</dt><dd>${escapeHtml(trace?.agentName ?? 'request qualifier')}</dd><dt>Model</dt><dd>${escapeHtml(trace?.model ?? 'No model')}</dd></dl>
       <dl><dt>Source</dt><dd>${escapeHtml(trace?.source ?? 'not recorded')}</dd><dt>Tool calls</dt><dd>${escapeHtml(trace?.toolCalls?.join(', ') || 'None')}</dd><dt>Active technician</dt><dd>${escapeHtml(candidate ? `${candidate.businessName} (${candidate.id})` : 'None')}</dd></dl>
       <dl><dt>Decision summary</dt><dd>${escapeHtml(trace?.decisionSummary ?? 'Not recorded')}</dd><dt>External job</dt><dd>${escapeHtml(state.externalJobId ?? 'Not created')}</dd></dl>
     </div></section>
     <section class="panel"><h2>Persisted workflow timeline</h2><ol>${events}</ol></section>
     <p class="disclosure">All people, delivery records, responses, and jobs shown here are synthetic. This view is read-only.</p>`,
    `${state.id} — Workflow evidence`,
  );
}
