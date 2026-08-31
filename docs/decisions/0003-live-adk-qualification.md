# ADR 0003: Run live qualification through Google ADK with deterministic safety enforcement

- Status: Accepted
- Date: 2026-08-17

## Context

The repository exposed an ADK root agent for development, but the deployed HTTP workflow used deterministic qualification. A direct Gemini SDK implementation existed as a comparison path, yet it did not demonstrate that the production workflow itself was orchestrated by Google ADK.

The product benefits from visible autonomous tool use, grounded explanations, reliable fallback, and evidence that the agent participates in a real asynchronous workflow rather than a standalone chat demonstration.

## Decision

Production request qualification uses a dedicated Google ADK `LlmAgent` with Gemini 2.5 Flash on Vertex AI. The agent must call `calculate_safety_baseline` and return a schema-constrained qualification, concise decision summary, and evidence list.

Application code independently recomputes deterministic safety flags and merges them into the model result. Missing tool use, invalid output, timeout, or provider failure activates the deterministic qualifier. The trace records operational evidence but never requests or exposes hidden chain-of-thought.

The lower-level Gemini SDK qualifier remains available for comparison, while the credential-free default remains deterministic. Consequential workflow transitions, eligibility, ranking, idempotency, and booking confirmation remain deterministic TypeScript responsibilities.

## Consequences

- Reviewers can observe real ADK orchestration and tool evidence in the deployed workflow.
- Cloud Run uses its service account and Vertex AI IAM instead of an API-key secret.
- Qualification adds model latency and token cost; fallback keeps intake available.
- The trace provides explainability without exposing sensitive reasoning.
- Live model evals are separated from the default test suite because they are billable and nondeterministic.
