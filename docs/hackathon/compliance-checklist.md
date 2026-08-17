# Hackathon compliance checklist

- Last updated: 2026-08-17
- Use: before scope/model decisions, before every submission-candidate deployment, and immediately before submission

Checkboxes represent the current repository state, not permanent facts. Re-check them when rules, code, deployment, or submission fields change.

## A. Official rules — submission blocker

- [ ] Record the official competition rules URL.
- [ ] Record the official Taskmaster track page and exact judging criteria.
- [ ] Confirm the submission opening and closing timestamps and timezone.
- [ ] Confirm participant, team-size, geography, age, account, and legal eligibility.
- [ ] Confirm the permitted project-development period and treatment of pre-existing work.
- [ ] Confirm whether Gemini 3.5 is mandatory, preferred, or promotional.
- [ ] Record the exact eligible Gemini 3.5 model identifier and lifecycle stage.
- [ ] Confirm required Google products, APIs, or sponsor technologies.
- [ ] Record every mandatory submission field and artifact.

Do not mark the submission ready while any item in this section remains unchecked.

## B. Project boundary and eligibility

- [x] Autopilot has a repository separate from the pre-existing NicheWave/RV Assist platform.
- [x] README clearly discloses pre-existing NicheWave/RV Assist work.
- [x] NicheWave is accessed only through an adapter contract.
- [x] Synthetic data and the mock adapter allow independent judging.
- [x] Git history preserves the initial repository boundary and subsequent Autopilot milestones.
- [x] The sibling NicheWave repository has not been modified as part of this work.
- [ ] Compare every tracked file and commit date with the official permitted-development-period rule.
- [ ] Prepare the exact prior-work disclosure text for the submission form.

## C. Taskmaster track fit

- [x] The product takes ownership of a multi-step task instead of returning only a list or chat answer.
- [x] Workflow state persists independently of an HTTP request or Cloud Run instance.
- [x] The workflow waits asynchronously using scheduled infrastructure.
- [x] It handles decline, timeout, retry, and next-candidate replanning.
- [x] It supports human escalation.
- [x] It requires technician acceptance and customer confirmation before job creation.
- [x] Duplicate/replayed callbacks are idempotent.
- [ ] Add concrete outreach delivery through a typed mock/production adapter rather than recording only a contact state.
- [ ] Capture one complete deployed ADK workflow from intake through mock job completion.
- [ ] Map each behavior to the exact official Taskmaster scoring criterion.

## D. Required technology

- [x] Google ADK runs in the production request path.
- [x] Gemini output affects a real workflow decision.
- [x] Required ADK tool invocation is visible in the persisted trace.
- [x] Cloud Run hosts the private service.
- [x] Vertex AI provides Gemini inference using the runtime service account.
- [x] Firestore provides durable state.
- [x] Pub/Sub accepts asynchronous events.
- [x] Cloud Tasks provides exact response deadlines.
- [ ] Resolve the provisional Gemini 3.5 requirement; current deployment uses Gemini 2.5 Flash.
- [ ] Run the full offline and live eval suites against the confirmed competition model.
- [ ] Deploy the confirmed model by immutable image digest and verify a no-drift Terraform plan.

## E. Safety, reliability, and evidence

- [x] Structured model output is schema-validated.
- [x] Deterministic safety flags cannot be removed by the model.
- [x] Invalid output, skipped tool use, timeout, or provider failure activates deterministic fallback.
- [x] Hidden chain-of-thought is neither requested nor exposed.
- [x] Tests cover qualification, ranking, state transitions, deadlines, recovery, and ADK fallback.
- [x] Current offline evaluation reports zero unsafe autonomous actions.
- [x] Current live ADK evaluation reports 100% required-tool use and zero fallbacks over ten synthetic scenarios.
- [ ] Expand safety and adversarial evaluations beyond ten scenarios.
- [ ] Re-audit and resolve or explicitly accept dependency vulnerabilities before submission.
- [ ] Add judge-visible operational metrics for latency, fallbacks, retries, and successful resolution.

## F. Reproducibility and documentation

- [x] Local default mode requires no cloud credentials.
- [x] Environment template contains no secrets.
- [x] Build, lint, type-check, test, evaluation, and demo commands are documented.
- [x] Apple Container instructions replace Docker-specific assumptions for this machine.
- [x] Technical architecture and editable Mermaid source exist.
- [x] Nondeveloper product, workflow, glossary, and demo documents exist.
- [x] Deployment history records image digests, infrastructure changes, and live verification.
- [ ] Rehearse setup from a clean clone using only documented instructions.
- [ ] Confirm repository visibility and license requirements from the official rules.
- [ ] Verify no credentials, Terraform state, private customer data, or private NicheWave code are tracked.

## G. Judge-ready submission package

- [ ] Freeze the submission architecture and confirmed Gemini model.
- [ ] Prepare a concise problem, impact, and differentiation statement.
- [ ] Record a complete 2–3 minute demonstration, subject to the official video limit.
- [ ] Show the live ADK trace, asynchronous wait/replan, safety gates, and completed mock job.
- [ ] Clearly label all technician, customer, response, and job data as synthetic.
- [ ] Include repository, deployment, documentation, and demo links required by the portal.
- [ ] Add architecture and workflow screenshots if required.
- [ ] Run `npm ci`, `npm run check`, `npm run eval`, and the confirmed-model live eval.
- [ ] Run `terraform validate` and require a zero-change final plan.
- [ ] Confirm the deployed image digest matches the submission commit.
- [ ] Complete a final rules review with the project owner before pressing Submit.

## Final sign-off

- [ ] Official requirements verified and linked.
- [ ] No unresolved eligibility or required-technology gaps.
- [ ] Tests, evaluations, deployment, and demo evidence are current.
- [ ] Prior-work boundary and synthetic-data disclosure are explicit.
- [ ] Submission fields were reviewed against the official portal.
- [ ] Project owner approved final submission.
