# MSM Backend

> [!CAUTION]
> This backend is a prototype. Its current SteamaCo credit request sends fields
> that do not match the authenticated live transaction schema and omits the
> required transaction category. Do not enable it for real customer credit.
> See the
> [verified API contract](../docs/vendor/steama/API_CONTRACT.md) and
> [billing/payment design](../docs/product/BILLING_AND_PAYMENTS.md).

Fastify + TypeScript backend foundation for MicroAccess Smart Metering.

## Current operating posture

The default operating mode is `phase1_read_only`. In this mode:

- PostgreSQL is required outside automated tests;
- unsafe or placeholder production configuration fails startup validation;
- legacy purchase, provider-credit, callback, reconciliation, manual-reading
  and simulated-data routes are not registered;
- customer self-service is disabled;
- provider directives are disabled;
- the SteamaCo read-only client exposes only `GET`, `HEAD` and `OPTIONS` after
  its internal token authentication request.

`legacy_prototype` exists only to preserve and test inherited behavior. The
runtime rejects that mode in production. It is not an approved deployment
configuration.

## Included in the Phase 1 foundation slice

- fail-closed runtime configuration checks;
- PostgreSQL migration for tenant/site, integration evidence, provider
  mappings, service accounts, meters, effective assignments, topology,
  readiness exceptions, audit and outbox records;
- a strictly read-only SteamaCo client with rate limiting, token refresh,
  timeout handling and sanitized errors;
- runtime capability reporting;
- live, read-only SteamaCo operations overview with normalized meter/customer
  records, freshness, assignment coverage, topology classification and
  exception counts;
- automated safety tests proving that legacy mutation routes are absent from
  Phase 1 mode.

## Phase 1 operations endpoints

The management web application uses these server-side endpoints:

- `GET /api/v1/ops/steama/overview` — normalized live operations dataset;
- `GET /api/v1/ops/steama/overview?refresh=true` — bypass the short provider
  protection cache;
- `GET /api/v1/ops/steama/meters/:providerId` — normalized live meter detail;
- `GET /api/v1/ops/steama/energy-mix` — matched solar, grid and configured
  generator contribution for preset or exact date windows;
- `GET /api/v1/ops/steama/revenue-costs` — read-only customer usage-charge,
  source-attribution and retail energy-value analysis. It deliberately keeps
  usage charges, cash collections and AEDC settlement separate;
- `GET /api/v1/ops/runtime-capabilities` — safe runtime feature status.

All endpoints require a management JWT. They return normalized operational
fields only and do not return the provider token, service username, service
password or unrestricted raw provider payloads.

## Role-based access control
- Login supports `management` and `customer` roles via `POST /api/v1/auth/login`.
- `management` can run operations endpoints (credit provider, reconciliation, retry pending, audit logs).
- `customer` can only initiate purchases for their own `customerId` and read their own purchase/meter data.
- Payment callback endpoint remains service-facing (`POST /api/v1/payments/callback`).

## Callback security
- `POST /api/v1/payments/callback` requires signed headers:
	- `x-callback-id`
	- `x-callback-timestamp`
	- `x-callback-signature`
- Signature format: HMAC SHA-256 over `timestamp.callbackId.canonicalPayload`.
- Replay protection blocks reused callback IDs within the tolerance window.
- Config keys: `CALLBACK_SECRET`, `CALLBACK_TOLERANCE_SECONDS`.

## Request throttling
- Inbound API endpoints have fixed-window rate limits by policy (auth, purchase initiation, callback, management ops, reads).
- Outbound provider calls are throttled to `PROVIDER_RATE_LIMIT_RPS` (default 10 rps) to respect provider constraints.
- Blocked requests are logged with structured fields including policy, identity, and retryAfterSeconds.
- Management can inspect current rate-limit counters via `GET /api/v1/ops/rate-limit-metrics`.
- Config keys: `AUTH_LOGIN_LIMIT_PER_MINUTE`, `PURCHASE_INITIATE_LIMIT_PER_MINUTE`, `CALLBACK_LIMIT_PER_MINUTE`, `MANAGEMENT_OPS_LIMIT_PER_MINUTE`, `READS_LIMIT_PER_MINUTE`, `PROVIDER_RATE_LIMIT_RPS`.

## Provider integration modes

- Phase 1: set `STEAMA_ENABLED=true` and provide a rotated service credential
  through the approved secret process. Only the read-only client is approved.
- Legacy automated tests: a local provider simulation remains available under
  `MSM_OPERATION_MODE=legacy_prototype` when `NODE_ENV=test`.
