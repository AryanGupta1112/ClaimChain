# ClaimChain Product and Business Case

## Product thesis

Small businesses rarely experience recovery work as one clean workflow. An unpaid invoice may involve a PDF, a delivery acknowledgement, two partial payments, a reminder draft, and a follow-up date. A damaged shipment or lost certificate has different facts but the same operational shape: assemble evidence, determine requirements, take an action, and prove what happened.

ClaimChain puts those pieces in one accountable workspace.

## Primary users

### Store owner or operator

Owns the workspace, records receipts, uploads evidence, prepares correspondence, schedules follow-ups, and confirms stock movements. The current release assumes one trusted owner-controlled workspace.

### Recovery coordinator

Reviews open obligations and evidence, advances case status, maintains document requirements, and exports packets for human review or external submission.

### Store network operator

Lists inventory lots, checks available quantity, reserves stock for another store, and records dispatch or receipt.

## Core jobs to be done

- “Help me turn an unpaid invoice and its proof into a tracked recovery process.”
- “Help me assemble everything needed to recover a document or resolve a dispute.”
- “Help me move surplus stock to another store without promising the same units twice.”
- “Give me a durable packet and timeline that explain what we know and what we did.”

## Implemented use case 1: payment recovery

1. Open a payment case with counterparty, invoice, principal amount, due date, and summary.
2. Upload a PDF, image, or text record. ClaimChain validates the declared type and stores a SHA-256 digest.
3. Optionally extract image text through Textract and/or mirror the original to private S3.
4. Prepare a deterministic reminder or request a Bedrock-assisted draft.
5. Review and edit the draft. Optimistic revision checks prevent stale overwrites.
6. Record partial or full receipts using an idempotency key and unique payment reference.
7. Let the server reconcile the remaining balance and case status.
8. Export a PDF packet containing facts, payment ledger, evidence manifest, extracted text, checklist, timeline, and prepared drafts.

**Outcome:** a reconciled balance and an inspectable recovery record, not merely an overdue alert.

## Implemented use case 2: document recovery

1. Open a document case, such as a trade certificate replacement.
2. ClaimChain creates four recovery requirements: identity/business proof, supporting records, request review, and resolution confirmation.
3. Attach source records, prepare a factual request, and schedule follow-ups.
4. Complete each requirement as evidence becomes available.
5. Resolve the case only after all requirements are complete.
6. Reopen the case before reversing a completed requirement.

**Outcome:** a gated, auditable recovery checklist and packet.

## Implemented use case 3: supplier or evidence dispute

Disputes use the same evidence/checklist machinery as document recovery. A damaged shipment case can collect delivery records, photos, and a statement, then produce a reviewable packet without pretending the system submitted a legal claim.

## Implemented use case 4: store stock handoff

1. Add stores and unexpired inventory lots.
2. Select a source lot and destination store.
3. Reserve a quantity. Reserved units are immediately removed from availability.
4. Dispatch or cancel the reservation.
5. Confirm receipt after dispatch.
6. On receipt, decrement the source lot and increment or create the matching destination lot exactly once.

**Outcome:** an implemented inventory movement with oversell protection, not a recommendation to move stock.

## Supporting capabilities

- Search, filter, sort, and status views.
- Follow-up scheduling, completion, and reopening.
- Append-only activity events for actual state changes.
- Workspace profile editing and complete JSON export.
- Responsive desktop/mobile navigation with keyboard focus management.
- Django-owned individual accounts with revocable HTTP-only sessions, three server-enforced roles, assigned operator scopes, verification, and password recovery.
- Fictional sample workspace for demonstrations or an empty workspace for real setup.

## Value proposition

| Fragmented method               | ClaimChain behavior                                                  |
| ------------------------------- | -------------------------------------------------------------------- |
| Files in unrelated folders      | Evidence attached to a case with digest and provider metadata        |
| Amount tracked manually         | Integer-paise ledger computes the remaining balance                  |
| Reminder copied into a document | Editable, revision-protected draft with PDF download                 |
| Follow-up remembered informally | Dated task with completion/reopen history                            |
| Checklist in a notebook         | Requirements gate case resolution                                    |
| Stock promised over chat        | Reservation changes available quantity immediately                   |
| “AI said so”                    | Provider is named, output is a draft, and rules remain deterministic |

## Scope boundaries

ClaimChain intentionally does **not** claim to:

- send email, SMS, WhatsApp, or legal notices;
- verify a payment against a bank;
- dispatch a courier or track physical delivery;
- file with a court or government portal;
- authenticate evidence or prove a document is genuine;
- provide legal advice or jurisdiction-validated pleadings;
- provide tenant isolation for unrelated organizations;
- run background reminders when the server is offline.

The user confirms external events and records them. The application preserves the operational record and enforces its internal invariants.

## Product success measures

For the current release, success is behavioral:

- a payment case reaches zero outstanding without overpayment or duplicate receipt;
- a document/dispute case resolves only after requirements are complete;
- a stock transfer reaches receipt without overselling or double credit;
- an evidence file can be downloaded byte-for-byte and represented in a packet;
- a user can complete these workflows on desktop or mobile without page overflow.

Future field metrics could include recovery cycle time, recovered value, follow-up completion rate, stock aging avoided, and packet preparation time. Those analytics are not implemented today.
