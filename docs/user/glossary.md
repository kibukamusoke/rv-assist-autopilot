# Plain-language glossary

**Adapter** — A controlled connection between Autopilot and another system. The mock adapter behaves like NicheWave without accessing the real platform.

**Cloud Run** — The hosted service that runs the Autopilot API and scales down when idle.

**Cloud Tasks** — The managed timer and delivery service that wakes Autopilot when a technician response deadline arrives.

**Firestore** — The managed database holding each workflow’s current state and history.

**Gemini** — The language model used for interpretation and planning. Deterministic code still controls safety and consequential state changes.

**Google ADK** — Google’s Agent Development Kit, used to define the agent and its typed tools.

**Human escalation** — A safe stopping point where a person must review the request.

**Idempotency** — Protection that makes repeated delivery of the same message harmless.

**NicheWave / RV Assist** — The pre-existing external marketplace platform. It is not part of this repository.

**Pub/Sub** — The managed event channel for asynchronous workflow messages.

**Synthetic data** — Invented demonstration data that does not represent real customers, technicians, or jobs.

**Workflow state** — The current stage of a repair request, such as waiting for a technician or awaiting customer confirmation.
