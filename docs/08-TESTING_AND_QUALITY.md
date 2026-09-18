# Testing and Quality

## Quality strategy

Coverage is organized around business risk rather than component count. Financial reconciliation, inventory conservation, evidence integrity, draft concurrency, authentication, and complete browser journeys receive direct tests.

## Current automated result

As recorded on 18 September 2026:

| Suite                          | Result        |
| ------------------------------ | ------------- |
| TypeScript strict/build        | Passed        |
| API/domain tests               | 13 passed     |
| Browser workflows              | 7 passed      |
| Tested axe WCAG A/AA rules     | No violations |
| Desktop/mobile overflow checks | Passed        |
| Formatting                     | Passed        |
| Production bundle              | Passed        |

See [`../VERIFICATION.md`](../VERIFICATION.md) for the detailed verification record and external gaps.

## API/domain coverage

The Node test suite verifies:

1. Asia/Kolkata midnight and year rollover.
2. Persistence across database close/reopen.
3. Partial/full payment reconciliation.
4. Idempotent payment replay and conflicting replay rejection.
5. Duplicate references, overpayment, and premature resolution rejection.
6. Reservation-based oversell prevention.
7. Cancellation release and one-time receipt credit.
8. Evidence byte preservation, hash deduplication, type/signature, and size validation.
9. Draft revision conflicts and real PDF outputs.
10. Requirement-gated resolution and reopening.
11. Idempotent follow-up completion/reopening events.
12. Invalid dates, money, IDs, and cross-origin mutation rejection.
13. Password session login, unauthorized access, and logout.
14. Empty workspace store/stock creation.
15. Workspace profile propagation into correspondence and exports.

## Browser workflow coverage

Playwright verifies:

- full-viewport landing at 1280 x 800 and 390 x 844;
- exact-black landing background and no page overflow;
- mobile navigation focus trap, Escape behavior, and focus restoration;
- unsaved-draft dismissal protection;
- payment case creation, evidence upload, drafting, editing, PDF download, partial/full payment, and packet export;
- stock reservation, dispatch, receipt, and changed inventory;
- document-recovery checklist and follow-up flow;
- desktop/mobile navigation and responsive layouts;
- screenshots of overview, case, stock, landing, and mobile states;
- axe checks against selected WCAG 2 A/AA/2.1 AA rules.

Tests run against a temporary data directory and port `3101`, so they do not mutate the preview workspace.

## Visual artifacts

Generated review files under `.impeccable/review/` include:

- `landing-1280x800.png`
- `landing-mobile.png`
- `desktop.png`
- `mobile.png`
- `case-desktop.png`
- `stock-desktop.png`
- rendered packet pages

The final workspace is an exact-black operational interface with near-black controls, pale text, and status colors adjusted for tested contrast.

## Regression expectations

Changes touching the following require targeted tests:

| Area               | Minimum verification                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| Money/payment      | Unit/API tests for balance, idempotency, overpayment, status              |
| Inventory/transfer | Unit/API tests for available/reserved conservation and transitions        |
| Storage/schema     | Restart/migration test and backup compatibility review                    |
| Evidence           | Signature, size, digest, download, cleanup-on-failure tests               |
| Draft editing      | Revision conflict and dirty-dismissal browser test                        |
| Authentication     | anonymous/authenticated/origin/cookie tests                               |
| Responsive UI      | desktop, intermediate, mobile overflow and screenshot checks              |
| AWS adapter        | mocked contract test plus explicit live smoke in a non-production account |

## What is not yet proven

- Live S3, Textract, or Bedrock behavior in a real AWS account.
- Docker execution on the target AWS host.
- Hosted CI on Linux in this workspace.
- Load, soak, chaos, and failover behavior.
- Backup restoration from a real EBS snapshot.
- Full browser/device/assistive-technology matrix.
- Complete WCAG conformance; automated axe coverage is not certification.
- Malware scanning or adversarial file corpus.
- Penetration testing and independent security assessment.
- Non-Latin PDF rendering and localization.

## Manual release checklist

- [ ] Landing artwork reaches viewport boundaries at target sizes.
- [ ] Operational routes remain black with no bottom/horizontal strip.
- [ ] Keyboard navigation and visible focus work.
- [ ] Long names, amounts, and filenames do not overlap.
- [ ] Every destructive/terminal action has clear state feedback.
- [ ] Provider labels distinguish local, Textract, S3, and Bedrock behavior.
- [ ] Sample records remain visibly fictional.
- [ ] PDF wording does not claim sending, filing, authenticity, or bank verification.
- [ ] Restart persistence and evidence download are tested.
- [ ] AWS deployment verification is recorded separately from local test success.
