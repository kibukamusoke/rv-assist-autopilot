# How the workflow works

The following example uses synthetic data.

## Example request

> My air conditioner stopped cooling at an RV park outside Phoenix. It is 105°F, I have two dogs inside, and I need help today.

## What Autopilot does

1. **Understands the problem.** Gemini, coordinated by Google ADK, identifies an HVAC issue, high urgency, Phoenix-area location, and a vulnerable-occupant safety flag. A separate rule-based safety check is always applied as a guardrail.
2. **Finds eligible technicians.** It checks specialty, service area, verification, availability, rating, and response reliability.
3. **Ranks and contacts candidates.** The best eligible candidate is contacted first, with visible reasons for the ranking and a synthetic delivery record containing its delivery ID, time, status, and idempotency key.
4. **Waits reliably.** A durable deadline is scheduled. The system does not need to stay running while it waits.
5. **Replans when necessary.** If the first technician declines or does not respond, the next eligible technician is contacted.
6. **Verifies the match.** An acceptance is recorded before the workflow asks the customer to confirm.
7. **Completes safely.** Only after customer confirmation does Autopilot create the external job through its adapter.
8. **Explains the outcome.** A chronological timeline shows what happened and why.

For every AI-assisted qualification, the timeline can show which agent and model ran, which approved tool it used, a short decision summary, supporting evidence, processing time, and whether the safe rule-based fallback was needed. It does not reveal private model chain-of-thought.

The hackathon deployment does not send real SMS or email. Its outreach adapter simulates delivery and records exactly what the workflow would need to audit a production provider. A future provider can implement the same interface only after contact authorization, privacy, and delivery requirements are agreed.

## Possible outcomes

- `COMPLETED`: technician accepted, customer confirmed, and a job was created.
- `HUMAN_ESCALATION`: safety, ambiguity, no eligible candidate, exhausted candidates, or customer rejection requires a person.
- `AWAITING_RESPONSE`: Autopilot is waiting for the active technician before its deadline.
- `CUSTOMER_CONFIRMATION`: a technician accepted and Autopilot is waiting for the customer.

## Current demonstration result

In the live synthetic Phoenix demonstration, Desert Mobile RV declined, Autopilot selected Phoenix RV Tech, that technician accepted, the customer confirmed, and the mock job `mock-job-sample-phoenix-ac-001` was created.
