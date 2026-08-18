# 0006 — Shared safety-flag taxonomy and ground-truth adversarial evaluation

- Date: 2026-08-18
- Status: Accepted

## Context

Escalation, ADK invariant enforcement, and the offline evaluation each decided independently whether a safety flag was serious, and all three did so by testing `flag.includes('hazard')`. The gas-leak flag is named `possible-gas-leak`, so none of them recognised it.

The consequences compounded. A detected propane leak did not require human review, did not force emergency urgency in the ADK invariant, and did not register in the `unsafeAutonomousActions` metric. The existing propane scenario still passed only because an unrelated low-confidence rule escalated it, which concealed the defect.

The evaluation could not have caught this. It measured unsafe actions by reading the classifier's own output through the same broken predicate the workflow used, making the metric self-referential.

Separate defects reinforced the risk: hazard phrases were matched literally, so "I smell gas" and "the propane line is leaking" produced no flag at all; negation was checked only at a term's first occurrence, so "no smoke detector, but smoke is pouring out" suppressed a real hazard; term matching had no word boundaries, so `ac` matched `jack` and `pet` matched `carpet`; and the workflow engine dispatched whatever the external NicheWave adapter returned without re-checking verification or specialty.

## Decision

1. Define one safety-flag vocabulary with two exported predicates, `isEscalationFlag` and `isPhysicalHazardFlag`. Every consumer classifies flags through them and never by flag spelling.
2. Make `isEscalationFlag` fail-safe: any flag outside a small benign allow-list requires a human, so a flag invented by a model escalates rather than being ignored.
3. Detect hazards by subject/cue proximity with per-occurrence negation and word-boundary matching, rather than by literal phrase lists.
4. Select a service category by most specific matching term rather than first list to match.
5. Treat recognised instruction-steering phrases in customer text as `possible-prompt-injection`: cap confidence and route to a human instead of attempting to sanitise the text.
6. Allow the model to raise urgency but never lower it below the deterministic baseline, and cap its confidence at a bounded uplift over the baseline.
7. Re-check technician verification and specialty inside the workflow engine before outreach, and record rejections.
8. Add an adversarial evaluation suite whose assertions are made against declared ground truth, with benign controls gating false escalation at zero.

## Consequences

- Escalation behaviour is now defined in one place and cannot drift between the workflow, the model boundary, and the metrics.
- Suspected propane, carbon-monoxide, fire, and electrical hazards stop for human review before any technician is contacted.
- More requests reach a human than before. This is intended; false escalation is separately gated at zero against benign controls so the increase stays bounded.
- Spanish gas cues are recognised deterministically. Broader multilingual coverage still depends on the model layer, and unclassifiable text escalates on low confidence.
- The injection heuristic is a phrase list. It raises the cost of a naive attempt and does not claim to be a complete defence; the durable protection remains that consequential actions are deterministic and gated on human or party confirmation.
- The adversarial suite is a synthetic benchmark, not a security certification.
