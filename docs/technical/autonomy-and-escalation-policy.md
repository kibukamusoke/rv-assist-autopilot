# Autonomy and escalation policy

- Status: Authoritative. Evaluation expectations are derived from this document, not from observed behaviour.
- Last updated: 2026-08-18

## Purpose

RV Assist Autopilot exists to carry a repair request to a confirmed job without a person. Handing work back to a human is therefore a **product failure unless it prevents a harm Autopilot cannot safely handle**, or unless the marketplace genuinely has nobody to send.

This document exists because escalation had been treated as the safe default. It is not. An agent that escalates a stranded customer at 2am has not been cautious; it has failed them while appearing responsible. Safety and autonomy are both requirements, and each needs a stated boundary so neither can quietly expand into the other.

## Rule of construction

An escalation must be attributable to a **named reason**. Absence of confidence is not a reason. "No keyword matched" is not a reason.

## A. Must escalate

Autopilot stops for a person when:

1. A suspected physical hazard is present: fire, electrical, gas or propane, or carbon monoxide.
2. The request text appears to contain instructions aimed at the agent.
3. No verified, in-area, correctly-skilled technician is available.
4. Every candidate has declined or timed out.
5. The customer rejects the proposed match.
6. The request carries no actionable signal at all — it names no RV system, component, or symptom.

Reasons 1–2 are safety. Reasons 3–5 are exhaustion of the marketplace. Reason 6 is genuine absence of information.

## B. Must stay autonomous

Autopilot proceeds without a person for ordinary repair work, including requests that do not map to a named specialty trade. RV service is dominated by general mobile work, and the roster carries a `general` specialty precisely so it can be routed.

The following must be handled autonomously when an eligible technician exists:

- Named trade work: HVAC, electrical, plumbing, appliance, roof.
- General mobile work: awnings, slide-outs, stabilizer jacks, entry steps, doors, locks, windows, windshields, screens, ladders and exterior mounts, cabinetry and interior fittings, flooring.
- Systems work without a dedicated trade category: generators, solar controllers, converters, inverters, batteries, cameras, entertainment, levelling systems, holding tanks and valves, water pumps, vents.
- Requests that name a component and a symptom, even in imprecise or non-technical language.
- Requests mentioning pets, children, or elderly occupants. These raise urgency; they are not a reason for human review.

## C. May escalate

Legitimately borderline, and acceptable either way:

- Several unrelated faults where no single trade is primary and no generalist covers the combination.
- A component named with no symptom, or a symptom with no component, where meaning cannot be recovered.

## Consequences for implementation

1. `general` is a routable trade, not a failure state. Classifying a request as `general` must not, by itself, escalate it.
2. Confidence expresses classification certainty and is reported in the trace. It must not be the sole escalation trigger for any request that names a recognisable component and symptom.
3. The escalation test is: hazard flag, injection flag, no actionable signal, or no eligible candidate. Nothing else.
4. When escalation occurs, the recorded reason must distinguish a safety stop from marketplace exhaustion, because they demand different operational responses and are not interchangeable in metrics.

## Measurement

Two rates are tracked, and improving one at the expense of the other is a regression:

- **Autonomous completion rate** — of requests the policy says must stay autonomous, the share that proceed without a person. Measured by `evals/run-autonomy-evals.ts`.
- **False escalation rate** — the inverse, decomposed by cause so that a classification failure is never reported as a marketplace limitation.

Adversarial safety metrics are measured separately in `evals/run-adversarial-evals.ts`. A change that raises safety metrics while lowering the autonomous completion rate must be justified explicitly against section B, not accepted silently.
