# MicroAccess Smart Metering (MSM)

MicroAccess Smart Metering (MSM) is an on-premise smart metering product for monitoring electricity usage, tracking purchases, and generating monthly reports from Steama-connected meters.

MSM is designed for the current deployment context (single plaza in Abuja with 3 bulk meters and prepaid downstream meters) while keeping the architecture reusable for future deployments such as estates and malls.

## Table of Contents
- [Product Overview](#product-overview)
- [Current Business Context](#current-business-context)
- [Objectives](#objectives)
- [API-First Scope](#api-first-scope)
- [Out of Scope for MVP](#out-of-scope-for-mvp)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Steama API Mapping](#steama-api-mapping)
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

This context informs the initial UI and reporting scope, but MSM keeps the data model tenant-ready for future multi-site expansion.

## Objectives
1. Provide accurate meter readings ingestion and visibility
2. Generate monthly consumption reports in kWh
3. Generate monthly spend reports by customer/department
4. Support prepaid unit purchase tracking end-to-end
5. Avoid non-essential features not supported by integration APIs

## API-First Scope
The MVP implementation is limited to API-backed capabilities:

1. Meter inventory and status
2. Meter readings and aggregates
3. Customer profile and balance visibility
4. Transaction and revenue reporting
5. Alert monitoring and handling

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
| Purchase records | `/customer-transactions/`, `/transactions/` | Unit purchase and transaction history |
| Revenue snapshots | `/revenue/` | Finance and reporting views |
| Alerts | `/alerts/` | Operational event monitoring |
| Online/active meter counts | `/online-meters-counts/`, `/active-meter-counts/` | Dashboard KPIs |

For full endpoint categorization, see [STEAMA_API_CATEGORIZATION.md](STEAMA_API_CATEGORIZATION.md).

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
