# Deployment history

This is an operational record, not a substitute for Git history. Add an entry for each deployed application digest or infrastructure change.

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
