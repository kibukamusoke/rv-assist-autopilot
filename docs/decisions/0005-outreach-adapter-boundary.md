# ADR 0005: Isolate outreach behind an auditable adapter

- Status: Accepted
- Date: 2026-08-17

## Context

The workflow previously transitioned to `CONTACTING_TECHNICIAN` without executing a delivery boundary. That demonstrated state progression but did not provide evidence that an outreach action occurred. Connecting a real SMS or email provider during a synthetic demonstration would introduce consent, privacy, cost, credential, and accidental-contact risks.

## Decision

Introduce `OutreachAdapter` as the only boundary for technician and customer messages. Every adapter response contains a delivery ID, audience, recipient ID, channel, status, sent timestamp, and idempotency key.

The demonstration deployment uses `MockOutreachAdapter`. It produces deterministic, idempotent synthetic deliveries and never contacts a real person. Successful technician delivery is required before scheduling a response deadline. Failed technician delivery advances to the next candidate; exhaustion escalates to a human. Failed customer delivery also escalates.

## Consequences

- Reviewers can see action evidence rather than only a contact-state label.
- Local and deployed demos remain safe and independent of external messaging credentials.
- A future provider must implement the same contract and satisfy consent, privacy, security, and delivery-status requirements.
- Synthetic delivery evidence must be clearly labeled and never presented as a real SMS or email.
