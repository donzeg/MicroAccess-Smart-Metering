# MSM Backend

Fastify + TypeScript backend foundation for MicroAccess Smart Metering.

## Included in this first build slice
- JWT login endpoint (`POST /api/v1/auth/login`)
- Protected customer-meter mapping endpoint (`GET /api/v1/customers/:customerId/meters`)
- Purchase lifecycle endpoints with idempotent provider credit support
- Unit and integration tests (Vitest)

## Provider integration modes
- Default mode: local idempotent provider simulation for development and tests.
- Live mode: set `STEAMA_ENABLED=true` and provide service credentials in `.env`.
- In live mode, backend posts customer top-up to `POST /customers/{id}/transactions/` through Steama token auth from `/get-token/`.
- Web/mobile clients never call Steama directly.

## Storage modes
- Default mode: `STORAGE_MODE=in_memory` for development and tests.
- Persistent mode: `STORAGE_MODE=postgres` with `DATABASE_URL` configured.
- PostgreSQL schema file: `backend/db/schema.sql`.

## Lifecycle endpoints
- `POST /api/v1/purchases/initiate`
- `POST /api/v1/purchases/:purchaseId/payment-confirmed`
- `POST /api/v1/purchases/:purchaseId/credit-provider`
- `POST /api/v1/purchases/:purchaseId/reconcile`
- `GET /api/v1/purchases/:purchaseId`

## Local run
1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Run checks: `npm run lint && npm run typecheck && npm test`
