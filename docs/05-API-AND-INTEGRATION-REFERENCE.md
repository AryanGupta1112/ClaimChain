# ClaimChain API and Integration Reference

## Conventions

- Base path: `/api`.
- Production uses the same origin as the frontend.
- JSON is the default request/response format; evidence upload uses multipart form data.
- Money is integer paise, never floating-point rupees.
- Business dates use `YYYY-MM-DD`.
- Errors use `{ "error": "Human-readable message", "code": "STABLE_CODE" }`.
- Validation failures return `400`, missing records `404`, and transition/domain conflicts `409`.
- All workspace API routes except health require a Django-issued HTTP-only session cookie.
- Mutating requests with a foreign `Origin` are rejected with `403`.

## Health and session

### `GET /api/health`

Returns process health and whether authentication is enabled.

```json
{ "status": "ok", "authentication": true }
```

### `POST /auth/login`

```json
{ "identifier": "admin", "password": "account password" }
```

On success, Django sets a signed, HTTP-only, `SameSite=Lax` cookie backed by a revocable session. `Secure` is added when `AUTH_COOKIE_SECURE=true`. Repeated attempts are rate limited.

### `GET /auth/me`

Returns the current safe user object, including role, capabilities, and assigned record scopes.

### `POST /auth/logout`

Expires the session cookie.

### Verification and recovery

- `POST /auth/verify/send` with `{ "identifier": "..." }`
- `POST /auth/verify/confirm` with `identifier`, `requestId`, and six-digit `code`
- `POST /auth/forgot` with `{ "identifier": "..." }`
- `POST /auth/reset` with `requestId`, `code`, and the new `password`

Send/forgot use generic responses to limit account discovery. Codes expire, are single-use, and are stored only as digests.

### Administration and simulation

- `GET /api/admin/roles`
- `GET|POST /api/admin/users`
- `PATCH|DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/resend-verification`
- `GET /api/admin/security-audit?page=1&pageSize=10`
- `GET /api/simulation/status`
- `POST /api/simulation/control` with `{ "halted": true|false }`
- `POST /api/simulation/ingest`

These routes require administrator capabilities. The control state is persisted in SQLite; while halted, scheduled ingestion is stopped and manual ingestion returns `409 SIMULATION_HALTED`. User and audit lists return `items`, `page`, `pageSize`, `total`, and `pages`. See [Identity, access, and simulation](11-IDENTITY-ACCESS-AND-SIMULATION.md).

## Workspace

### `GET /api/bootstrap`

Returns the complete workspace state and server capabilities:

```json
{
  "workspace": {},
  "cases": [],
  "payments": [],
  "evidence": [],
  "documents": [],
  "tasks": [],
  "checklist": [],
  "stores": [],
  "lots": [],
  "transfers": [],
  "events": [],
  "capabilities": {
    "bedrock": false,
    "textract": false,
    "s3": false,
    "auth": true,
    "region": "ap-south-1",
    "mode": "Local workspace"
  }
}
```

### `PATCH /api/workspace`

```json
{
  "name": "Mehta General Stores",
  "owner": "Aarav Mehta",
  "email": "aarav@example.com",
  "address": "Indiranagar, Bengaluru"
}
```

### `GET /api/export`

Downloads a JSON snapshot with `exportedAt` and `schemaVersion` metadata.

## Cases

### `POST /api/cases`

```json
{
  "title": "Wholesale grocery supply",
  "kind": "payment",
  "counterparty": "Kaveri Cafe",
  "invoice": "INV-2026-041",
  "amount": 4850000,
  "dueDate": "2026-09-06",
  "summary": "Goods delivered and acknowledged."
}
```

`kind` is `payment`, `document`, or `dispute`. Payment cases require a positive amount; the other kinds require zero. Document/dispute creation also creates the standard recovery checklist.

### `GET /api/cases/:id`

Returns the case plus its payments, evidence, documents, tasks, checklist, and case events.

### `PATCH /api/cases/:id`

```json
{
  "summary": "Updated reviewed facts.",
  "status": "in_progress"
}
```

Both fields are optional. Resolution rules are described in [Domain model and operational workflows](04-DOMAIN-MODEL-AND-OPERATIONAL-WORKFLOWS.md).

