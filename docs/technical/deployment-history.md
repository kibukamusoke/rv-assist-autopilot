# Deployment history

This is an operational record, not a substitute for Git history. Add an entry for each deployed application digest or infrastructure change.

## 2026-08-18 — Judge-facing workflow evidence dashboard

- Project: `rv-assist-autopilot`
- Region: Cloud Run and Firestore in `us-west4`; Vertex AI global endpoint.
- Cloud Run URL: `https://rv-assist-autopilot-avakk2nf7a-wn.a.run.app`
- Current image: `app@sha256:3ba0547e48a695ef914d08e22f1b50ed70813a9439bf59bda88fc8596eb94e31` (`linux/amd64`, Google Cloud Build).
- Superseded image: `app@sha256:9bd9854ff84ad2ea67d1743e8331aeee9e401e5b8b033732bcd8cb95c8db9a5f` was briefly deployed, then replaced before the milestone commit after live verification showed that late stale-callback acknowledgements inflated terminal duration.
- Infrastructure: both image promotions were in-place Cloud Run changes with 0 add and 0 destroy; no other infrastructure changed.
- Application: added a dependency-free, server-rendered, read-only `/demo` dashboard and per-workflow metrics for duration, qualification latency, contacts, retries, failures, declines, timeouts, fallback, completion, and escalation. Terminal duration now stops at the first `COMPLETED` or `HUMAN_ESCALATION` event.
- Safety: workflow-controlled content is HTML-escaped; a restrictive Content Security Policy is returned; no mutation controls, prompts, hidden reasoning, or real-contact claims are exposed.
- Verification: 26 tests passed; lint, TypeScript, formatting, production build, and the 10-scenario offline evaluation passed with zero unsafe autonomous actions. Local browser inspection confirmed the rendered desktop layout and synthetic-data disclosure.
- Live evidence: `outreach-live-20260817-001` returned HTTP 200 with the expected Content Security Policy, `COMPLETED`, 79,238 ms terminal duration, 7,055.53 ms qualification time, two technician contacts, one retry, one customer contact, no fallback, `gemini-3.6-flash`, `calculate_safety_baseline`, active technician `tech-phoenix-rv`, three synthetic delivery IDs, and mock job `mock-job-outreach-live-20260817-001`.

## 2026-08-17 — Auditable synthetic outreach

- Project: `rv-assist-autopilot`
- Region: Cloud Run and Firestore in `us-west4`; Vertex AI global endpoint.
- Cloud Run URL: `https://rv-assist-autopilot-avakk2nf7a-wn.a.run.app`
- Image: `app@sha256:681e05473cc192193dc000685d6880322f0e0048ec2229b0e766ffd2365e9f84` (`linux/amd64`, published by Google Cloud Build after the Apple Container registry push stalled without creating a tag).
- Infrastructure: added `OUTREACH_ADAPTER=mock`; Cloud Run updated in place with 0 add, 1 change, 0 destroy.
- Application: introduced a typed outreach boundary and deterministic mock implementation; technician and customer delivery attempts now persist delivery IDs, recipients, channel, status, timestamps, idempotency keys, and technician response deadlines. Delivery failure safely retries the next candidate or escalates.
- Verification: 21 tests passed; TypeScript, lint, formatting, build, and Terraform validation passed; the offline 10-scenario evaluation remained 100% with zero unsafe autonomous actions.
- Live trace: synthetic workflow `outreach-live-20260817-001` used Google ADK with `gemini-3.6-flash`, invoked `calculate_safety_baseline`, delivered outreach to the first technician, replanned after a decline, delivered to the second technician, recorded acceptance, delivered the customer notification, received confirmation, and completed mock job `mock-job-outreach-live-20260817-001`.

## 2026-08-17 — Gemini 3.6 Flash promotion

