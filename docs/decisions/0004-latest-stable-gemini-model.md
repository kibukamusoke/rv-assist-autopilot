# ADR 0004: Use the latest stable general-purpose Gemini model

- Status: Accepted
- Date: 2026-08-17

## Context

The first live qualification deployment used Gemini 2.5 Flash as a conservative, known-good baseline. By the submission period, Gemini 3.6 Flash was generally available in the global region and documented as improving token efficiency and multi-step orchestration over Gemini 3.5 Flash.

A public competition announcement mentions Gemini 3.5, but the official competition rules and Taskmaster rubric have not yet been captured. The project owner directed the team to use the latest available model.

## Decision

Use the latest generally available, general-purpose Gemini Flash model that supports the required Google ADK function-calling and structured-output workflow. As of 2026-08-17, the submission candidate is `gemini-3.6-flash` on the Vertex AI global endpoint.

Do not select preview aliases merely because they are newer. Do not select Flash-Lite when doing so would trade away reasoning quality for this safety-sensitive qualification step. Every model change must pass the same offline tests and live evaluation before deployment.

Gemini 3.6 Flash does not support custom sampling values, so Autopilot does not set `temperature`, `topP`, or `topK`.

## Consequences

- Model selection follows an explicit, reviewable policy instead of remaining pinned to the original scaffold default.
- The configured model may change as new GA Gemini Flash models become available, but never without evaluation and deployment evidence.
- Official competition rules override this policy if they mandate a particular model or generation.
- The requirements register and compliance checklist remain the final pre-submission guard against a model-policy conflict.
