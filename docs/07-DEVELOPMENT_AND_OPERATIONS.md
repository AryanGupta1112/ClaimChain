# Development and Operations

## Prerequisites

- Node.js 24 or newer.
- npm.
- Chromium for Playwright browser tests.
- Docker and Docker Compose only for container operation.
- AWS credentials only for optional live S3, Textract, or Bedrock actions.

## First local run

```powershell
cd C:\Users\Lenovo\First-commit
npm ci
npm run dev
```

Open:

- Landing: `http://127.0.0.1:5173/`
- Workspace: `http://127.0.0.1:5173/workspace`
- API health: `http://127.0.0.1:3001/api/health`

`scripts/dev.mjs` starts Express first, waits for a healthy response, then starts Vite. Stop both with `Ctrl+C` in the same terminal.

## Production-style local run

```powershell
npm run build
npm start
```

Open `http://127.0.0.1:3001/`. Express serves both the built frontend and API.

## Commands

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start API and Vite with readiness coordination |
| `npm run dev:server`   | Watch only the Express server                  |
| `npm run dev:client`   | Start only Vite; expects API on port 3001      |
| `npm run typecheck`    | TypeScript check without emitting              |
| `npm run build`        | Typecheck and create `dist/`                   |
| `npm start`            | Serve API and existing production bundle       |
| `npm test`             | Run 16 API/domain/auth/RBAC tests               |
| `npm run test:e2e`     | Run eight Playwright browser workflows         |
| `npm run format`       | Format application/test code                   |
| `npm run format:check` | Check formatting without rewriting             |

Install the browser once before E2E tests:

```powershell
npx playwright install chromium
```

## Environment variables

| Variable           | Default                     | Purpose                                        |
| ------------------ | --------------------------- | ---------------------------------------------- |
| `HOST`             | `127.0.0.1`                 | Express bind address                           |
| `PORT`             | `3001`                      | Express port                                   |
| `DATA_DIR`         | `./data`                    | SQLite and evidence root                       |
| `SEED_SAMPLE`      | `true`                      | Seed fictional records on a new database       |
| `AUTH_BOOTSTRAP_PASSWORD` | sample demo password | Required for a new non-sample workspace        |
| `AUTH_COOKIE_NAME` | `claimchain_session`        | Opaque session cookie name                     |
| `AUTH_COOKIE_SECURE` | `false`                   | Adds `Secure` to session cookie                |
| `AUTH_SESSION_TTL_HOURS` | `12`                   | Server-side session lifetime                   |
| `AUTH_CODE_TTL_MINUTES` | `10`                    | Verification/reset code lifetime               |
| `AUTH_EXPOSE_CODES` | `false`                     | Development-only code display                  |
| `SIMULATION_ENABLED` | `false`                    | Starts the automatic fictional ingestion feed |
| `SIMULATION_INTERVAL_MS` | `15000`                | Synthetic event interval, minimum five seconds |
| `SMTP_HOST`        | unset                       | Enables real verification/recovery email       |
| `APP_ORIGIN`       | unset                       | Allowed public mutation origin                 |
| `AWS_REGION`       | `ap-south-1`                | Region for all AWS adapters                    |
| `S3_BUCKET`        | unset                       | Enables evidence mirror                        |
| `ENABLE_TEXTRACT`  | unset                       | `true` enables image extraction                |
| `BEDROCK_MODEL_ID` | unset                       | Enables assisted drafting                      |

Never use `VITE_` variables for secrets; Vite exposes them to the browser bundle.

## Data locations

```text
data/
  claimchain.sqlite
  claimchain.sqlite-wal
  claimchain.sqlite-shm
  evidence/
    <opaque evidence IDs>
```

The WAL/SHM files can appear while the database is open. Treat the whole directory as application state.

### Start an empty workspace safely

Use a new directory rather than deleting an existing one:

```powershell
$env:SEED_SAMPLE = "false"
$env:DATA_DIR = ".\data-empty"
npm run dev
```

### Reset disposable demo data

Stop the process first. Only remove a directory you intentionally created for disposable sample data; never delete a workspace containing useful evidence.

## Container operation

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f claimchain
```

Stop without deleting the named data volume:

```powershell
docker compose down
```

Do not use `docker compose down -v` unless the volume is confirmed disposable.

## Release procedure

1. Review current scope and known limitations.
2. Run formatting, build, API tests, and browser tests.
3. Inspect desktop/mobile screenshots under `.impeccable/review/`.
4. Build the container and call its health endpoint.
5. Back up the target data volume.
6. Deploy one application instance.
7. Run the smoke sequence from the AWS guide.
8. Record version, image digest, environment, operator, and rollback point.

Suggested pre-release commands:

```powershell
npm run format:check
npm run build
npm test
npm run test:e2e
npm audit --omit=dev
```

## Troubleshooting

### `/api/bootstrap` reports `ECONNREFUSED`

Use `npm run dev`, not separate client/server terminals. The launcher waits for API readiness. If the port is occupied, stop the old process or change both the API port and Vite proxy configuration.

### AWS buttons are absent

The UI follows capabilities from `/api/bootstrap`. Check exact server-side variables, restart the server, and verify the region/model/bucket exists. Credentials alone do not enable a capability.

### Textract rejects a file

The implemented path accepts only PNG/JPEG up to 5 MiB. Convert a scanned PDF page to an image or implement the asynchronous PDF workflow before claiming PDF extraction.

### Bedrock returns access/model errors

Confirm Region availability, Converse compatibility, model/inference-profile ID, and `bedrock:InvokeModel` resource permission.

### Data disappears after container replacement

Confirm `/app/data` maps to the persistent named/EBS-backed volume. Container filesystem layers are disposable.

### Browser shows a horizontal strip/scrollbar

The current root clips unintended horizontal overflow and tests desktop/mobile widths. Hard-refresh to clear stale CSS, verify the latest bundle, then inspect `document.documentElement.scrollWidth` against `window.innerWidth` at the failing viewport.

## Operational ownership

A real deployment needs named owners for release approval, IAM, backups, restore tests, security patching, logs/alarms, Bedrock prompt changes, data retention, and incident response. The repository cannot supply that organizational control by itself.
