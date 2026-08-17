# Configuration and interfaces

## Runtime modes

Local development defaults to in-memory state, an in-memory scheduler, deterministic qualification, and the mock NicheWave adapter. The deployed environment uses Firestore, Pub/Sub ingress, Cloud Tasks scheduling, Google ADK/Gemini qualification through Vertex AI, and the mock adapter.

## Environment variables

| Variable                    | Purpose                                   | Deployed value or mode                        |
| --------------------------- | ----------------------------------------- | --------------------------------------------- |
| `STATE_STORE`               | Workflow persistence adapter              | `firestore`                                   |
| `EVENT_BUS`                 | General workflow event ingress mode       | `pubsub`                                      |
| `WORKFLOW_SCHEDULER`        | Deadline scheduler                        | `cloud-tasks`                                 |
| `NICHEWAVE_ADAPTER`         | External platform adapter                 | `mock`                                        |
| `QUALIFIER_MODE`            | Request qualification implementation      | `adk`                                         |
| `GEMINI_MODEL`              | ADK model                                 | `gemini-3.6-flash`                            |
| `GEMINI_TIMEOUT_MS`         | Qualification deadline                    | `15000`                                       |
| `GOOGLE_GENAI_USE_VERTEXAI` | Select Vertex AI backend                  | `true`                                        |
| `GOOGLE_CLOUD_PROJECT`      | Vertex AI project                         | `rv-assist-autopilot`                         |
| `GOOGLE_CLOUD_LOCATION`     | Vertex AI endpoint                        | `global`                                      |
| `PUBSUB_WORKFLOW_TOPIC`     | General workflow topic                    | `rv-assist-workflow-events`                   |
| `CLOUD_TASKS_PROJECT`       | Queue project                             | `rv-assist-autopilot`                         |
| `CLOUD_TASKS_LOCATION`      | Queue region                              | `us-west4`                                    |
| `CLOUD_TASKS_QUEUE`         | Deadline queue                            | `rv-assist-response-deadlines`                |
| `CLOUD_TASKS_TARGET_URL`    | Task URL before queue-level host override | `https://placeholder.invalid/v1/events/tasks` |

Gemini-specific and local variables are documented in `.env.example`.

## HTTP interfaces

| Method and path                                | Responsibility                                 |
| ---------------------------------------------- | ---------------------------------------------- |
| `GET /health`                                  | Liveness smoke test                            |
| `POST /v1/requests`                            | Start or retrieve an idempotent workflow       |
| `GET /v1/workflows/:id`                        | Read persisted workflow state                  |
| `GET /v1/workflows/:id/timeline`               | Read the presentation-friendly timeline        |
| `POST /v1/workflows/:id/technician-responses`  | Record acceptance or decline                   |
| `POST /v1/workflows/:id/customer-confirmation` | Record customer decision                       |
| `POST /v1/events/pubsub`                       | Receive authenticated Pub/Sub envelopes        |
| `POST /v1/events/tasks`                        | Receive authenticated raw Cloud Tasks messages |

Cloud Run remains private. Pub/Sub and Cloud Tasks use the dedicated invoker service account and OIDC authentication.

## Core adapter contracts

- `NicheWaveAdapter`: technician search and confirmed-job creation.
- `WorkflowStore`: durable state retrieval and optimistic-version writes.
- `WorkflowScheduler`: exact future delivery of technician-response deadlines.
- `RequestQualifier`: deterministic, lower-level Gemini SDK, or Google ADK/Gemini request understanding.

The runtime service account has `roles/aiplatform.user`. ADK uses its Cloud Run identity through Application Default Credentials, so production has no Gemini API-key secret. The ADK qualifier must call `calculate_safety_baseline`; a missing call invalidates the run and activates deterministic fallback.

The mock adapter and in-memory implementations must remain available so local tests and judge demos do not require cloud credentials or private platform access.
