# 0007 — Autonomy is the default; escalation must be attributable

- Date: 2026-08-18
- Status: Accepted
- Relates to: [0006](0006-safety-flag-taxonomy-and-adversarial-evaluation.md)

## Context

Escalation had become the implicit safe default. Any request that matched no category keyword was classified `general`, `general` carried 0.55 confidence, and the escalation gate tripped below 0.6. Because `general` was the fallback for "nothing matched", the classifier's ignorance and the product's caution were the same code path.

Measured against a corpus of 40 ordinary RV repair requests, **55% escalated to a human**. Awnings, slide-outs, stabilizer jacks, entry steps, generators, solar controllers, levelling systems and flooring all fell through. Meanwhile the synthetic roster carries a `general` specialty on two technicians, so the route existed and was never reachable.

This is a direct failure of the product thesis. A Taskmaster-track agent that hands back more than half of routine work is weak on precisely the axis it exists to demonstrate, and the credential-free deterministic mode — the one a judge runs locally and the one used as fallback when Gemini is unavailable — was the worst affected.

Two process failures allowed it to persist:

1. Decision 0006 tightened term matching to word boundaries. This was correct, but it removed accidental matches (`ac` inside `jack`, `retract`, `crack`) that had been masking the gap. Seven requests moved from a confidently wrong HVAC dispatch to an escalation. Neither outcome was the product working, and the change was reported without measuring either.
2. When benign-control scenarios failed during 0006, their expectations were edited to match observed behaviour and one was moved out of the control class entirely. A `falseEscalationPercent: 0` was then reported from a denominator that had been altered after seeing the result — structurally the same self-referential error 0006 was written to condemn.

## Decision

1. Adopt `docs/technical/autonomy-and-escalation-policy.md` as the authoritative statement of what must stay autonomous, what must escalate, and what may go either way. Evaluation expectations derive from it, never from observed behaviour.
2. Treat `general` as a routable trade. Add an RV component and systems lexicon so awnings, slides, jacks, steps, doors, windows, flooring, levelling, cameras, tanks and similar classify as actionable general mobile work.
3. Score interior-area words (`kitchen`, `bathroom`, `bedroom`) below every named component, so "bathroom sink drain" routes to plumbing rather than to a generalist on the strength of the room.
4. Recalibrate confidence to express classification certainty: 0.9 specialty, 0.75 general component, 0.3 no signal. The escalation threshold of 0.5 now means "named no RV system, component or trade at all".
5. Replace the boolean `requiresHuman` with a named reason: `safety-hazard`, `suspected-injection`, `unrecognised-safety-flag`, `no-actionable-signal`, `qualification-unavailable`, alongside the existing marketplace reasons. A classification failure can no longer be reported as a safety stop.
6. Gate the autonomous completion rate in CI via `npm run eval:autonomy`, decomposing failures into classification versus marketplace causes.

## Consequences

- Autonomous completion against the policy corpus moved from 43.9% to 100%; escalation on the 40-request ordinary corpus moved from 55% to 0%.
- Required safety stops remain at 100%, and every adversarial gate from 0006 still passes — this time with the three previously-edited expectations restored to what the policy demands.
- Autonomy and safety are now measured as an opposed pair. Raising one while lowering the other is a regression and must be justified against the policy in writing.
- The lexicon is finite and English-language. Unrecognised vocabulary degrades to `no-actionable-signal` and escalates, which is the safe direction, and the ADK/Gemini layer covers far more language than the deterministic baseline. Expanding the lexicon is ordinary maintenance.
- Process rule adopted: when a control fails, change the system or change the policy deliberately and in writing. Never relabel the control to match the code.
