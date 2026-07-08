# MSM Backend

Fastify + TypeScript backend foundation for MicroAccess Smart Metering.

## Included in this first build slice
- JWT login endpoint (`POST /api/v1/auth/login`)
- Protected customer-meter mapping endpoint (`GET /api/v1/customers/:customerId/meters`)
- Purchase lifecycle endpoints with idempotent provider credit support
- Unit and integration tests (Vitest)

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
- Default mode: local idempotent provider simulation for development and tests.
- Live mode: set `STEAMA_ENABLED=true` and provide service credentials in `.env`.
- In live mode, backend posts customer top-up to `POST /customers/{id}/transactions/` through Steama token auth from `/get-token/`.
- Web/mobile clients never call Steama directly.

## Storage modes
- Default mode: `STORAGE_MODE=in_memory` for development and tests.
- Persistent mode: `STORAGE_MODE=postgres` with `DATABASE_URL` configured.
- PostgreSQL schema file: `backend/db/schema.postgres.ddl`.
- On startup in postgres mode, backend applies tracked schema migration `0001_schema_postgres_ddl` and verifies checksum drift before serving traffic.

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
1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Run checks: `npm run lint && npm run typecheck && npm test`
5. Run postgres parity integration test (when postgres is available): `TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/msm_test npm test -- --run tests/integration/postgresParity.test.ts`

## CI TypeScript compatibility guardrails
- Keep backend code compatible with the current TypeScript target/library used in CI.
- Do not use ES2023-only helpers such as `Array.prototype.toSorted`; use copy + `sort` instead.
- For generic serializers (for example CSV builders), avoid requiring index signatures on typed row interfaces.
