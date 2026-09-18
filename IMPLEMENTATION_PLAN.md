# ClaimChain: End-to-End Implementation Plan

## 1. Product decision

Build an operational recovery workspace with three connected modules:

1. Payment recovery for small stores: create a claim, attach evidence, review facts, prepare correspondence, record payments, follow up, and export a case packet.
2. Stock redistribution: list surplus stock, match the same SKU across stores, reserve a quantity, dispatch it, confirm receipt, and update both inventories exactly once.
3. Document recovery: assemble a case, collect required evidence, complete a recovery checklist, prepare a factual request letter, and export the dossier.

Construction safety is outside this release. A generalized legal filing robot, actual debt collection, automatic government submissions, live courier procurement, and a medicine marketplace are not implied by this build. General retail stock is supported; regulated-product eligibility requires a future domain-specific workflow.

The release must be useful without AI. AWS enriches evidence processing; deterministic business rules own money, inventory, transitions, and audit records.

## 2. Delivery contract

This plan is written before application implementation. Build the application, run meaningful tests, inspect desktop/mobile rendering, fix observed defects, and publish a verification record. No zero-bug claim is possible. Unverified cloud behavior and incomplete production requirements must remain visible in documentation.

### Acceptance outcomes

- Cases survive a full server restart.
- A new payment case can progress from evidence collection to a prepared reminder, partial payment, full payment, and closure.
- Money uses integer paise; zero, negative, excessive, malformed, and duplicate payments cannot corrupt balances.
- Real evidence bytes are saved and downloadable. SHA-256 deduplication works within a case.
- Plain-text evidence can be read locally; cloud extraction is optional and visibly configured.
- Generated correspondence and packets contain persisted case data and are actually downloadable.
- Follow-up tasks can be created and completed, and overdue status is calculated from real dates.
- A stock transfer reserves available units, dispatches, and credits the receiver only once on receipt.
- Cancellation releases a reservation; invalid transitions and insufficient stock are rejected by the server.
- Document recovery checklists persist and prevent premature closure.
- Search, filters, navigation, sorting, empty states, validation and error recovery work.
- A user can export workspace JSON and edit real workspace settings.
- Integration settings never imply that an unconfigured provider is connected.

## 3. User journeys

### Payment recovery

Open workspace -> create payment case -> enter counterparty, invoice, amount, due date -> attach original evidence -> inspect timeline -> generate reminder -> edit and save draft -> download correspondence -> create follow-up -> record partial receipt -> observe reduced balance -> record remaining receipt -> see resolved state -> export complete packet.

Sending is a separate future provider action. A downloaded letter is recorded as prepared, never sent. A payment is owner-recorded, not bank-verified. Both distinctions appear in the record.

### Stock redistribution

Open stock exchange -> add a stock lot -> choose a surplus lot -> select destination store and quantity -> reserve -> dispatch -> confirm receipt -> inspect source and receiving quantities and transfer history. If a reservation is canceled before dispatch, stock becomes available again. Expired stock cannot be reserved.

### Document recovery

Create a lost-document or evidence-assistance case -> enter factual summary -> upload available proof -> mark recovery requirements complete -> generate editable request letter -> schedule follow-up -> export packet -> close only after requirements complete.

## 4. Information architecture

- Overview: active work, outstanding balance, recovered amount, upcoming tasks, priority cases, recent activity.
- Recovery cases: searchable and filterable register, amount, outstanding, due date, status, type.
- Case detail: summary, evidence, timeline, documents, payment ledger or recovery checklist, and next actions.
- Stock exchange: store inventory, available quantities, expiry, creation form, transfer reservation form, lifecycle actions.
- Tasks: due/open/completed filters, linked case, completion action, add follow-up.
- Activity: append-only domain events ordered newest first.
- Settings: business profile, integration configuration status, export.

Desktop uses a compact persistent left navigation and a bounded work area. Mobile navigation collapses; tables scroll in their own regions; case controls stack. Every route has a loading, empty, and error state.

## 5. Frontend quality specification

Operate mode. Light work surface, charcoal navigation details, green primary action, blue information, amber waiting, red overdue. Typography is a locally packaged workhorse sans with tabular numbers. Fixed font sizes; zero letter-spacing; compact headings; no marketing hero.

Use Lucide icons, reusable buttons, semantic fields, real tabs, native selects where appropriate, visible keyboard focus, and concise notifications. Cards are reserved for repeated items and protected forms; page sections are unframed. Border radii at most 8px. No nested cards or decorative gradients.

