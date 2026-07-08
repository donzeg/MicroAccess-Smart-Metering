# MicroAccess Smart Metering (MSM)

MicroAccess Smart Metering (MSM) is an on-premise smart metering product for monitoring electricity usage, tracking purchases, and generating monthly reports from Steama-connected meters.

MSM is designed for the current deployment context (single plaza in Abuja with 3 bulk meters and prepaid downstream meters) while keeping the architecture reusable for future deployments such as estates and malls.

## Table of Contents
- [MicroAccess Smart Metering (MSM)](#microaccess-smart-metering-msm)
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

The product principle is strict: build only features that map to available Steama APIs.

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
4. Provider integration through backend-managed Steama token flow and canonical top-up endpoint (`POST /customers/{id}/transactions/`)
5. Callback security (HMAC signature verification, timestamp tolerance, replay protection)
6. Pending-credit retry worker with backoff and failure-reason aggregation
7. Inbound and outbound rate limiting with management telemetry endpoint (`GET /api/v1/ops/rate-limit-metrics`)

UI work remains intentionally deferred while backend contracts and reliability controls are being completed.

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
The table below describes key MSM capabilities and their Steama endpoint dependencies.

| MSM Capability | Primary Endpoint(s) | Purpose |
|---|---|---|
| Meter registry | `/meters/` | Fetch meter metadata and status |
| Meter readings | `/meter-metric-readings/` | Time-series usage data |
| Meter totals | `/meter-metric-totals/` | Aggregated consumption values |
| Customer profile and balance | `/customers/`, `/account-balances/` | Identity and financial state |
| Purchase records | `/customers/{id}/transactions/`, `/transactions/` | Unit purchase posting and transaction history |
| Revenue snapshots | `/revenue/` | Finance and reporting views |
| Alerts | `/alerts/` | Operational event monitoring |
| Online/active meter counts | `/online-meters-counts/`, `/active-meter-counts/` | Dashboard KPIs |

For full endpoint categorization, see [STEAMA_API_CATEGORIZATION.md](STEAMA_API_CATEGORIZATION.md).

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
- `/meters/`, `/meter-metric-readings/`, `/meter-metric-totals/`
- `/customers/`, `/account-balances/`, `/customers/{id}/transactions/`, `/transactions/`
- `/alerts/`, `/online-meters-counts/`, `/active-meter-counts/`, `/revenue/`

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
- `/meters/{id}/metrics/.../readings/`
- `/customer-messages/`, `/alerts/`

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
- Meter assignment source of truth remains provider-side customer-to-meter assignment.
- MSM maintains a local mapping between MSM user identity and provider customer identity.

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
1. MSM receives confirmed payment.
2. MSM backend posts credit transaction to provider using mapped customer:
	- `POST /customers/{id}/transactions/`
3. MSM stores provider transaction ID and updates local ledger state.
4. User sees final status only after provider write is confirmed or definitively failed.

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
- Automated retry with idempotency key is executed.
- Customer is notified that payment is received but meter credit is pending.
- If retries exhaust, incident is escalated to operations with manual remediation path.

5. Provider credit succeeds but MSM callback/save fails
- Reconciliation worker re-pulls provider transactions and backfills missing local state.
- Duplicate posting protection prevents double-credit.

6. Rate limit or provider outage
- MSM queues non-critical sync calls and applies exponential backoff.
- Purchase calls use bounded retries and deterministic final status messaging.
- Management dashboard surfaces degraded-provider status in real time.

7. Purchase Lifecycle State Machine

Canonical statuses:
- `initiated`: purchase request accepted by MSM backend, payment not yet confirmed.
- `payment_confirmed_credit_pending`: payment confirmed, provider credit post pending or retrying.
- `credited`: provider transaction successfully posted and reconciled to local ledger.
- `failed`: purchase cannot be completed automatically (validation, mapping, or provider failure after retries).
- `reconciled`: post-failure/manual resolution completed and ledger is consistent.

Allowed transitions:
1. `initiated` -> `payment_confirmed_credit_pending`
2. `payment_confirmed_credit_pending` -> `credited`
3. `payment_confirmed_credit_pending` -> `failed`
4. `failed` -> `reconciled`

Transition rules:
- Only MSM backend can mutate state.
- Provider credit posting must use idempotency keys.
- User-facing success is shown only on `credited`.
- `payment_confirmed_credit_pending` must trigger retries and customer-facing pending notice.
- Every transition is audit-logged with correlation ID.

8. Endpoint-to-State Transition Matrix

| Transition | MSM Backend Action | Provider API Call | Success Condition | Failure Handling |
|---|---|---|---|---|
| `initiated` -> `payment_confirmed_credit_pending` | Validate payment callback, persist purchase intent with correlation ID | None | Payment provider confirms funds | Mark purchase `failed` if payment is rejected/expired |
| `payment_confirmed_credit_pending` -> `credited` | Create provider credit request and persist external reference | `POST /customers/{id}/transactions/` | Provider returns successful transaction record | Retry with idempotency key until retry budget is exhausted |
| `payment_confirmed_credit_pending` -> `failed` | Finalize failure state, notify customer, open ops incident | Optional reconciliation read via `/customers/{id}/transactions/` or `/transactions/` | Retry budget exhausted or non-recoverable validation error | Escalate to manual remediation queue |
| `failed` -> `reconciled` | Run backfill/reconciliation job and close incident | `GET /customers/{id}/transactions/` and/or `GET /transactions/` | Missing local state recovered or manual correction completed | Keep `failed` and requeue reconciliation task |

Operational notes:
- User-visible purchase success is emitted only when state is `credited`.
- `payment_confirmed_credit_pending` is user-visible as "payment received, credit pending".
- Reconciliation jobs must be safe to rerun and must not double-credit customers.

## Billing and Reconciliation Rules
Current phase rules for financial correctness:

1. Source Inclusion Rule
- Included now: solar and grid bulk metering
- Deferred: generator billing attribution until generator bulk meter is installed and validated

2. Customer Billing Rule
- Customer purchase is posted through MSM backend to `/customers/{id}/transactions/`
- Transaction confirmation is persisted in MSM ledger before user confirmation

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
Target deployment model:

1. On-premise host server
2. Containerized services via Docker Compose
3. Cloudflare Tunnel for secure remote access
4. Reverse proxy routing with Traefik

Operational notes:
- Keep Steama credentials server-side only
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
