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
- Runs independently with synthetic data so judges do not need access to NicheWave.

## What remains simulated

The current deployment uses mock NicheWave and outreach adapters. Technician records, message deliveries, and the final external job ID are synthetic. It does not message real technicians or customers and does not create a job in the pre-existing NicheWave/RV Assist platform.

## Product boundary

NicheWave/RV Assist is the pre-existing marketplace. RV Assist Autopilot is the new hackathon agent and workflow layer. This repository contains only Autopilot work created from 2026-08-17 onward.

## Safety promise

Autopilot can interpret, search, rank, and coordinate. It cannot claim a confirmed repair job until a technician has accepted and the customer has confirmed. Hazardous, ambiguous, or low-confidence situations are sent for human review.

If the AI service is unavailable or returns an invalid answer, the workflow switches to its conservative rule-based qualification instead of losing the request. The timeline makes that fallback visible to an operator.