- The inherited live credit client remains in the source for review history,
  but production configuration cannot expose it.
- Web/mobile clients never call SteamaCo directly.

## Storage modes

- Phase 1 requires `STORAGE_MODE=postgres` with `DATABASE_URL` outside tests.
- `in_memory` is accepted only for isolated automated-test behavior.
- `backend/db/phase1_read_only.postgres.ddl` is migration
  `0002_phase1_read_only_foundation`.
- The inherited prototype schema is applied only in legacy prototype mode.
- Applied migrations are checksum-verified before the service begins work.

## Pending credit retry worker
- A background worker retries purchases in `payment_confirmed_credit_pending`.
- Retry cadence uses exponential backoff after failed cycles.
- Failure threshold is tracked with max-consecutive-failure guardrails.
- Retry results include `failureReasons` aggregation for failed provider credit attempts.
- Failed purchases can be reconciled in batch through `POST /api/v1/purchases/reconcile-failed`.
- Management reconciliation telemetry is available through `GET /api/v1/ops/reconciliation-metrics` with cumulative counters for retry and failed-reconcile outcomes.
- Key settings: `RETRY_WORKER_ENABLED`, `RETRY_WORKER_INTERVAL_MS`, `RETRY_WORKER_BATCH_LIMIT`, `RETRY_WORKER_MAX_CONSECUTIVE_FAILURES`, `RETRY_WORKER_BACKOFF_MULTIPLIER`, `RETRY_WORKER_MAX_INTERVAL_MS`.

## Lifecycle endpoints
- `POST /api/v1/purchases/initiate`
- `POST /api/v1/purchases/:purchaseId/payment-confirmed`
- `POST /api/v1/payments/callback`
- `POST /api/v1/purchases/:purchaseId/credit-provider`
- `POST /api/v1/purchases/retry-pending`
- `POST /api/v1/purchases/:purchaseId/reconcile`
- `POST /api/v1/purchases/reconcile-failed`
- `GET /api/v1/purchases/:purchaseId`
- `GET /api/v1/purchases/audit-logs`
- `GET /api/v1/purchases/:purchaseId/audit-logs`

Management export endpoints:
- `GET /api/v1/ops/exports/transactions` (supports `format=json|csv`)
- `GET /api/v1/ops/exports/reconciliation` (supports `format=json|csv`)

Meter reading endpoints:
- `POST /api/v1/meters/:meterId/readings` (management-only ingest)
- `GET /api/v1/meters/:meterId/readings`
- `GET /api/v1/meters/:meterId/readings/aggregates` (bucketed `hour|day` summary)

Management meter analytics endpoints:
- `GET /api/v1/ops/meters/analytics/summary`
- `GET /api/v1/ops/meters/analytics/top-consumers`

## Local run

1. Copy `.env.example` to `.env`.
2. Configure the MSM staff login and generated application secrets:
   `./scripts/configure-app-access.sh`.
3. Replace the remaining placeholders and point `DATABASE_URL` to a dedicated MSM
   development database.
4. Keep `MSM_OPERATION_MODE=phase1_read_only`.
5. Install dependencies: `npm install`.
6. Run the service: `npm run dev`.
7. Run checks: `npm run lint && npm run typecheck && npm run build && npm test`.
8. Run PostgreSQL parity tests against a disposable database when available:
   `TEST_POSTGRES_URL=postgresql://... npm test -- --run tests/integration/postgresParity.test.ts`.

The MSM staff account is separate from the SteamaCo provider account. Do not
reuse the SteamaCo password for staff access. The helper hides the staff
password, requires confirmation, generates fresh JWT and callback secrets, and
keeps `backend/.env` at file mode `600`.

For the SteamaCo connection, keep the service credentials only in
`backend/.env` (or the production secret store):

```dotenv
STEAMA_ENABLED=true
STEAMA_SERVICE_USERNAME=your-service-username
STEAMA_SERVICE_PASSWORD=your-service-password
```

Do not put these values in the `web` environment, browser storage or Git.

The local setup helper updates only those three settings, hides the password
while it is entered and sets file mode `600`:

```bash
./scripts/configure-steama.sh
```

## CI TypeScript compatibility guardrails
- Keep backend code compatible with the current TypeScript target/library used in CI.
- Do not use ES2023-only helpers such as `Array.prototype.toSorted`; use copy + `sort` instead.
- For generic serializers (for example CSV builders), avoid requiring index signatures on typed row interfaces.
