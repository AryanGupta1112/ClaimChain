# Demo, Competition Narrative, and Roadmap

## The concise pitch

**ClaimChain turns scattered proof into completed recovery actions for small stores.** It unifies unpaid invoice recovery, document/dispute evidence, follow-ups, generated packets, and safe store-to-store stock handoffs. AWS enriches the workflow through private evidence mirroring, document text extraction, and review-required drafting, while deterministic code protects money, inventory, and state transitions.

## Why it is more than monitoring

The key competition distinction is execution:

- It does not only flag an unpaid invoice; it records evidence, prepares a letter, reconciles receipts, and closes the case at zero.
- It does not only report excess stock; it reserves units, blocks overselling, moves them through dispatch, and credits the destination on receipt.
- It does not only summarize a lost-document problem; it gates resolution on explicit requirements and exports a recovery packet.
- It does not let an LLM own business truth; it uses AI for a reviewable draft while code owns the ledger.

## Seven-minute demo script

### 0:00-0:40 — The problem and brand

Open the landing page. Explain the hands: proof is usually separated across files and people; ClaimChain connects it into a forward path. Enter the workspace.

### 0:40-2:40 — Payment recovery

Open the Kaveri Cafe case.

1. Show principal, recorded payments, and outstanding balance.
2. Open the fictional invoice/delivery evidence and point to SHA-256/provider metadata.
3. Prepare a reminder using the local template or Bedrock if live AWS is configured.
4. Edit the letter and download the PDF.
5. Record a partial receipt, then the final receipt.
6. Show automatic status resolution and the activity timeline.

Talking point: the model may draft words; it cannot mark money paid.

### 2:40-4:10 — Evidence and AWS

Upload a disposable invoice image.

1. Run Textract and show extracted text/provider.
2. Mirror it to private S3 and show the recorded cloud key/event.
3. Explain that failures leave the local original intact and do not produce a false success.
4. Export the case packet and show ledger, evidence manifest/hash, timeline, and disclaimers.

### 4:10-5:30 — Stock handoff

Open Stock exchange.

1. Reserve part of a lot for another store.
2. Show available quantity drop immediately.
3. Mark dispatched, then received.
4. Show source decrement and destination credit.

Talking point: this is an inventory state transition, not a suggestion card.

### 5:30-6:30 — Document recovery

Open the trade certificate case. Complete requirements and a follow-up, then resolve. Attempting to resolve too early is blocked by the server.

### 6:30-7:00 — Architecture and honesty

Show the architecture diagram. State clearly:

- one tested Node service and transactional SQLite for the current release;
- optional S3/Textract/Bedrock adapters through an EC2 role;
- no claim of automatic sending, bank verification, legal filing, or multi-tenancy;
- a defined migration to RDS/S3-primary/workers for production scale.

## Judge questions and answers

### “Why use AI here?”

Recovery letters are time-consuming and benefit from contextual drafting. ClaimChain constrains AI to language generation, labels the provider, requires review, and keeps all consequential transitions deterministic.

### “What happens without AWS credentials?”

The complete local workflow still works: cases, evidence storage, local text, deterministic drafts, payments, checklists, PDFs, tasks, transfers, and exports. AWS features appear only when configured.

### “How is evidence trustworthy?”

ClaimChain preserves original bytes and records SHA-256, size, MIME type, and provider. That proves byte identity, not authenticity. The product says so explicitly.

### “Can it scale?”

The current release intentionally uses one transactional writer. Public multi-tenant scale requires replacing the repository with RDS, moving evidence to S3 primary storage, and using stateless services and durable workers. The migration is documented rather than hand-waved.

### “What is the strongest technical feature?”

The combination of exact financial reconciliation and stock conservation with idempotency, explicit state machines, evidence integrity, revision conflicts, and end-to-end browser tests. AWS augments this reliable core.

## Competition proof checklist

- [ ] Use only fictional/non-sensitive demo records.
- [ ] Record a successful live S3/Textract/Bedrock smoke test if those services are shown.
- [ ] Keep AWS Console tabs ready to show private S3 object metadata, IAM role, and relevant logs without exposing secrets.
- [ ] Pre-generate a local draft fallback in case model access/latency fails.
- [ ] Preserve a clean sample database snapshot before the demo.
- [ ] Test the exact projector/browser viewport and network.
- [ ] Do not claim proposed services are deployed.

## Roadmap

### Phase 1 — Competition hardening

- Deploy the current container on one EC2 instance with encrypted EBS.
- Verify S3, Textract, and Bedrock in the selected Region/account.
- Add structured request/provider logs and CloudWatch alarms.
- Automate consistent volume snapshots and one restore drill.
- Add CSP/HSTS at the reverse proxy.
- Record a repeatable infrastructure/deployment manifest.

### Phase 2 — Pilot with a small store network

- Add individual users, roles, and actor identity in activity events.
- Add evidence deletion/retention and malware scanning.
- Add CSV import for invoices and stock lots.
- Add outbound email only with verified sender, consent, and delivery receipts.
- Add case comments and assignment.
- Add asynchronous PDF/multipage OCR.
- Run usability and accessibility testing with actual operators.

### Phase 3 — Multi-tenant production architecture

- RDS PostgreSQL with tenant-scoped rows and migrations.
- S3 as primary evidence store using KMS and presigned access.
- ECS/Fargate stateless API and worker services.
- Cognito/enterprise identity, MFA, RBAC, and tenant authorization.
- SQS/EventBridge/Step Functions for OCR, drafting, reminders, and exports.
- CloudFront/WAF, CloudTrail, centralized secrets, SLOs, and incident response.

### Phase 4 — Deeper action integrations

- Accounting/payment provider imports with verified receipts.
- Courier/ERP integrations for confirmed stock movement.
- Government/industry portal connectors only where APIs and authorization permit.
- Policy-controlled AI extraction into structured proposed facts with source citations and human acceptance.
- Network-level surplus matching subject to commercial, safety, tax, and regulated-goods rules.

## Product principles that must survive growth

1. Persist before reporting success.
2. Trace facts to source evidence.
3. Keep money and inventory deterministic.
4. Make external actions distinguishable from internal records.
5. Keep AI output reviewable and attributable.
6. Never turn a proposed architecture into a shipped claim.