The signature interaction is the case workspace: evidence and timeline on the left, actionable recovery state on the right; recording a payment immediately updates the balance, ledger, activity and case status together. Stock transfer states similarly connect actions to observable inventory changes.

Evidence previews are actual uploaded media or document previews. The product itself supplies its visual content. Do not substitute decorative stock photos for financial records.

Reduced motion must suppress transitions. Normal transitions are restrained 150-200ms state feedback. Native dialog focus management, Escape dismissal, focus restoration, and scroll behavior are verified where dialogs are used.

## 6. Architecture

```text
React + TypeScript UI
        |
   /api JSON / file endpoints
        |
Express validation and domain service
        |
Node SQLite transactions + disk evidence storage
        |
Optional AWS S3 / Textract / Bedrock adapters
```

Single-process SQLite is appropriate for the local hackathon release and a single-instance deployment with a durable volume. It is not a distributed database. Multiple app replicas require a future PostgreSQL or DynamoDB repository and concurrency validation.

The server serves the production frontend. Vite proxies API requests during development. Docker provides a reproducible Node 24 runtime. Bind local development to loopback. A configured access password enables signed HTTP-only cookie authentication. Internet deployments must use HTTPS and configured authentication.

## 7. Domain model

- Workspace: business name, owner, email, address, currency fixed to INR.
- Case: ID, title, type, counterparty, invoice number, principal in paise, due date, status, summary, created timestamp.
- Evidence: ID, case ID, original name, content type, storage key, size, digest, extracted text, extraction provider.
- Payment: ID, case ID, amount in paise, payment date, reference, idempotency key, timestamp.
- Document: ID, case ID, kind, title, editable body, revision, created/updated timestamps.
- Task: ID, case ID, title, due date, completion timestamp.
- Checklist item: ID, case ID, label, completion state.
- Store: ID, name, locality.
- Stock lot: ID, store ID, SKU, product, category, unit, quantity, reserved, expiry, batch.
- Transfer: ID, source lot, destination store, quantity, state, timestamps.
- Event: ID, entity type/ID, action, factual description, timestamp.

Use server-generated UUIDs. Validate length and finite integer amounts. ISO dates must be real dates. Foreign keys are enabled. Migration versions are tracked. Original evidence is immutable.

## 8. State machines and invariants

### Claims

Open -> In progress when correspondence is prepared or a partial payment is recorded -> Resolved when the total valid payments equals the principal. Zero principal is valid only for non-payment cases. Document recovery resolves only when every required item is complete. Money cannot be posted to non-payment cases.

### Transfers

Reserved -> Dispatched -> Received; Reserved -> Cancelled. Terminal states do not transition. Available quantity = quantity - reserved. Reservation and mutation are one database transaction. Dispatch preserves reservation; receipt decrements source quantity/reserved and increments an exact matching receiving lot. Repeated receipt returns a conflict, not a second credit. Destination cannot equal source store.

### Evidence and documents

Upload -> Stored -> optional extraction -> human review. AI results never rewrite financial case facts automatically. A document is Draft or Prepared, not Delivered. The packet includes its generation time and source evidence manifest. File hashes establish byte identity, not legal authenticity.

## 9. API contract

- GET /api/bootstrap: workspace, cases, tasks, inventory, transfers, activity, provider capability status.
- POST /api/cases; GET /api/cases/:id; PATCH /api/cases/:id.
- POST /api/cases/:id/payments: validated money and idempotency key.
- POST /api/cases/:id/evidence: multipart upload with limit.
- GET /api/evidence/:id/file; POST /api/evidence/:id/extract.
- POST /api/cases/:id/documents: deterministic template or explicitly requested Bedrock draft.
- PATCH /api/documents/:id; GET /api/documents/:id/download.
- GET /api/cases/:id/packet: generated PDF.
- POST /api/tasks; PATCH /api/tasks/:id.
- PATCH /api/checklist/:id.
- POST /api/stock; POST /api/transfers; POST /api/transfers/:id/transition.
- PATCH /api/workspace; GET /api/export.
- GET /api/health; POST /api/login; POST /api/logout.

Errors have a stable message and status. Unknown IDs return 404. Invalid input returns 400. Business conflicts return 409. Oversized uploads return 413. Provider failure preserves local data and returns a recoverable error.

