# ADR 0001: Agent reasoning and deterministic execution boundary

Status: Accepted — 2026-08-17

Gemini through Google ADK owns interpretation and planning. Application code owns eligibility, state transitions, idempotency, and actions that create external commitments. This makes the agent useful without allowing model output alone to claim availability or confirm a booking.

Gemini structured qualification may enrich the deterministic baseline, but it cannot remove deterministically detected hazards. All consequential callbacks carry idempotency keys, including the final external job call.
