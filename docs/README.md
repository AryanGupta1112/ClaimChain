# ClaimChain Documentation

This directory is the canonical handbook for the current ClaimChain release. It explains why the product exists, what it does today, how the code is structured, how its invariants are enforced, how the optional AWS integrations work, and how to operate or evolve it without overstating its capabilities.

## Documentation map

| Document                                                       | Audience                            | Purpose                                                                                      |
| -------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| [Project story](01-PROJECT_STORY.md)                           | Judges, contributors, product teams | Origin, product decisions, design evolution, and current-state summary                       |
| [Product and use cases](02-PRODUCT_AND_USE_CASES.md)           | Product, design, users              | Personas, jobs, workflows, value, scope, and honest boundaries                               |
| [System architecture](03-SYSTEM_ARCHITECTURE.md)               | Engineers, reviewers                | Runtime topology, components, request/data flows, persistence, and architectural trade-offs  |
| [Domain model and workflows](04-DOMAIN_MODEL_AND_WORKFLOWS.md) | Engineers, QA                       | Entities, relationships, state machines, invariants, and failure behavior                    |
| [API reference](05-API_REFERENCE.md)                           | Frontend and integration engineers  | Current HTTP routes, payloads, responses, errors, and authentication                         |
| [AWS deployment](AWS_DEPLOYMENT.md)                            | Cloud and DevOps engineers          | S3, Textract, Bedrock, EC2/EBS deployment, IAM, rollout, backup, and production evolution    |
| [Security and reliability](06-SECURITY_PRIVACY_RELIABILITY.md) | Security and engineering            | Trust boundaries, controls, privacy posture, threat model, and operational risks             |
| [Development and operations](07-DEVELOPMENT_AND_OPERATIONS.md) | Contributors, operators             | Setup, environment, commands, data management, troubleshooting, and release procedure        |
| [Testing and quality](08-TESTING_AND_QUALITY.md)               | QA, reviewers, contributors         | Automated coverage, visual/accessibility checks, test isolation, and known verification gaps |
| [Demo and roadmap](09-DEMO_COMPETITION_AND_ROADMAP.md)         | Judges, presenters, stakeholders    | Demo script, competition narrative, architecture talking points, and phased roadmap          |

## Current-state labels

The documents use these labels consistently:

- **Implemented:** executable in this repository and covered by local tests where practical.
- **Optional/implemented:** executable code exists, but it activates only when the named external service is configured.
- **Deployment-ready:** configuration or packaging is present, but no live AWS deployment is claimed.
- **Proposed:** a future production evolution; it is not part of the current release.

## One-paragraph overview

ClaimChain is a single-owner recovery operations workspace for small stores. It turns scattered evidence into durable action: open a payment, document, or dispute case; attach and hash source files; prepare correspondence; reconcile receipts; schedule follow-ups; export a case packet; or reserve and transfer surplus stock between stores. The application is a React/TypeScript client and an Express/Node server backed by transactional SQLite and local evidence files. Optional AWS SDK adapters mirror evidence to private Amazon S3, extract text from images with Amazon Textract, and draft review-required correspondence with Amazon Bedrock. The current release runs locally without cloud credentials and is packaged for a secure single-instance AWS deployment.

## Sources of truth

When documentation and code disagree, use this precedence:

1. Executable behavior in `server/`, `shared/`, and `src/`.
2. Automated tests in `tests/`.
3. This documentation set.
4. Historical plans such as `IMPLEMENTATION_PLAN.md`.

The implementation record and latest test results remain in [`../VERIFICATION.md`](../VERIFICATION.md). The UI system is recorded in [`../DESIGN.md`](../DESIGN.md).
