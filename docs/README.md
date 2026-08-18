# Documentation hub

This folder is the maintained source of truth for explaining, operating, and changing RV Assist Autopilot.

## Hackathon compliance

Check these documents before selecting models, changing architecture, deploying, or preparing the submission:

- [Requirements register](hackathon/requirements-register.md) — what the competition requires, the source and confidence of each requirement, and repository evidence.
- [Compliance checklist](hackathon/compliance-checklist.md) — the working checklist for development, release, and final submission review.

The official competition rules take precedence over every project document. Any requirement without a captured official source remains marked `VERIFY` and must not be silently assumed.

## Choose your path

### User and stakeholder documents

Written for judges, operators, partners, and other non-developers:

- [Product overview](user/product-overview.md)
- [How the workflow works](user/how-the-workflow-works.md)
- [Demo and explanation guide](user/demo-guide.md)
- [Plain-language glossary](user/glossary.md)

### Technical documents

Written for developers and operators responsible for the system:

- [Technical architecture](technical/architecture.md)
- [Autonomy and escalation policy](technical/autonomy-and-escalation-policy.md)
- [Deployment runbook](technical/deployment-runbook.md)
- [Configuration and interfaces](technical/configuration-and-interfaces.md)
- [Testing and evaluations](technical/testing-and-evaluations.md)
- [Deployment history](technical/deployment-history.md)
- [Architecture decisions](decisions/)

## Documentation maintenance rule

Documentation is part of the definition of done. Every material change must update:

1. The relevant technical document.
2. The relevant user document when behavior visible to a user, operator, judge, or partner changes.
3. `technical/deployment-history.md` when a cloud revision or infrastructure change is deployed.
4. An ADR in `decisions/` when a durable architectural choice or boundary changes.
5. The hackathon requirements register and compliance checklist when competition alignment or submission readiness changes.

Documents describe the current system unless explicitly labeled as a proposal or historical record. Examples must use synthetic data and must not imply that the mock NicheWave adapter is the live external platform.

## Project boundary

NicheWave and its RV Assist marketplace predate the hackathon. This repository and its documentation cover only RV Assist Autopilot work created during the submission period beginning 2026-08-17. NicheWave/RV Assist remains an external dependency behind `NicheWaveAdapter`.
