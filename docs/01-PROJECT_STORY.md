# Project Story

## The starting question

ClaimChain began as an AWS First Commit competition exploration. The early ideation deliberately crossed domains: retail operations, document recovery, payment disputes, inventory redistribution, evidence handling, and AI-assisted workflows. The decisive product constraint was that the project could not merely monitor, classify, or report a problem. It had to perform useful work and leave a durable operational result.

That constraint eliminated a large class of passive dashboards. A risk score is informative; a reconciled payment, generated packet, completed requirement, or received stock transfer changes the state of the real task. ClaimChain was shaped around those state changes.

## The synthesis

The selected direction combined four related needs:

1. Small stores often recover unpaid invoices using evidence scattered across files, messages, and memory.
2. Lost-document and supplier-dispute workflows have the same evidence-to-action structure even when no money is involved.
3. Stores can have surplus stock in one location while another location needs it, but a transfer must reserve inventory and prevent double allocation.
4. Generative AI is useful only as an assistive layer. Deterministic code must continue to own balances, stock quantities, state transitions, and audit history.

The resulting product is an **evidence-to-action recovery workspace**. “Claim” covers the obligation, dispute, or recovery request. “Chain” covers the trace from source evidence through action to outcome.

## From plan to implementation

The implementation was intentionally built as a complete vertical slice:

- A branded public entry introduces the evidence-to-action idea.
- A real operational workspace persists cases, payments, evidence, drafts, tasks, checklists, stores, stock lots, transfers, and activity.
- Domain rules reject overpayment, duplicate payment references, stale document edits, overselling, invalid transfer transitions, premature resolution, disguised files, and cross-origin mutations.
- Original uploads are stored and downloadable; generated letters and case packets are real PDFs.
- AWS capabilities are optional adapters rather than prerequisites for local usefulness.
- Browser tests exercise the same workflows a presenter demonstrates.

The storage design changed during implementation. The operational domain uses one versioned JSON workspace snapshot inside SQLite, while accounts, sessions, one-time requests, and security audit entries use normalized tables. Every workspace mutation runs under `BEGIN IMMEDIATE`, making cross-collection changes atomic without introducing a large repository layer for a hackathon-scale application. This is a conscious single-instance choice, not a claim that the design scales horizontally.

## Interface evolution

The operational interface began as a restrained, light merchant workspace. The final visual direction now uses a continuous exact-black canvas across the public landing page and operational routes. Near-black raised surfaces, pale text, green actions, and restrained amber/blue status colors preserve the dense, work-focused information hierarchy.

The landing page uses halftone hands reaching toward one another as the central metaphor: disconnected proof becomes a connected path forward. The artwork is stretched across the viewport, while the workspace carries the same dark visual world into cases, inventory, settings, dialogs, and mobile navigation.

## What the project proves

ClaimChain is not a concept-only AI interface. The current release demonstrates that:

- evidence can be captured, validated, hashed, persisted, extracted, and exported;
- financial recovery can be reconciled exactly in integer paise;
- inventory can be reserved and transferred without overselling;
- AI-generated text can remain reviewable and subordinate to deterministic rules;
- AWS integrations can enrich an application that remains functional when the cloud features are absent;
- a competition prototype can be honest about what it does not automate.

## Current status

As of 18 September 2026:

- The local application is implemented and runnable.
- The production bundle, Dockerfile, Compose configuration, and AWS runbook exist.
- Thirteen API/domain tests and seven browser workflow tests pass.
- Desktop/mobile overflow checks and the tested WCAG A/AA axe rule set pass.
- S3, Textract, and Bedrock adapters are executable but have not been validated against credentials in this workspace.
- No live AWS environment, external message delivery, bank verification, legal filing, courier integration, or multi-tenant authorization is claimed.

## Guiding principle

> Every important screen should offer a path to change the state of the work, and every consequential action should leave a durable, inspectable result.
