# Testing and evaluations

## Local verification

```bash
npm ci
npm run check
npm run eval
npm run demo:taskmaster
```

`npm run check` runs linting, TypeScript checking, the Vitest suite, and the production build. The evaluation harness covers qualification metrics and workflow recovery scenarios. The Taskmaster demo executes decline, replan, acceptance, customer confirmation, and mock external-job creation.

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
