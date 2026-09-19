# ClaimChain Documentation

This is the definitive guide to the current ClaimChain release. It is written for store operators, judges, project stakeholders, and engineers. Each document distinguishes working functionality in this repository from recommendations for a future production rollout.

## Start here

ClaimChain is an action-oriented recovery workspace for small stores. It brings payment recovery, evidence, documents, follow-ups, and stock handoffs into one accountable operating record. It does not merely observe problems: authorised users can create cases, record payments, prepare correspondence, complete recovery requirements, reserve stock, and confirm transfers.

New readers should begin with the [Executive overview](01-EXECUTIVE-OVERVIEW.md), then read the [Product and business case](02-PRODUCT-AND-BUSINESS-CASE.md). Technical readers can continue through the architecture, security, and deployment guides in order.

## Documentation map

| Document | Primary audience | What it answers |
| --- | --- | --- |
| [Executive overview](01-EXECUTIVE-OVERVIEW.md) | Everyone | Why ClaimChain exists, what it delivers, and its current maturity. |
| [Product and business case](02-PRODUCT-AND-BUSINESS-CASE.md) | Store leaders, product teams, judges | Who uses it, which business problems it solves, value, scope, and limitations. |
| [Solution architecture](03-SOLUTION-ARCHITECTURE.md) | Engineers, reviewers | How the browser, Django identity service, Express workspace API, storage, and optional AWS services work together. |
| [Domain model and operational workflows](04-DOMAIN-MODEL-AND-OPERATIONAL-WORKFLOWS.md) | Operators, engineers, QA | The meaning of cases, evidence, payments, stock, state changes, and business safeguards. |
| [API and integration reference](05-API-AND-INTEGRATION-REFERENCE.md) | Engineers | The current HTTP contract, authorisation requirements, payloads, errors, and integration behaviour. |
| [AWS deployment architecture](06-AWS-DEPLOYMENT-ARCHITECTURE.md) | Cloud engineers, judges | The selected AWS services, EC2 deployment design, IAM, backups, monitoring, and operational rollout. |
| [Security, privacy, and reliability](07-SECURITY-PRIVACY-AND-RELIABILITY.md) | Security reviewers, engineers | Trust boundaries, controls, data handling, resilience, and the production security gate. |
| [Developer and operations guide](08-DEVELOPER-AND-OPERATIONS-GUIDE.md) | Contributors, operators | Local setup, configuration, data locations, routine operation, troubleshooting, and releases. |
| [Quality assurance and testing](09-QUALITY-ASSURANCE-AND-TESTING.md) | QA, reviewers | What is tested, how quality is assessed, and what remains to be proven before a live rollout. |
| [Demo guide and product roadmap](10-DEMO-GUIDE-AND-PRODUCT-ROADMAP.md) | Presenters, judges, stakeholders | A concise demo narrative, competition talking points, and responsible product evolution. |
| [Identity, access, and simulation](11-IDENTITY-ACCESS-AND-SIMULATION.md) | Administrators, engineers | Django authentication, the three roles, account lifecycle, audit records, pagination, and fictional ingestion. |
| [Django identity and RBAC implementation](12-DJANGO-IDENTITY-AND-RBAC-IMPLEMENTATION.md) | Administrators, engineers | The complete Django authentication, session, verification, password recovery, and server-enforced RBAC design. |
| [Glossary](13-GLOSSARY.md) | Everyone | Plain-language definitions for operational, security, and cloud terms used across the project. |

## Current-state labels

The documents use these labels consistently:

- **Implemented:** executable in this repository and covered by local tests where practical.
- **Optional/implemented:** executable code exists, but it activates only when the named external service is configured.
- **Deployment-ready:** configuration or packaging is present, but no live AWS deployment is claimed.
- **Proposed:** a future production evolution; it is not part of the current release.

## One-paragraph overview

ClaimChain is a role-controlled recovery operations workspace for small stores. It turns scattered evidence into durable action: open a payment, document, or dispute case; attach and hash source files; prepare correspondence; reconcile receipts; schedule follow-ups; export a case packet; or reserve and transfer surplus stock between stores. The application is a React/TypeScript client and an Express/Node server backed by transactional SQLite and local evidence files. Optional AWS SDK adapters mirror evidence to private Amazon S3, extract text from images with Amazon Textract, and draft review-required correspondence with Amazon Bedrock. Individual sessions, three server-enforced roles, verification/recovery codes, security audit, pagination, and synthetic ingestion are implemented locally.

## Sources of truth

When documentation and code disagree, use this precedence:

1. Executable behavior in `server/`, `shared/`, and `src/`.
2. Automated tests in `tests/`.
3. This documentation set.
4. Historical plans such as `IMPLEMENTATION_PLAN.md`.

The implementation record and latest test results remain in [`../VERIFICATION.md`](../VERIFICATION.md). The UI system is recorded in [`../DESIGN.md`](../DESIGN.md). The source code remains the final authority when it differs from any document.
