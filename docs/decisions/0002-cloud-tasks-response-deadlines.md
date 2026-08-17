# ADR 0002: Cloud Tasks owns response deadlines

Status: Accepted — 2026-08-17

## Context

The first deployment published a future `TECHNICIAN_RESPONSE_DUE` message immediately to Pub/Sub. The handler returned `503` until `dueAt`, relying on Pub/Sub retry timing as a timer. Live verification proved authentication and recovery but produced repeated early requests and imprecise delivery.

## Decision

Use Cloud Tasks to schedule response-deadline messages at an explicit `scheduleTime`. Keep Pub/Sub as the general asynchronous workflow event ingress. Route Cloud Tasks to the private Cloud Run service with queue-level OIDC authentication and a dedicated invoker service account.

Use a SHA-256 hash of the workflow message idempotency key as the Cloud Task ID. A stale deadline is acknowledged with `204`, recorded as `DUPLICATE_OR_STALE_MESSAGE_IGNORED`, and cannot reopen an advanced or completed workflow.

## Consequences

- Deadlines no longer depend on repeated error responses.
- Cloud Tasks and additional IAM grants become infrastructure dependencies.
- Local tests use `InMemoryWorkflowScheduler` and remain credential-free.
- Pub/Sub remains available for asynchronous technician, customer, and integration events.
