# ClaimChain Identity, Access, and Simulation

## Current implementation

ClaimChain uses Django as its identity authority and Express as its operational authorization boundary. Django owns individual accounts, password hashes, verification/reset codes, session revocation, account provisioning, and the auth audit trail in `data/claimchain-auth.sqlite3`. Express requires Django session introspection before every workspace `/api` request.

The implementation deliberately has exactly three roles:

| Role | Scope | Intended use |
| --- | --- | --- |
| Workspace administrator | Entire workspace | Configuration, provisioning, case creation, all recovery/inventory actions, security audit, and simulation controls |
| Recovery operator | Explicit case IDs and store IDs | Work assigned cases and store handoffs; an empty assignment grants no record access |
| Auditor | Entire workspace, read-only | Inspect cases, evidence, documents, inventory, activity, and export case packets |

`shared/auth.ts` is the capability matrix shared by server and client. The client removes unavailable navigation and actions. Express independently checks every mutation and assigned record, so hiding a button is never the security boundary. `GET /api/bootstrap` is filtered before serialization: an operator receives only assigned cases, stores, dependent records, and relevant events.

## Authorisation contract

The following table describes the production intent in operational terms. The exact machine-readable capability names live in `shared/auth.ts`; Django mirrors the same role matrix when it returns an authenticated user profile.

| Role | May do | May not do |
| --- | --- | --- |
| Workspace administrator | View and create cases; manage recovery records, payments, evidence, documents, tasks, inventory, transfers, workspace settings, accounts, audit history, and the ingestion control. | Nothing within the current single workspace is excluded by role. |
| Recovery operator | View the dashboard, and work their explicitly assigned cases and stores: recovery updates, payments, evidence, drafts, tasks, exports, and inventory handoffs. | Create cases, amend protected financial history, manage workspace settings or users, inspect other assignments, or operate the simulator. |
| Read-only auditor | View dashboard, cases, inventory, and activity across the workspace; export packets for review. | Create, edit, record, provision, dispatch, confirm, or change any operational data. |

The browser uses this contract to make the interface understandable. Django and Express enforce it server-side. A direct API request cannot gain a capability that the signed account does not possess.

## Account lifecycle

1. An administrator provisions a username, email, temporary password, role, and optional operator assignments.
2. The account starts unverified. Django generates a six-digit, short-lived email code and stores only its digest.
3. Verification consumes the request exactly once and enables sign-in.
4. Login accepts username or email, verifies Django's password hash, and issues a signed HTTP-only `SameSite=Lax` cookie backed by a revocable Django session.
5. Forgot password uses a generic response to avoid account discovery. A valid verified account receives a one-time reset code.
6. Reset validates password strength, replaces the Django password hash, consumes the code, and revokes all existing sessions.
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

Set `SIMULATION_ENABLED=true` and `SIMULATION_INTERVAL_MS=30000` to run it automatically. Administrators can inspect status and trigger the next event from Access control. A red Continue/Halt control in the authenticated top bar governs the entire ingestion subsystem: Halt stops the automatic timer and rejects manual events; Continue permits manual ingestion and restarts the timer when automatic simulation is environment-enabled. The state, event count, and last event are stored in SQLite, survive application restarts, and control changes are written to the security audit. It is intentionally a simulator, not a claim of bank, supplier, or point-of-sale connectivity.

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
## Service boundary

React sends `/auth/*` and `/auth/admin/*` to Django on port `8000` in development. Express continues to own `/api/*` recovery, evidence, stock, simulation, and document operations on port `3001`. It asks Django to validate each signed cookie, so logout, password reset, a disabled account, and role changes take effect immediately in both services.

`npm run dev` applies Django migrations, seeds the three fictional demonstration accounts only when the Django database is empty, then starts Django, Express, and Vite. In production, EC2/Nginx routes `/auth` to Django and `/api` to Express under one HTTPS domain.
