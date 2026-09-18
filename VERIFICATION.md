# ClaimChain verification record

Updated: 18 September 2026.

## Delivered

The extensive plan was written before application code in `IMPLEMENTATION_PLAN.md`. The implemented application includes a React/TypeScript frontend, Express API, transactional SQLite persistence, real uploaded evidence storage, PDF correspondence and case packets, payment reconciliation, document recovery checklists, follow-up tasks, stock reservation/dispatch/receipt, workspace settings and export.

Preview: http://127.0.0.1:5173

Production-build preview/API: http://127.0.0.1:3001

The starting workspace contains explicitly fictional records. Browser/API tests use separate temporary databases and do not mutate the preview workspace.

## Automated results

| Check                               | Result                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict check             | Passed via `npm run build`                                                                                                                |
| Vite production build               | Passed                                                                                                                                    |
| API/domain tests                    | 13 passed, 0 failed                                                                                                                       |
| Playwright browser tests            | 7 passed, 0 failed                                                                                                                        |
| Overview axe scan                   | No violations in the tested WCAG A/AA rule set                                                                                            |
| Desktop/mobile page overflow checks | Passed for overview, cases, case detail, inventory, tasks and settings                                                                    |
| Dependency audit                    | `npm audit --omit=dev`: 0 reported vulnerabilities                                                                                        |
| Source formatting                   | `npm run format:check`: passed                                                                                                            |
| Development-server smoke            | API readiness is awaited before Vite starts; port 5173 renders the landing and proxies a healthy API without the previous startup refusal |
| PDF export                          | Real PDF response validated; two sample packet pages rendered and visually inspected                                                      |

The browser suite ran against both installed Chrome during development and the downloaded Playwright Chromium on the final seven-test run. Workspace desktop viewport: 1440 x 1000. Landing viewport: 1280 x 800. Mobile viewport: 390 x 844.

The workspace, recovery, inventory, settings, dialogs, and mobile navigation now share the exact-black application canvas. Near-black surfaces and revised secondary/status colors passed the tested WCAG A/AA contrast rules; horizontal overflow is clipped at the document root so no browser track appears beneath application routes.

## Behaviors covered

1. Calendar boundaries use Asia/Kolkata, including midnight and year rollover.
2. Case data survives a database close and reopen.
3. Partial/full payments reconcile exactly in integer paise.
4. Idempotent payment replay does not create another receipt; changed replay and duplicate references conflict.
5. Overpayment and premature payment-case closure are rejected.
6. Inventory reservation prevents overselling.
7. Cancellation releases stock; dispatch/receipt transitions are checked; receipt credits inventory once.
8. Evidence downloads preserve bytes; duplicate content is detected; disguised and oversized files are rejected.
9. Draft changes persist and stale revisions conflict; PDFs are real downloadable files.
10. Document recovery requirements gate resolution; resolved requirements cannot be changed without reopening.
11. Follow-up completion/reopening persists without duplicate no-op events.
12. Invalid dates, malformed monetary amounts, missing IDs and cross-origin mutations are rejected.
13. Password login, unauthorized access and logout are tested.
14. Empty workspaces can add stores and stock without fictional seed data.
15. Business profile changes appear in correspondence and workspace exports.
16. Browser journeys complete real case creation, evidence upload, draft edits/download, partial/full payment and packet export.
17. Browser journeys complete stock reservation, dispatch and receipt, and verify changed inventory.
18. Mobile navigation traps focus while open, restores focus on Escape, and excludes closed links from keyboard navigation.
19. Unsaved letter edits survive accidental dismissal and require an explicit discard action.

## Visual review

Artifacts under `.impeccable/review/`:

- `desktop.png`: overview at 1440 px.
- `mobile.png`: overview at 390 px.
- `landing-1280x800.png`: settled landing composition at the requested recording size.
- `landing-mobile.png`: responsive landing composition at 390 x 844.
- `case-desktop.png`: evidence and reconciliation workspace.
- `stock-desktop.png`: inventory and available quantities.
- `packet.pdf`, `packet-1.png`, `packet-2.png`: generated sample packet and rendered pages.

The initial browser pass exposed mobile overflow from an absolutely positioned hidden table label, insufficient secondary-text contrast, and controlled-checkbox feedback during saves. These were corrected and regression checks passed. The payment meter uses a transform rather than width animation.

The independent finish review found three additional issues: hidden mobile navigation remained focusable; date boundaries used UTC; unsaved drafts could be silently discarded. All three were patched. A fresh scoped verdict review scored every finding resolved and returned **ship at that scope**. This is not a certification of all possible bugs or of production security.

The first review continuation was interrupted by an agent usage limit; a fresh reviewer completed the bounded verdict pass. No test result was inferred from that interruption.

PDF verification found a system-font substitution problem in the initial render. The export now embeds the packaged Manrope font, and both pages were re-rendered and inspected successfully.

## Implementation decisions

- The local datastore is a versioned SQLite workspace snapshot, committed under `BEGIN IMMEDIATE`, instead of one normalized table per domain type. This keeps the single-owner release's financial and inventory transitions atomic. The domain collections remain typed. A distributed/multi-tenant version requires a different repository and migration strategy.
- No jurisdiction-specific legal claims are generated. Local letters use reviewed case facts and an editable template. Bedrock output, when enabled, remains a draft.
- Original files remain separately downloadable. A PDF packet contains the evidence manifest, hashes and extracted text, not embedded copies of every binary attachment.
- General retail inventory is implemented. Regulated medicine redistribution and construction safety remain outside the agreed release.
- Production infrastructure provisioning was not performed. A Dockerfile, Compose configuration and AWS integration/deployment runbook are included.

## External verification still required

- Live Bedrock model/inference-profile access, regional availability and generation quality.
- Real S3 upload permissions, bucket policy and private-object configuration.
- Live Textract extraction on actual store documents.
- Docker image execution and deployment to an AWS account.
- The supplied GitHub Actions workflow on a hosted Linux runner.
- HTTPS reverse proxy, real production credentials, backup/restore drill and operational ownership.
- Broader browser/device and assistive-technology testing. The axe result covers the overview and tested rules, not a full WCAG conformance assessment.
- Load testing, independent security assessment and non-Latin PDF language support.

No automatic email/SMS delivery, bank verification, legal filing, government portal submission, courier dispatch or multi-tenant authorization is claimed. Stock actions are owner-confirmed workspace transactions. The app is functional locally and is not represented as a deployed production SaaS.

## Reproduce

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run format:check
```

The repository was initially an empty workspace without Git metadata. Existing `.kilo` contents and the user's environment file were preserved.
