# Demo and explanation guide

## The short explanation

“RV Assist Autopilot takes ownership of an RV repair request. It understands urgency, ranks eligible technicians, handles declines and response deadlines in the background, requires both technician acceptance and customer confirmation, and produces an auditable timeline.”

## What to show

1. Submit the synthetic Phoenix air-conditioning request.
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
