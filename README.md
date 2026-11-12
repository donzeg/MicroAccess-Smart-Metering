# MicroAccess Smart Metering (MSM)

MicroAccess Smart Metering (MSM) is an on-premise smart metering product for monitoring electricity usage, tracking purchases, and generating monthly reports from Steama-connected meters.

MSM is designed for the current deployment context (single plaza in Abuja with 3 bulk meters and prepaid downstream meters) while keeping the architecture reusable for future deployments such as estates and malls.

## Documentation Status

The project is being redesigned from first principles following authenticated
review of SteamaCo API release `v4.40.0`.

Start with the [current documentation index](docs/README.md). In particular:

- [SteamaCo API Contract](docs/vendor/steama/API_CONTRACT.md) records verified
  upstream behavior.
- [Product Requirements](docs/product/PRODUCT_REQUIREMENTS.md) defines the
  intended product.
- [Domain Model](docs/product/DOMAIN_MODEL.md) defines authoritative records
  and invariants.
- [Billing and Payments](docs/product/BILLING_AND_PAYMENTS.md) defines the
  target financial lifecycle.
- [Target Architecture](docs/product/TARGET_ARCHITECTURE.md) and
  [Delivery Plan](docs/product/DELIVERY_PLAN.md) define how the replacement
  product should be built and certified.

Root-level project, architecture and technology documents predate authenticated
API discovery and are retained as legacy context. The current backend is a
prototype and must not be treated as production-ready billing software.