### `GET /api/cases/:id/packet`

Downloads an A4 PDF containing case facts, payment ledger, evidence manifest and hashes, extracted text, requirements, timeline, and prepared drafts. Original binary evidence is not embedded.

## Payments

### `POST /api/cases/:id/payments`

```json
{
  "amount": 1500000,
  "date": "2026-09-14",
  "reference": "UPI-4902",
  "key": "client-generated-idempotency-key"
}
```

The exact same request can be replayed with the same `key`. A changed replay, duplicate reference, future date, non-payment case, or overpayment returns an error.

## Evidence

### `POST /api/cases/:id/evidence`

Multipart form with one field named `file`. Maximum upload size is 10 MiB. Accepted types are PDF, PNG, JPEG, and plain text. The server validates signatures, calculates SHA-256, stores original bytes, and returns evidence metadata.

### `GET /api/evidence/:id/file`

Downloads the original evidence as an attachment with its recorded MIME type and filename.

### `POST /api/evidence/:id/extract`

For plain text, returns the existing local extraction. For PNG/JPEG up to 5 MiB, invokes Textract when enabled, saves line text, sets provider to `AWS Textract`, and records an event. PDFs are deliberately rejected by the current synchronous path.

### `POST /api/evidence/:id/mirror`

Invokes private S3 mirroring when `S3_BUCKET` is configured. The object key is `evidence/<case-id>/<evidence-id>`. On success, the record receives `cloudKey`.

## Drafts and PDFs

### `POST /api/cases/:id/documents`

```json
{ "kind": "reminder", "ai": false }
```

`kind` is `reminder`, `request`, or `statement`. `ai=false` uses the deterministic local template. `ai=true` requires Bedrock and records `Amazon Bedrock - review required` as provider.

### `PATCH /api/documents/:id`

```json
{
  "body": "Edited letter body...",
  "revision": 1
}
```

The revision must match the current server revision. A successful save increments it.

### `GET /api/documents/:id/download`

Downloads the current draft as a PDF. Downloading does not mark the draft as sent.

## Follow-ups and requirements

### `POST /api/tasks`

```json
{
  "caseId": "case-id",
  "title": "Confirm delivery acknowledgement",
  "dueDate": "2026-09-21"
}
```

### `PATCH /api/tasks/:id`

```json
{ "done": true }
```

Requesting the current state does not create another activity event.

### `PATCH /api/checklist/:id`

```json
{ "done": true }
```

Changing a completed requirement back to pending is rejected while the case is resolved.

## Stores and inventory

### `POST /api/stores`

```json
{ "name": "Green Basket", "locality": "Domlur" }
```

The pair of name and locality must be unique case-insensitively.

### `POST /api/stock`

```json
{
  "storeId": "store-id",
  "sku": "RICE-5KG",
  "product": "Sona masoori rice",
  "category": "Staples",
  "unit": "bags",
  "quantity": 64,
  "expiry": "2027-03-17",
  "batch": "SM-0926"
}
```

Expired stock, unknown stores, and duplicate store/SKU/batch combinations are rejected.

### `POST /api/transfers`

```json
{
  "lotId": "lot-id",
  "destination": "destination-store-id",
  "quantity": 10
}
```

Creates a `reserved` transfer and increases the lot's reserved quantity atomically.

### `POST /api/transfers/:id/transition`

```json
{ "status": "dispatched" }
```

Allowed commands are `dispatched`, `received`, and `cancelled`, subject to the transfer state machine.

## Error handling

| Status | Meaning                                              |
| ------ | ---------------------------------------------------- |
| `400`  | Invalid input, date, file, or request shape          |
| `401`  | Missing, invalid, or expired session                 |
| `403`  | Disallowed request origin                            |
| `404`  | Record or endpoint not found                         |
| `409`  | Domain conflict or unavailable configured capability |
| `413`  | Upload exceeds the Multer limit                      |
| `429`  | Login attempt limit reached                          |
| `500`  | Unexpected server or provider failure                |

Provider errors are failed operations; they do not imply a successful cloud action. Production deployments should add structured correlation IDs and sanitized centralized logging.
