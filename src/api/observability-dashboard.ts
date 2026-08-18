import type { WorkflowState } from '../workflows/state.js';
import { calculateWorkflowMetrics } from './workflow-timeline.js';

const escapeHtml = (value: string | number | boolean | null | undefined): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatDuration = (milliseconds: number | null): string => {
  if (milliseconds === null) return 'Not recorded';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
};

const title = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

const styles = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #07111f; color: #e8f0ff; }
  * { box-sizing: border-box; }
  body { margin: 0; background: radial-gradient(circle at top right, #17345a 0, #07111f 42%); min-height: 100vh; }
  main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 72px; }
  a { color: #80d8ff; }
  .eyebrow { color: #6ee7b7; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  h1 { margin: 8px 0; font-size: clamp(30px, 5vw, 54px); line-height: 1.02; }
  h2 { margin: 0 0 16px; font-size: 18px; }
  p { color: #a9b9d0; line-height: 1.6; }
  .panel, .card { border: 1px solid #29415f; background: rgba(10, 24, 43, .88); border-radius: 16px; }
  .panel { padding: 24px; margin-top: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 12px; margin-top: 24px; }
  .card { padding: 16px; }
  .card span { display: block; color: #8da3bf; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  .card strong { display: block; margin-top: 8px; font-size: 22px; }
  .status { color: #6ee7b7; }
  .trace { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
  .trace dl { margin: 0; }
  dt { color: #8da3bf; font-size: 12px; text-transform: uppercase; margin-top: 12px; }
  dd { margin: 4px 0 0; overflow-wrap: anywhere; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { position: relative; margin-left: 13px; padding: 0 0 22px 28px; border-left: 2px solid #29415f; }
  li:last-child { border-left-color: transparent; padding-bottom: 0; }
  li::before { content: ''; position: absolute; left: -7px; top: 3px; width: 12px; height: 12px; border-radius: 50%; background: #6ee7b7; box-shadow: 0 0 0 4px #12324d; }
  .step { display: flex; gap: 12px; justify-content: space-between; flex-wrap: wrap; }
  time, code { color: #8da3bf; font-size: 12px; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; color: #a9b9d0; margin: 8px 0 0; font-size: 12px; }
  form { display: flex; gap: 10px; flex-wrap: wrap; }
  input { flex: 1; min-width: 240px; background: #07111f; color: #fff; border: 1px solid #3a5578; border-radius: 10px; padding: 12px; }
  button { border: 0; border-radius: 10px; background: #6ee7b7; color: #06201a; padding: 12px 18px; font-weight: 800; cursor: pointer; }
  .disclosure { border-left: 3px solid #fbbf24; padding-left: 14px; }
`;

const page = (content: string, pageTitle: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(pageTitle)}</title><style>${styles}</style></head><body><main>${content}</main></body></html>`;

export function renderDashboardLanding(workflowId = ''): string {
  return page(
    `<div class="eyebrow">RV Assist Autopilot</div><h1>Workflow evidence</h1>
     <p>Inspect a persisted synthetic workflow without changing it.</p>
     <section class="panel"><form method="get" action="/demo">
       <label for="workflowId">Workflow ID</label>
       <input id="workflowId" name="workflowId" value="${escapeHtml(workflowId)}" required autocomplete="off">
       <button type="submit">Open evidence</button>
     </form></section>
     <p class="disclosure">This hackathon repository uses synthetic technician, customer, outreach, and job data. NicheWave/RV Assist is a pre-existing external platform and is not included here.</p>`,
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
    `<a href="/demo">← Another workflow</a><div class="eyebrow">Judge-facing evidence · synthetic data</div>
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
