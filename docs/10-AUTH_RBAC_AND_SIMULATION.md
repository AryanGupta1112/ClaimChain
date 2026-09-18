# Authentication, RBAC, and Synthetic Ingestion

## Current implementation

ClaimChain uses individual accounts and server-enforced role-based access control. Authentication is required for every `/api` route except health and the auth lifecycle. Raw session tokens and email codes are never stored; SHA-256 digests are persisted in normalized SQLite tables beside the versioned workspace snapshot.

The implementation deliberately has exactly three roles:

| Role | Scope | Intended use |
| --- | --- | --- |
| Workspace administrator | Entire workspace | Configuration, provisioning, case creation, all recovery/inventory actions, security audit, and simulation controls |
| Recovery operator | Explicit case IDs and store IDs | Work assigned cases and store handoffs; an empty assignment grants no record access |
| Auditor | Entire workspace, read-only | Inspect cases, evidence, documents, inventory, activity, and export case packets |

`shared/auth.ts` is the capability matrix shared by server and client. The client removes unavailable navigation and actions. Express independently checks every mutation and assigned record, so hiding a button is never the security boundary. `GET /api/bootstrap` is filtered before serialization: an operator receives only assigned cases, stores, dependent records, and relevant events.

## Account lifecycle

1. An administrator provisions a username, email, temporary password, role, and optional operator assignments.
2. The account starts unverified. A six-digit, short-lived email code is generated and only its digest is stored.
3. Verification consumes the request exactly once and enables sign-in.
4. Login accepts username or email, verifies a scrypt password hash, and issues an opaque HTTP-only `SameSite=Lax` cookie.
5. Forgot password uses a generic response to avoid account discovery. A valid verified account receives a one-time reset code.
6. Reset validates password strength, replaces the scrypt hash, consumes the code, and revokes all existing sessions.
7. Logout revokes the current session. Disabling an account revokes all of its sessions.

Local sample accounts use `ClaimChainDemo!2026`:

| Username | Email | Role |
| --- | --- | --- |
| `admin` | `admin@claimchain.local` | Workspace administrator |
| `operator` | `operator@claimchain.local` | Recovery operator, assigned sample cases/stores |
| `auditor` | `auditor@claimchain.local` | Auditor |

These credentials are demonstration data only. A non-sample workspace requires `AUTH_BOOTSTRAP_PASSWORD`; production operators must replace bootstrap credentials and use a real SMTP provider.

## Security audit

Authentication results, account changes, denied authorization attempts, verification/reset requests, logout, and manually triggered simulation events are written to `security_audit`. The Access control screen exposes a server-paginated view to administrators. Entries contain actor label, target, action, detail, IP, user agent, and time, but never passwords, cookies, or email codes.

## Synthetic ingestion

`server/simulator.ts` supplies a bounded development feed when ClaimChain has no external ERP, bank, or inventory integration. Every interval it performs one deterministic fictional event through the same `StoreDB.mutate` transaction boundary:

1. Create a labeled payment recovery case.
2. Record a labeled partial payment.
3. Schedule a labeled follow-up.
4. Apply a labeled stock quantity update.

Set `SIMULATION_ENABLED=true` and `SIMULATION_INTERVAL_MS=30000` to run it automatically. Administrators can inspect status and trigger the next event from Access control. It is intentionally a simulator, not a claim of bank, supplier, or point-of-sale connectivity.

## Pagination

Cases, follow-ups, activity, stock lots, and transfers paginate in the client after role-filtered bootstrap loading. User accounts and security audit entries use server pagination (`page`, `pageSize`) because those normalized tables can grow independently. Search and filters are applied before client pagination.

## Production evolution on AWS

The current account tables can run on the documented single-instance deployment, with SMTP delivered by Amazon SES. For a horizontally scaled version:

- Amazon Cognito can replace local password/session issuance while ClaimChain's capability and record-scope checks remain authoritative.
- Amazon RDS PostgreSQL or DynamoDB should replace single-file SQLite before adding replicas.
- Amazon SES should deliver verification and reset codes from a verified domain.
- AWS WAF and distributed rate limiting should protect login and code endpoints.
- CloudWatch should receive structured security-audit and ingestion-failure metrics without secrets.
- EventBridge and SQS can replace the in-process timer when simulated or real connectors become distributed jobs.

The complete role contract and endpoint matrix are maintained in [`../RBAC-PLAN.txt`](../RBAC-PLAN.txt).