## 10. AWS integration

Use current AWS SDK v3, default credential provider chain, explicit region, server-side credentials only. No cloud operation is reported as live without a successful result.

- S3: optional private evidence object mirror with content hash metadata; no public ACL; original remains locally accessible.
- Textract: optional extraction of supported uploaded image evidence; unsupported local formats receive a clear explanation.
- Bedrock Converse: optional drafting from reviewed case facts and evidence excerpts. Strict instruction separates user data from model instructions; output remains editable and unverified.
- Deployment: Docker image, durable volume and reverse-proxy HTTPS guide for an AWS single-instance host. Cloud provisioning and live testing require an AWS account and are not claimed by local tests.

Production evolution: Cognito identity and tenant-scoped authorization; durable distributed datastore; S3 as primary evidence storage; Step Functions and scheduled tasks; SES delivery receipts and verified senders; centralized metrics, backups and alarm ownership.

References checked during planning:
- https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html
- https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-controlling-access-to-apis.html

## 11. Security and privacy

Validate all request bodies at the boundary. Use parameterized SQL and transactions. Never use client paths as storage paths. Limit evidence types and size; serve evidence as attachments with nosniff. Escape text through React and PDF primitives. No raw HTML from uploaded content or AI output. Keep secrets out of Vite variables and Git. Reject cross-origin mutations. Keep session signing secret server-side; use Secure cookies under HTTPS. Rate-limit authentication attempts. Require strong password and session secret for exposed deployments.

The local workspace is single-owner and sample data is public fictional material. Do not claim multi-tenant isolation. Record operational events but never secrets. Back up the database with a SQLite-aware snapshot and uploads together. No destructive reset control ships in the UI.

## 12. Implementation sequence

1. Plan and product record; define the operating interface and scope.
2. Package scripts, TypeScript, Vite, server scaffold, validation and SQLite persistence.
3. One case creation/persistence integration test, then its full implementation.
4. Payment reconciliation, idempotency, evidence, correspondence, packet export and focused tests.
5. Stock reservation/receipt/cancellation and concurrency-sensitive tests.
6. Document recovery checklist and task workflows.
7. Complete frontend with sample workspace, navigation, responsive layouts, interactions, errors.
8. Optional AWS adapters, settings, authentication, Docker and deployment documentation.
9. Typecheck, production build, integration tests, browser workflow tests, accessibility/overflow checks, screenshot review.
10. Fix actual findings, document verified results and cloud limitations, leave the local app running.

## 13. Verification matrix

| Surface | Required evidence |
| --- | --- |
| Case creation | Valid create, invalid input, reload persistence |
| Payments | Partial/full receipt, overpayment rejection, duplicate replay |
| Evidence | Byte-preserving download, duplicate handling, type/size validation |
| Documents | Real draft, edits persist, nonempty PDF packet |
| Stock | Reserve, oversell rejection, cancel release, dispatch/receive once |
| Recovery | Required checklist gates closure |
| Tasks | Add, complete, reload |
| Auth | Login, bad password, protected API, logout |
| Frontend | Desktop/mobile screenshots, no page overflow, navigation/forms/downloads |
| Build | TypeScript, production bundle, tests |
| AWS | Config detection; live operations only if credentials are supplied |

Browser tests use an isolated test data directory and a separate port. UI sample records must not be contaminated by automated tests.

## 14. Demo narrative

Start with a fictional store's overdue invoice. Open the case, inspect evidence, prepare a reminder, record a partial payment, show the changed balance and timeline, and download a complete packet. Switch to stock exchange, reserve surplus units, dispatch and receive them, then show both inventory balances. Finish on a document recovery case with a completed checklist and exported request.

Do not spend the demo on dashboard metrics alone. The differentiator is completed stateful work.

## 15. Completion record

Filled in after implementation in VERIFICATION.md: commands run, test counts, screenshot paths, actual preview URL, integration status, and known limitations. Implementation deviations must be recorded there, with reasons. Production readiness is a separate assessment from a functioning hackathon release.

## 16. Implemented release

The local release is implemented. See `VERIFICATION.md` for the completed test matrix and the scoped independent review verdict. The primary plan deviation is a transactional, versioned SQLite workspace snapshot instead of normalized domain tables. AWS adapters are executable but no live cloud deployment or provider verification has been performed. Detailed interface conventions are recorded in `DESIGN.md`; setup and demonstration instructions are in `README.md`.
