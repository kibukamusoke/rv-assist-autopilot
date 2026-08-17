# Demo and explanation guide

## The short explanation

“RV Assist Autopilot takes ownership of an RV repair request. It understands urgency, ranks eligible technicians, handles declines and response deadlines in the background, requires both technician acceptance and customer confirmation, and produces an auditable timeline.”

## What to show

1. Submit the synthetic Phoenix air-conditioning request.
2. Show the qualification: HVAC, high urgency, and vulnerable occupant.
3. Show the ranked technicians and the reasons behind each score.
4. Record the first technician declining.
5. Show Autopilot automatically advancing to the second technician.
6. Record the second technician accepting.
7. Confirm as the customer.
8. Open the final timeline and point to the mock external job ID.

## What to emphasize

- This is a background workflow, not a chatbot returning a list.
- Firestore preserves workflow state between requests and Cloud Run instances.
- Cloud Tasks wakes the workflow at an exact response deadline.
- Pub/Sub accepts asynchronous workflow events.
- The deployed demonstration is independent of private NicheWave access.
- Consequential decisions remain deterministic and auditable even when Gemini assists with language understanding.

## What not to claim

- Do not say real technicians were contacted.
- Do not say the mock job exists in the production NicheWave platform.
- Do not describe synthetic availability or rankings as current real-world facts.
- Do not imply Gemini alone can confirm a booking.
