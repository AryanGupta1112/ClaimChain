# ClaimChain

A working recovery workspace for small stores: evidence-backed cases, payment reconciliation, editable correspondence, PDF case packets, follow-up tasks, document recovery requirements, and stock transfers with inventory reservation and receipt confirmation.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173 for the branded landing screen, then enter the workspace. The operational dashboard is also available directly at http://127.0.0.1:5173/workspace. The API runs on port 3001. The first startup creates a fictional sample workspace. Changes persist in `data/claimchain.sqlite` and original evidence in `data/evidence/`.

Sample sign-in: `admin` / `ClaimChainDemo!2026`. The sample also includes `operator` and `auditor` accounts with the same demonstration password so all three RBAC views can be tested.

For the production build on one local port:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. Do not run both commands on an occupied API port. `PORT`, `HOST`, and `DATA_DIR` are configurable through `.env`. To start with empty data, set `SEED_SAMPLE=false` and use a new data directory; do not delete a workspace containing useful records.

## What works

- Create payment, document recovery and evidence-assistance cases.
- Attach real PDF/image/text files, download originals, inspect content hashes and plain text.
- Prepare and edit factual draft letters, protect revisions from stale updates, and download PDFs.
- Record partial/full receipts with duplicate protection and automatic balance/status reconciliation.
- Create and complete follow-ups; maintain an append-only operational event history.
- Complete document recovery requirements and resolve/reopen cases.
- Add stores and inventory, reserve stock, dispatch, cancel reservations, and confirm receipt exactly once.
- Search/filter/sort and paginate records; update business details and export workspace JSON.
- Use individual accounts with email verification, password recovery, scoped RBAC, session revocation, and a security audit.
- Run automatic or manually triggered fictional ingestion when no external feed is connected.
- Optionally connect S3, Textract, Bedrock, and SMTP/SES delivery.

## Honest boundaries

Prepared letters are not sent automatically. Payment entries are owner-recorded, not bank-verified. Stock dispatch and receipt are owner-confirmed, not courier integrations. Exported case packets contain a manifest and text, not embedded copies of original binary evidence. Legal drafts are editable factual templates, not jurisdiction-validated legal advice or completed government filings.

Local use needs no cloud credentials. AWS buttons appear only when their server-side settings are configured; live cloud operations still depend on account access. The application is one role-controlled workspace, not a tenant-isolated SaaS service. SQLite data is stored as a versioned atomic workspace snapshot to keep transactions consistent at this scale; scale-out requires a different repository.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use a separate temporary workspace/port. See `VERIFICATION.md` for actual results, screenshots and remaining limits.

The included GitHub Actions workflow runs formatting, build, API and browser checks on pushes and pull requests once the project is placed in a GitHub repository. That hosted workflow has not been executed in this local workspace.

## Project map

- `docs/README.md`: complete current-state documentation index.
- `docs/01-PROJECT_STORY.md`: origin, decisions and delivery story.
- `docs/02-PRODUCT_AND_USE_CASES.md`: users, workflows, value and boundaries.
- `docs/03-SYSTEM_ARCHITECTURE.md`: components, data flows and topology diagrams.
- `docs/04-DOMAIN_MODEL_AND_WORKFLOWS.md`: entities, invariants and state machines.
- `docs/05-API_REFERENCE.md`: current HTTP contract.
- `docs/AWS_DEPLOYMENT.md`: AWS integrations and deployment runbook.
- `docs/06-SECURITY_PRIVACY_RELIABILITY.md`: controls, risks and production gate.
- `docs/07-DEVELOPMENT_AND_OPERATIONS.md`: setup, commands and operations.
- `docs/08-TESTING_AND_QUALITY.md`: coverage and verification limits.
- `docs/09-DEMO_COMPETITION_AND_ROADMAP.md`: judging narrative and evolution plan.
- `docs/10-AUTH_RBAC_AND_SIMULATION.md`: three-role access, auth flows, audit, and synthetic ingestion.
- `IMPLEMENTATION_PLAN.md`: full product, technical, UX, AWS, risk and test plan.
- `PRODUCT.md`: product contract.
- `DESIGN.md`: implemented interface system.
- `shared/types.ts`: shared domain types.
- `server/app.ts`: validated API and domain workflows.
- `server/store.ts`: SQLite transaction boundary and fictional initial records.
- `server/aws.ts`: real optional AWS adapters.
- `src/`: React application and interface styles.
- `tests/`: API and browser workflows.

## Demo

Open Kaveri Cafe's case, inspect the fictional invoice, prepare a reminder, edit it and download it. Record a partial receipt and inspect the balance and timeline. Export the packet. In Stock exchange, reserve rice for a second store, mark it dispatched and confirm receipt. Then finish a document-recovery checklist and resolve that case.
