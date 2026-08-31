# ADR 0004: Use the latest stable general-purpose Gemini model

- Status: Accepted
- Date: 2026-08-17

## Context

The first live qualification deployment used Gemini 2.5 Flash as a conservative, known-good baseline. Gemini 3.6 Flash was subsequently generally available in the global region and documented as improving token efficiency and multi-step orchestration over Gemini 3.5 Flash. The project owner directed the team to use the latest stable compatible model.

## Decision

Use the latest generally available, general-purpose Gemini Flash model that supports the required Google ADK function-calling and structured-output workflow. As of 2026-08-17, the deployed candidate is `gemini-3.6-flash` on the Vertex AI global endpoint.

Do not select preview aliases merely because they are newer. Do not select Flash-Lite when doing so would trade away reasoning quality for this safety-sensitive qualification step. Every model change must pass the same offline tests and live evaluation before deployment.

Gemini 3.6 Flash does not support custom sampling values, so Autopilot does not set `temperature`, `topP`, or `topK`.

## Consequences

- Model selection follows an explicit, reviewable policy instead of remaining pinned to the original scaffold default.
- The configured model may change as new GA Gemini Flash models become available, but never without evaluation and deployment evidence.
