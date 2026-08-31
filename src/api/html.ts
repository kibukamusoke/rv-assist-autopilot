/**
 * Shared server-rendered HTML helpers.
 *
 * Both the read-only evidence dashboard and the interactive demo console use
 * these, so the two surfaces stay visually identical without duplicating markup.
 * No client-side framework and no runtime dependencies: pages must render under
 * a restrictive Content Security Policy with scripts disallowed.
 */
export const escapeHtml = (value: string | number | boolean | null | undefined): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const formatDuration = (milliseconds: number | null): string => {
  if (milliseconds === null) return 'Not recorded';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
};

export const title = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

export const styles = `
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
  .status.stopped { color: #fbbf24; }
  .status.active { color: #80d8ff; }
  button.secondary { background: transparent; color: #e8f0ff; border: 1px solid #3a5578; font-weight: 600; }
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
  .scenarios { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .scenario { display: flex; flex-direction: column; gap: 4px; }
  .scenario p { font-size: 13px; margin: 4px 0; }
  .scenario .expectation { color: #6ee7b7; flex: 1; }
  .scenario form { margin-top: 12px; }
  .mono { font-size: 13px; font-weight: 600; color: #a9b9d0; overflow-wrap: anywhere; }
  label { align-self: center; color: #8da3bf; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
`;

export const page = (content: string, pageTitle: string, head = ''): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${head}<title>${escapeHtml(pageTitle)}</title><style>${styles}</style></head><body><main>${content}</main></body></html>`;