## Table of Contents
- [MicroAccess Smart Metering (MSM)](#microaccess-smart-metering-msm)
	- [Documentation Status](#documentation-status)
	- [Table of Contents](#table-of-contents)
	- [Product Overview](#product-overview)
	- [Current Business Context](#current-business-context)
	- [Objectives](#objectives)
	- [API-First Scope](#api-first-scope)
	- [Out of Scope for MVP](#out-of-scope-for-mvp)
	- [System Architecture](#system-architecture)
	- [Technology Stack](#technology-stack)
	- [Steama API Mapping](#steama-api-mapping)
	- [Web Application Features](#web-application-features)
	- [Mobile Application Features](#mobile-application-features)
	- [Role and Access Model](#role-and-access-model)
	- [User-to-Meter Connection Model](#user-to-meter-connection-model)
	- [Billing and Reconciliation Rules](#billing-and-reconciliation-rules)
	- [Reporting Outputs](#reporting-outputs)
	- [Repository Contents](#repository-contents)
	- [Environment and Deployment](#environment-and-deployment)
	- [Security and Compliance Baseline](#security-and-compliance-baseline)
	- [Implementation Roadmap](#implementation-roadmap)
	- [Success Metrics](#success-metrics)
	- [Contributing](#contributing)
	- [License](#license)

## Product Overview
MSM provides two aligned interfaces:

1. Management Platform (Web)
- Meter monitoring and status visibility
- Monthly kWh reporting
- Department/customer spend reporting
- Alerts and operational visibility

2. Customer Mobile App
- Balance visibility
- Unit purchase flow
- Consumption and transaction history
- Notifications for important events

The product principle is strict: provider-dependent features require a verified
SteamaCo contract, while MSM-owned functions such as identity, tariff
versioning, billing, ledger and reconciliation require explicit internal
authority and evidence.

## Current application slice

The first operational web slice is now implemented under [`web`](web/README.md).
It uses the Fastify backend as the only path to SteamaCo and provides live
read-only inventory, communication freshness, assignment coverage, interpreted
meter roles, exception priorities, detailed meter operations, customer coverage
and a separate management view.

Service credentials are stored only in `backend/.env` or the production secret
store. The browser and web application environment never receive the SteamaCo
username, password or token. Until those credentials are configured, the UI
shows an explicit integration setup state and does not invent data.

## Current Business Context
- Deployment model: On-premise server with Cloudflare Tunnel for internet exposure
- Current operation: single site (Abuja plaza)
- Meter estate: about 30+ meters
- Topology: 3 bulk meters + prepaid downstream meters
- Current billing policy: generator contribution is excluded from customer billing in phase 1
- Generator status: bulk generator meter exists but is not yet installed, so generator attribution is deferred

This context informs the initial UI and reporting scope, but MSM keeps the data model tenant-ready for future multi-site expansion.

## Objectives
1. Provide accurate meter readings ingestion and visibility
2. Generate monthly consumption reports in kWh
3. Generate monthly spend reports by customer/department
4. Support prepaid unit purchase tracking end-to-end
5. Avoid non-essential features not supported by integration APIs

## Current Implementation Status
Backend implementation is actively in progress and currently includes:

1. Fastify + TypeScript backend foundation with strict validation and JWT role-based auth
2. Customer-to-meter mapping endpoints with management/customer access controls
3. Purchase lifecycle implementation with canonical states (`initiated`, `payment_confirmed_credit_pending`, `credited`, `failed`, `reconciled`)
4. Prototype provider integration through a backend-managed Steama token flow;
   the current top-up request body is not compatible with the verified live
   transaction schema and must remain disabled for production mutations
5. Callback security (HMAC signature verification, timestamp tolerance, replay protection)
6. Pending-credit retry worker with backoff and failure-reason aggregation
7. Inbound and outbound rate limiting with management telemetry endpoint (`GET /api/v1/ops/rate-limit-metrics`)
8. Reconciliation telemetry endpoint for management operations (`GET /api/v1/ops/reconciliation-metrics`)
9. GitHub CI quality gate on push/PR for backend lint, typecheck, and test enforcement
10. PostgreSQL parity integration verification in CI using a dedicated postgres-backed test job
11. Management audit-log query/filter endpoint (`GET /api/v1/purchases/audit-logs`) for cross-purchase operations review
12. Management export endpoints for transaction and reconciliation reporting (`GET /api/v1/ops/exports/transactions`, `GET /api/v1/ops/exports/reconciliation`)
13. Meter-reading ingestion and aggregation endpoints with customer ownership checks (`POST /api/v1/meters/:meterId/readings`, `GET /api/v1/meters/:meterId/readings`, `GET /api/v1/meters/:meterId/readings/aggregates`)
14. Management meter analytics/reporting endpoints (`GET /api/v1/ops/meters/analytics/summary`, `GET /api/v1/ops/meters/analytics/top-consumers`)

UI work remains intentionally deferred while backend contracts and reliability controls are being completed.

## Backend Operations API Contracts (Current)

The following management-only endpoints are part of the active backend implementation and are used for operations visibility and recovery.

1. Retry pending credits

Request:

```http
POST /api/v1/purchases/retry-pending
Authorization: Bearer <management_jwt>
Content-Type: application/json

{
	"limit": 20
}
```

Response (200):

```json
{
	"attempted": 3,
	"credited": 2,
	"failed": 1,
	"failureReasons": {
		"provider_timeout": 1
	}
}
```

2. Reconcile failed purchases in batch

Request:

```http
POST /api/v1/purchases/reconcile-failed
Authorization: Bearer <management_jwt>
Content-Type: application/json

{
	"limit": 20
}
```

Response (200):

```json
{
	"attempted": 2,
	"reconciled": 1,
	"failed": 1
}
```

3. Reconciliation telemetry snapshot

Request:

```http
GET /api/v1/ops/reconciliation-metrics
Authorization: Bearer <management_jwt>
```

Response (200):

```json
{
	"pendingRetry": {
		"attempted": 5,
		"credited": 4,
		"failed": 1,
		"failureReasons": {
			"provider_timeout": 1
		}
	},
	"failedReconciliation": {
		"attempted": 3,
		"reconciled": 2,
		"failed": 1
	}
}
```

Contract rules:
- user-facing purchase success must only be shown when purchase state is `credited`.
- all provider credit operations must remain idempotent.
- every lifecycle transition must be audit-logged with correlation ID.

## API-First Scope
The MVP implementation is limited to API-backed capabilities:

1. Meter inventory and status
2. Meter readings and aggregates
3. Customer profile and balance visibility
4. Transaction and revenue reporting
5. Alert monitoring and handling
6. Customer self-service top-up automation using provider-supported transaction endpoints

## Out of Scope for MVP
- Multi-city / multi-location UX complexity
- Advanced infrastructure modules not needed for current reporting goals
- Forecast-heavy analytics dashboards beyond current business requirement
- Features that cannot be mapped directly to Steama endpoints

## System Architecture
High-level architecture:

1. Web Dashboard (SvelteKit) + Mobile App (Flutter)
2. Backend API (Node.js + Fastify)
3. Integration services (Steama API wrapper, sync workers, cache)
4. Data services (PostgreSQL + TimescaleDB + Redis)
5. On-prem edge (Traefik) + Cloudflare Tunnel

Core data flow:
- Client request -> MSM backend -> Steama API
- Steama response -> cache/update local store -> UI render
- Scheduled sync builds time-series and monthly report datasets

See full architecture details in [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md).

## Technology Stack
Web Platform:
- SvelteKit + TypeScript
- Custom Micro Access design language (sky blue, navy blue, white)
- Chart.js for reporting visuals

Mobile App:
- Flutter + Dart
- Riverpod for state management

Backend:
- Node.js + Fastify + TypeScript
- JWT-based authentication
- Steama API abstraction layer with rate-limit awareness

Data Layer:
- PostgreSQL (system of record)
- TimescaleDB (meter time-series)
- Redis (cache and queue broker)

Deployment:
- Docker Compose (on-prem)
- Traefik reverse proxy
- Cloudflare Tunnel for secure internet access

See deployment details in [TECH_STACK_ON_PREM.md](TECH_STACK_ON_PREM.md).

## Steama API Mapping

The table below reflects the authenticated API review. The complete contract is
in [docs/vendor/steama/API_CONTRACT.md](docs/vendor/steama/API_CONTRACT.md).

| MSM Capability | Primary Endpoint(s) | Purpose |
|---|---|---|
| Meter registry | `/meters/` | Fetch meter metadata and status |
| Utility readings | `/sites/{site_id}/utilities/{utility_id}/readings/`, customer equivalent | Cumulative register and interval usage data |
| Utility usage | `/sites/{site_id}/utilities/{utility_id}/usage/`, customer equivalent | Timestamped usage series |
| Electrical metrics | `/sites/{site_id}/metrics/{metric_code}/readings/`, `/totals/` | Voltage, current, power and related telemetry |
| Customer profile and balance | `/customers/`, `/customers/{id}/balances/` | Provider identity and financial state |
| Purchase records | `/customers/{id}/transactions/`, `/transactions/` | Unit purchase posting and transaction history |
| Provider reports | `/reports/` | Usage, uptime, failed-payment, anomaly and AMI reports |
| Alerts | `/alerts/` | Operational event monitoring |
| Online/active meter counts | `/stats/online-meters-counts/`, `/stats/active-meter-counts/` | Derived dashboard KPIs |

The legacy [STEAMA_API_CATEGORIZATION.md](STEAMA_API_CATEGORIZATION.md) is not
an implementation contract.

## Web Application Features
The web application is the management operating console.

MVP modules:

1. Operations Dashboard
- Source contribution overview (solar vs grid, generator when enabled)
- Online/offline meter counts
- Active alerts feed and acknowledgement workflow
- Data freshness and sync health indicators

2. Meter and Customer Operations
- Meter registry and status pages
- Customer registry with account balance and assigned meters
- Customer transaction history and filters
- Manual correction tools with audit trail

3. Billing and Reconciliation
- Monthly energy-by-source report
- Monthly spend and collections report
- Grid payable estimation and solar offset visibility
- Exportable reconciliation pack (CSV/PDF)

4. Reporting and Audit
- Time-windowed usage analytics (hour/day/month)
- Revenue and transaction trend reports
- Immutable change log for operational actions

Primary endpoint families:
- `/meters/`, `/sites/{id}/utilities/{utility_id}/readings/`
- `/customers/`, `/customers/{id}/balances/`, `/customers/{id}/transactions/`
- `/alerts/`, `/stats/`, `/reports/`

## Mobile Application Features
The mobile application is the customer self-service channel that removes agent-dependent top-ups.

MVP modules:

1. Account and Meter Visibility
- Current balance and low-balance warning state
- Assigned meter status (ON/OFF and last reading timestamp)
- Recent usage summary and trend chart

2. Buy Units Flow
- Select amount and payment method
- Payment confirmation screen
- Backend-triggered meter credit posting to provider API
- Real-time success/failure feedback and retry-safe confirmation

3. Transaction and Usage History
- Customer transaction list with filters
- Daily/weekly/monthly usage view
- Cost trend display using configured tariff assumptions

4. Notifications
- Payment success/failure notifications
- Low balance and operational service notices

Primary endpoint families:
- `/customers/{id}/`, `/customers/{id}/meters/`, `/customers/{id}/transactions/`
- `/customers/{id}/utilities/{utility_id}/readings/` and `/usage/`
- `/customers/{id}/messages/`, `/alerts/`

## Role and Access Model
MSM uses role-aware access in one platform with two UX surfaces.

1. Customer Role
- Access to own profile, own meters, own transactions, own notifications
- Cannot view other customers or management analytics

2. Management Role
- Access to site-wide operations, all customers, reconciliation, reports, and alerts
- Role-specific permissions for read/create/edit/report actions

Implementation rule:
- Clients authenticate only with MSM backend tokens.
- Only MSM backend manages Steama credentials/tokens and provider API calls.

## User-to-Meter Connection Model
This section defines how a user in MSM is connected to an assigned meter in the provider system.

1. Identity and Assignment Ownership
- MSM login identity is owned by MSM backend (not by provider login).
- SteamaCo assignments are synchronized evidence; MSM owns effective-dated
  billable assignment history after review/approval.
- MSM maintains explicit mappings among MSM identities, service accounts,
  provider customers and provider meters.

2. Required Mapping Records in MSM
- `msm_user_id`
- `provider_customer_id`
- `provider_meter_id` (or multiple meter IDs where applicable)
- `site_id`
- `status` (active/inactive)
- `last_synced_at`

3. Runtime Retrieval Flow
1. User logs into MSM app.
2. MSM backend validates MSM token and resolves `msm_user_id`.
3. MSM backend loads mapped `provider_customer_id` and meter assignments.
4. MSM backend calls provider APIs with service token:
	- customer profile and balance
	- assigned meters and meter status
	- customer transactions and usage readings
5. MSM backend returns scoped data for that user only.

4. Purchase Flow Binding
1. MSM creates a purchase and payment intent.
2. MSM validates the gateway callback and verifies capture server-to-server.
3. MSM posts the captured-money ledger journal.
4. MSM creates a separately tracked provider-credit attempt using the mapped
   customer:
	- `POST /customers/{id}/transactions/`
5. MSM stores the provider transaction and reconciles it without creating a
   second money receipt.
6. The customer sees payment and provider-credit status separately.

5. Synchronization Rules
- Initial bootstrap sync creates mapping from provider customer assignments.
- Periodic sync updates assignment drift (new meter, reassignment, archive).
- Any unmapped or ambiguous assignment is flagged for management resolution.

6. Edge Cases and Fallback Behavior
1. No mapped meter for a logged-in customer
- App shows a controlled "meter not linked" state.
- MSM blocks purchase attempts for that account.
- Management queue item is created for assignment resolution.

2. One customer mapped to multiple meters
- App defaults to primary meter when configured.
- If no primary is configured, app requires meter selection at purchase time.
- Usage and transaction views must remain meter-scoped and mergeable.

3. Meter reassigned on provider platform
- Sync job detects assignment drift and updates mapping tables.
- Existing sessions are revalidated against new mapping on next protected request.
- Access to old meter data is removed according to role and retention policy.

4. Payment success but provider credit post fails
- MSM marks transaction as `payment_confirmed_credit_pending`.
- Automated retry is allowed only after SteamaCo's idempotency mechanism is
  confirmed; ambiguous outcomes move to reconciliation.
- Customer is notified that payment is received but meter credit is pending.
- If retries exhaust, incident is escalated to operations with manual remediation path.

5. Provider credit succeeds but MSM callback/save fails
- Reconciliation worker re-pulls provider transactions and backfills missing local state.
- Duplicate posting protection prevents double-credit.

6. Rate limit or provider outage
- MSM queues non-critical sync calls and applies exponential backoff.
- Purchase calls use bounded retries only for proven idempotent operations.
- Management dashboard surfaces degraded-provider status in real time.

7. Purchase Lifecycle State Machine

The target lifecycle distinguishes initiated, awaiting payment, payment failed,
payment captured, ledger posted, credit pending, credit submitted, credited,
credit uncertain, credit rejected, reversal pending and reversed.

The complete transition rules and failure cases are defined in
[Billing, Payments and Reconciliation](docs/product/BILLING_AND_PAYMENTS.md).
The existing prototype state machine is not the production contract.

## Billing and Reconciliation Rules
Current phase rules for financial correctness:

1. Source Inclusion Rule
- Included now: solar and grid bulk metering
- Deferred: generator billing attribution until generator bulk meter is installed and validated

2. Customer Billing Rule
- Customer payment is verified and posted to the MSM ledger before a separate
  SteamaCo credit attempt is created.
- SteamaCo credit posting remains disabled until its payment payload and
  idempotency semantics are certified.

3. Monthly Reconciliation Rule
- Collections from customer transactions
- Grid payable estimate from measured grid contribution and tariff
- Solar contribution shown as offset/value contribution
- Generator excluded from customer charge calculations in this phase

4. Data Quality Rule
- Reconciliation uses interval deltas from meter readings
- Flag anomalous intervals and retain traceability for audit review

## Reporting Outputs
Primary reports for business operations:

1. Monthly Consumption Report
- kWh by meter
- kWh by customer/department
- bulk vs downstream summary

2. Monthly Spend Report
- amount paid by customer/department
- transaction count and trends
- revenue summary

3. Operational Status Report
- online/offline meters
- alert incidence summary
- sync latency and data freshness

## Repository Contents
Current workspace includes architecture and prototype assets:

- [README.md](README.md): project overview and execution guide
- [STEAMA_API_CATEGORIZATION.md](STEAMA_API_CATEGORIZATION.md): endpoint catalog and use-cases
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md): system design and data flows
- [TECH_STACK_FINAL.md](TECH_STACK_FINAL.md): finalized implementation stack
- [TECH_STACK_ON_PREM.md](TECH_STACK_ON_PREM.md): on-prem infrastructure and deployment
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md): consolidated delivery summary
- [microaccess-future-dashboard.html](microaccess-future-dashboard.html): branded web prototype
- [mobile-app-mockup.html](mobile-app-mockup.html): mobile flow prototype
- [management-dashboard.html](management-dashboard.html): earlier management dashboard prototype
- [cyberpunk-dashboard.html](cyberpunk-dashboard.html): alternative visual prototype
- [2026.07.01 0918 - meter-readings.csv](2026.07.01%200918%20-%20meter-readings.csv): sample readings data
- [2026.07.01 0920 - meter-readings.csv](2026.07.01%200920%20-%20meter-readings.csv): sample readings data

## Environment and Deployment

The current on-premise deployment runs as two PM2 applications:

1. `msm-backend` — compiled Fastify API on port `3000`;
2. `msm-web` — compiled SvelteKit operations console on port `4173`.

Both processes are defined in [`ecosystem.config.cjs`](ecosystem.config.cjs).
The web process calls the backend over loopback, while staff access the web
console over the server's Tailscale address. Build and safely reload only these
two MSM processes with:

```bash
./scripts/deploy-pm2.sh
```

The script installs locked dependencies, runs the backend build and web checks,
creates production builds, reloads the named MSM processes and saves the PM2
process list for host restarts. It does not restart unrelated PM2 applications.

Set `MSM_PUBLIC_ORIGIN` before deployment only when the external address changes.
The default is `http://100.112.217.3:4173`.

The live workspace includes dedicated Energy Mix, Revenue & Cost and Floor
Operations modules. Floor Operations interprets the provider first name as the
stable Na-Aka Hub floor/position label and the last name as the current tenant
snapshot. A local, effective-dated tenancy register lets management confirm the
actual occupant and start date without writing changes back to SteamaCo. Its
overview compares Ground Floor and Floors 1–5, while each floor has a separate
drill-down page for position, tenant history, meter, connectivity, interval
usage, provisional value and reading coverage. Usage before the first confirmed
tenant date remains explicitly unattributed, and a later provider-name change
is flagged for review rather than silently rewriting history. Unrecognized
names are kept in an explicit Unclassified group.

If PostgreSQL reports that authentication failed or that the dedicated `msm`
role does not exist, an administrator can create or align the local role and
database with the already configured, private `backend/.env` value without
displaying the password:

```bash
./scripts/configure-postgres-role.sh
```

This helper refuses non-local hosts and any role or database other than `msm`.
It creates only the missing local `msm` role/database, grants that role its
schema, and verifies application authentication. It requires the server
administrator's normal `sudo` confirmation. Application migrations remain
owned by the backend startup process.

Operational notes:
- Keep Steama credentials server-side only
- Keep `backend/.env` at mode `600`; it is excluded from Git
- Apply cache TTL strategy to respect Steama rate limits
- Run scheduled sync jobs for readings and monthly rollups
- Maintain regular encrypted backups

## Security and Compliance Baseline
- JWT authentication and role-based authorization
- Secure secret storage in environment/config vault
- HTTPS through Cloudflare edge and local TLS policy
- Input validation on all backend endpoints
- Rate limiting and retry controls for Steama API usage
- Audit trails for financial and operational actions

## Implementation Roadmap
Phase 1: Foundation
- Environment setup and service bootstrapping
- Steama API wrapper and auth integration
- Initial schema and data sync jobs

Phase 2: Core Operations
- Meter readings ingestion and monitoring views
- Monthly report generation pipelines
- Customer and department spend modules

Phase 3: Customer Experience
- Mobile balance and purchase flow
- Usage history and notifications

Phase 4: Hardening
- End-to-end testing
- Performance tuning
- Security hardening and release readiness

## Success Metrics
- Data freshness within scheduled sync windows
- Accurate month-end kWh and spend reports
- High purchase transaction success rate
- Stable dashboard response times under normal load
- Minimal manual reconciliation effort

## Contributing
Contribution workflow:

1. Create an issue describing change scope
2. Map proposed feature to existing API endpoint(s)
3. Implement in small testable increments
4. Update docs when behavior changes
5. Open PR with validation notes

PR acceptance checklist:
- API mapping included
- Security implications reviewed
- Reporting impact reviewed
- Documentation updated

## License
Internal project. Licensing to be defined by Micro Access.
