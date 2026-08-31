# RV Assist Autopilot: product overview

## What it is

RV Assist Autopilot is an automated operator for urgent RV repair requests. Instead of merely displaying a list of repair technicians, it understands the request, finds qualified candidates, contacts them in order, handles declines or timeouts, asks the customer to confirm the accepted match, and records the completed job.

## What problem it solves

An RV owner may be stranded, dealing with extreme heat, or caring for vulnerable occupants or animals. A traditional marketplace leaves the owner to call several businesses manually. Autopilot coordinates that work and keeps a clear history of every decision.

## What it does today

- Understands and classifies a repair request.
- Detects urgency and safety concerns.
- Finds and ranks synthetic technician records.
- Advances automatically when a technician declines or times out.
- Records synthetic technician and customer outreach with delivery IDs, timestamps, status, and duplicate protection.
- Requires technician acceptance and customer confirmation before creating a job.
- Preserves a readable timeline for explanation and review.
- Uses Google ADK and the latest stable general-purpose Gemini Flash model in the live service while preserving a rule-based safety fallback.
- Runs independently with synthetic data so reviewers do not need access to NicheWave.

Reviewers can drive the whole thing themselves from a demo console: pick one of four synthetic scenarios, then play the technician and the customer while Autopilot qualifies the request, ranks and contacts technicians, replans after a decline, and records the outcome. Separately, they can inspect any saved workflow in a read-only evidence dashboard. It explains what the agent decided, which model and tool were used, how many technicians were tried, whether a fallback occurred, and how the workflow reached its outcome. The dashboard cannot perform workflow actions.

## What remains simulated

The current deployment uses mock NicheWave and outreach adapters. Technician records, message deliveries, and the final external job ID are synthetic. It does not message real technicians or customers and does not create a job in the pre-existing NicheWave/RV Assist platform.

## How safety is tested

Alongside the ordinary benchmark, Autopilot runs an adversarial suite of synthetic scenarios designed to defeat it: dangers described in ways that dodge obvious keywords, denials placed in front of real hazards, hazards written in Spanish, attempts to instruct the assistant through the request text, and a deliberately corrupted technician directory. Every scenario is judged against a stated correct answer rather than against Autopilot's own opinion, so a missed danger counts as a failure instead of disappearing.

The suite also checks the opposite failure: routine requests must keep flowing automatically, because a system that escalates everything is not useful.

## Product boundary

NicheWave/RV Assist is the pre-existing marketplace. RV Assist Autopilot is a separate agent and workflow layer. This repository contains only Autopilot work developed from 2026-08-17 onward.

## Safety promise

Autopilot can interpret, search, rank, and coordinate. It cannot claim a confirmed repair job until a technician has accepted and the customer has confirmed. Suspected hazards, apparent attempts to instruct the assistant, requests that name nothing actionable, and cases where no suitable technician exists are sent for human review.

Handing work to a person is treated as a cost, not as the safe choice. An assistant that escalates a stranded customer has not been careful; it has failed them while looking responsible. Every handoff records a specific reason, and the share of ordinary work completed without a person is measured and gated alongside the safety checks.

If the AI service is unavailable or returns an invalid answer, the workflow switches to its conservative rule-based qualification instead of losing the request. The timeline makes that fallback visible to an operator.
