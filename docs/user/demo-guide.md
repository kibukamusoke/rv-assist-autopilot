# Demo and explanation guide

## The short explanation

“RV Assist Autopilot takes ownership of an RV repair request. It understands urgency, ranks eligible technicians, handles declines and response deadlines in the background, requires both technician acceptance and customer confirmation, and produces an auditable timeline.”

## Drive it yourself

With the service running, open:

```text
http://localhost:8080/console
```

For the deployed private Cloud Run service, start an authenticated tunnel first and use the same path:

```text
gcloud run services proxy rv-assist-autopilot --region us-west4 --port 8080
```

The console offers four synthetic presets and lets you play the technician and the customer:

| Preset                 | What it shows                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| Urgent AC failure      | Proceeds autonomously at high urgency; drive decline, replan, accept, confirm |
| Stuck awning           | Ordinary work with no named trade, routed to a general technician             |
| Suspected propane leak | Stops before any technician is contacted, reason `safety-hazard`              |
| Instruction injection  | Request text tries to steer the agent, reason `suspected-injection`           |

The console can start and advance workflows. The `/demo` evidence view remains strictly read-only and is the surface to show when the point is the audit record rather than the interaction.

## What to show

1. Open `/console` and start the **Urgent AC failure** preset.
2. Show the qualification: HVAC, high urgency, and vulnerable occupant.
3. Show the `adk-gemini` trace: required safety tool, decision summary, evidence, token count, and no fallback.
4. Show the ranked technicians, reasons behind each score, and the synthetic technician delivery ID.
5. Record the first technician declining.
6. Show Autopilot automatically advancing to the second technician.
7. Record the second technician accepting.
8. Confirm as the customer.
9. Open the final timeline and point to the mock external job ID.

## View the evidence dashboard

When the HTTP service is running, open:

```text
http://localhost:8080/demo
```

Enter a workflow ID already created through `POST /v1/requests`. The dashboard displays the outcome, timing, technician attempts, retries, fallback status, ADK/Gemini evidence, synthetic delivery records, and complete workflow timeline. It cannot accept, decline, confirm, retry, or otherwise modify a workflow.

For the deployed private Cloud Run service, an authorized viewer can use the same `/demo?workflowId=<id>` path. Keep the service private; do not weaken authentication for a presentation.

Everything displayed in the dashboard is synthetic demonstration data. It does not prove that a real text message or email was sent.

## Show the safety testing

```bash
npm run eval:adversarial
```

This runs 22 synthetic scenarios built to break the classifier — masked hazards, negation tricks, a Spanish propane leak, instruction injection inside the request text, and a corrupted technician directory — and prints a metrics block. Every gate must pass, including zero unnecessary escalations of ordinary requests.

## What to emphasize

- This is a background workflow, not a chatbot returning a list.
- Firestore preserves workflow state between requests and Cloud Run instances.
- Cloud Tasks wakes the workflow at an exact response deadline.
- Pub/Sub accepts asynchronous workflow events.
- The deployed demonstration is independent of private NicheWave access.
- Outreach evidence is synthetic and auditable; no real technician or customer is messaged.
- Consequential decisions remain deterministic and auditable even when Gemini assists with language understanding.
- If Gemini fails, the trace visibly reports deterministic fallback and the workflow remains safe.

## What not to claim

- Do not say real technicians were contacted.
- Do not say the mock job exists in the production NicheWave platform.
- Do not describe synthetic availability or rankings as current real-world facts.
- Do not imply Gemini alone can confirm a booking.
- Do not present the adversarial suite as a security certification; it is a synthetic scenario benchmark.