- Project: `rv-assist-autopilot`
- Region: Cloud Run and Firestore in `us-west4`; Vertex AI global endpoint.
- Image: `app@sha256:694b275a4ee25e7931a51020090dea14a56c636bedc82035049eef1d5d9e0fa6` (Apple Container amd64 build).
- Infrastructure: changed `GEMINI_MODEL` from `gemini-2.5-flash` to the latest GA general-purpose Flash model, `gemini-3.6-flash`; Cloud Run updated in place with 0 add, 1 change, 0 destroy.
- Application: removed custom sampling temperature, which Gemini 3.6 does not support, and made ADK transfer restrictions explicit for the structured-output qualification agent.
- Verification: 19 tests passed; offline 10-scenario eval remained 100% with zero unsafe actions; live 10-scenario Gemini 3.6 ADK eval achieved 100% category accuracy, urgency accuracy, required-tool use, and structured responses with zero fallbacks.
- Live trace: synthetic workflow `gemini36-live-20260817-001` returned `adk-gemini`, requested `gemini-3.6-flash`, invoked `calculate_safety_baseline`, and advanced to `AWAITING_RESPONSE` without fallback.
- Final Terraform plan: no changes.

## 2026-08-17 — Live Google ADK and Gemini qualification

- Project: `rv-assist-autopilot`
- Region: Cloud Run and Firestore in `us-west4`; Vertex AI global endpoint.
- Cloud Run URL: `https://rv-assist-autopilot-avakk2nf7a-wn.a.run.app`
- Image: `app@sha256:dc7c6a03ea01b1f65e0a24b01160bc96582f94d25feae0ffb671a9cb66637208` (Apple Container amd64 build).
- Infrastructure: enabled Vertex AI API, granted the runtime service account `roles/aiplatform.user`, and configured ADK for Vertex AI with `gemini-2.5-flash`; plan and apply were 2 add, 1 in-place change, 0 destroy.
- Application: production HTTP qualification now runs through Google ADK, requires the deterministic safety-baseline tool, schema-validates output, re-applies safety invariants, records safe trace evidence, and falls back deterministically.
- Verification: 19 tests passed; offline 10-scenario eval remained 100% with zero unsafe actions; live 10-scenario ADK eval achieved 100% category accuracy, urgency accuracy, tool use, and structured responses with zero fallbacks.
- Live trace: synthetic workflow `adk-live-20260817-002` returned `adk-gemini`, called `calculate_safety_baseline`, recorded 2,114 tokens and a grounded summary/evidence, and advanced to `AWAITING_RESPONSE`.
- Propagation record: `adk-live-20260817-001` safely used deterministic fallback during the brief IAM propagation window immediately after deployment.
- Audit note: the image install reported 28 production dependency findings; no forced dependency rewrite was applied.

## 2026-08-17 — Cloud Tasks deadline scheduling

- Project: `rv-assist-autopilot`
- Region: `us-west4`
- Cloud Run URL: `https://rv-assist-autopilot-avakk2nf7a-wn.a.run.app`
- Image: `app@sha256:f2b78ee1829c442a4bab72f0cce315099a0b6efcfefd041a818c2b4ce8c8a4f5`
- Infrastructure: added Cloud Tasks API, `rv-assist-response-deadlines` queue, queue-level OIDC routing, runtime enqueuer role, and service-account impersonation grants.
- Application: added `WorkflowScheduler`, exact scheduled delivery, `/v1/events/tasks`, deterministic task IDs, and stale-timeout acknowledgement.
- Verification: 16 tests passed; live request returned `202`; queued deadline showed zero early dispatches; authenticated task returned `204`; legacy stale Pub/Sub retry returned `204`; final Terraform plan reported no changes.
- Synthetic records: `cloud-tasks-phoenix-ac-001` is an incomplete IAM-failure test; `cloud-tasks-phoenix-ac-002` is the successful scheduled-delivery test.

## 2026-08-17 — Initial live workflow

- Image: `app@sha256:59592268b659bb3823382e9e1fe3eb342d9f8ebe0d980881c265fdee39094468`
- Infrastructure: Cloud Run, Firestore adapter, Pub/Sub topic and authenticated push subscription, Artifact Registry, and least-privilege runtime service accounts.
- Verification: live health check returned `200`; synthetic Phoenix workflow completed decline → replan → accept → customer confirmation; mock job `mock-job-sample-phoenix-ac-001` was created.
