# Testing and evaluations

## Local verification

```bash
npm ci
npm run check
npm run eval
npm run demo:taskmaster
```

`npm run check` runs linting, TypeScript checking, the Vitest suite, and the production build. The evaluation harness covers qualification metrics and workflow recovery scenarios. The Taskmaster demo executes decline, replan, acceptance, customer confirmation, and mock external-job creation.

The ADK qualifier unit suite uses synthetic ADK events. It verifies required tool evidence, schema parsing, deterministic safety-flag preservation, and fallback without spending model tokens.

## Live ADK evaluation

With Google Cloud Application Default Credentials:

```bash
GOOGLE_GENAI_USE_VERTEXAI=true \
GOOGLE_CLOUD_PROJECT=rv-assist-autopilot \
GOOGLE_CLOUD_LOCATION=global \
GEMINI_MODEL=gemini-2.5-flash \
npm run eval:adk:live
```

This is intentionally separate from `npm run check` because it makes billable, nondeterministic external calls. It requires at least 90% category and urgency accuracy, 100% required-tool use, 100% structured responses, and zero fallbacks over ten synthetic scenarios. On 2026-08-17 the deployed model achieved 100% on every percentage metric with zero fallbacks.

## Infrastructure verification

```bash
cd infrastructure/terraform
terraform fmt -check -recursive
terraform validate
terraform plan -detailed-exitcode
```

Exit code `0` from the final detailed plan means deployed infrastructure matches the configuration. Never apply a plan containing an unexpected destroy.

## Live smoke tests

Because Cloud Run is private, obtain an identity token before calling it:

```bash
SERVICE_URL="$(terraform -chdir=infrastructure/terraform output -raw service_url)"
IDENTITY_TOKEN="$(gcloud auth print-identity-token)"

curl -sS -H "Authorization: Bearer ${IDENTITY_TOKEN}" "${SERVICE_URL}/health"
```

A deadline test is complete only when all of the following are verified:

1. A new request returns `202` and persists `AWAITING_RESPONSE`.
2. The Cloud Tasks queue contains one task scheduled at the expected `dueAt` with zero early dispatch attempts.
3. The authenticated `/v1/events/tasks` delivery returns `204`.
4. A stale deadline adds `DUPLICATE_OR_STALE_MESSAGE_IGNORED` and does not reopen the workflow.

Use synthetic request IDs for every live test and record significant deployed verification in `deployment-history.md`.

## Dependency audit note

The 2026-08-17 production image install reported 28 dependency findings (2 low, 18 moderate, 7 high, 1 critical); the full development tree reported 29. These are currently transitive findings in the Google ADK dependency tree. Do not use `npm audit fix --force` without reviewing ADK compatibility. Dependency remediation is tracked as a priority and must be re-audited before submission.
