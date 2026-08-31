# Dependency risk register

Last reviewed: 2026-08-26

This register records known production dependency findings, their reachable application scope, and the disposition. It is not a claim that vulnerabilities are absent.

## Current audit

`npm audit --omit=dev --audit-level=high` was repeated against an isolated `npm ci --omit=dev --ignore-scripts` installation. It reports 28 transitive findings: 2 low, 18 moderate, 7 high, and 1 critical. The affected paths are pulled in by `@google/adk@1.6.0` rather than imported directly by application code:

| Dependency area                | Reported severity | Application exposure                                                                                                                     | Disposition                                                                                                         |
| ------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `tar` via SQLite build tooling | Critical          | Present in the production dependency tree. The service exposes no archive upload/extraction route and does not use ADK's SQLite service. | Temporarily accepted for the current private deployment; replace through a compatible upstream ADK update.          |
| `adm-zip` via Google ADK       | High              | Present, but this application does not accept ZIP files or invoke ADK artifact extraction.                                               | Temporarily accepted under the same restriction; do not add file or artifact upload routes while unresolved.        |
| OpenTelemetry 2.1 packages     | Moderate          | ADK tracing dependencies may parse telemetry context, but the Cloud Run service is private and request size is bounded by Express.       | Temporarily accepted; upgrade with the compatible ADK/OpenTelemetry release line and keep service authentication.   |
| Legacy `uuid` transitive paths | Moderate          | Application does not call the affected buffer-output forms.                                                                              | Temporarily accepted; remove when upstream Google Cloud exporters/storage clients update their transitive versions. |

## Why an automatic force-fix was rejected

As of the review, npm's proposed full remediation is `npm audit fix --force`, which would replace `@google/adk@1.6.0` with `@google/adk@1.2.0` as a breaking change. That is a framework downgrade, not a safe patch. Blind major-version overrides for archive, SQLite, and telemetry internals would also create an unverified runtime combination.

No forced dependency rewrite was applied. This is an explicit, time-bounded risk acceptance for the private synthetic service, not approval for a public or real-customer production launch.

## Existing controls

- Cloud Run IAM remains the application authentication boundary; `allUsers` is not granted.
- The service accepts JSON workflow input, not archives or arbitrary files.
- Express retains its bounded default JSON body limit.
- The runtime container uses Node 22 slim, installs production dependencies only, and runs as the unprivileged `node` user.
- Synthetic adapters do not contact real people or write real marketplace jobs.
- The deployed image is pinned by immutable digest and Terraform shows zero drift.

## Required follow-up

1. Re-run the production-only audit before every subsequent deployment.
2. Check for a compatible Google ADK release that updates the affected SQLite, archive, telemetry, and Google Cloud dependency lines.
3. Run the complete test/evaluation suite and a live ADK trace after any dependency update.
4. Do not expose the existing service publicly or add archive/file ingestion while these findings remain.
5. Treat removal of all high/critical reachable findings as a gate before any real-customer production launch.
