# MicroAccess Smart Metering Product Requirements

## 1. Status

This is the target product specification for the MSM redesign. It replaces the
earlier feature lists as the source of truth for intended behavior. It does not
claim that the described capabilities are already implemented.

## 2. Product objective

MSM will operate electricity metering and customer billing for the current
Abuja site while remaining reusable for future malls, estates and commercial
properties.

The product must:

1. establish a trustworthy meter/customer inventory;
2. ingest and validate SteamaCo readings;
3. calculate transparent, reproducible charges;
4. manage prepaid credit and postpaid bills without mixing their lifecycles;
5. reconcile money, provider credit and energy;
6. give operations and finance teams a controlled working system;
7. give customers access only to their own meters, usage, bills and payments.

## 3. Product principles

- Billing must be reproducible from immutable source records and effective
  tariff versions.
- Captured money, provider credit and customer ledger state are separate facts.
- Cumulative readings are never summed as consumption.
- Anomalous or corrected readings remain traceable.
- Customer billing and bulk-source energy reconciliation are separate domains.
- Provider data is mirrored; provider credentials never reach browsers or
  mobile applications.
- Financial and unsafe meter actions require explicit authorization and audit.
- No screen or workflow may depend on an unverified upstream endpoint.

## 4. Initial operating context

| Item | Initial condition |
|---|---|
| Geography | Na-Aka Hub, one Abuja plaza |
| Provider | SteamaCo |
| Currency | NGN |
| Meter estate | Approximately 31 observed meters |
| Customer estate | 33 observed provider customers |
| Supply sources | Grid and solar initially; generator attribution later |
| Billing channels | Management-assisted operations first; customer self-service later |
| Deployment | On-premise application with controlled internet exposure |

Multi-site and multi-tenant support must be represented in the data model, but
must not make the first-release user experience unnecessarily complex.

## 5. Actors

| Actor | Responsibilities |
|---|---|
| System administrator | Integration, security, tenant and role configuration |
| Metering operator | Meter inventory, assignments, health, readings and incidents |
| Billing officer | Tariffs, billing runs, adjustments and bill review |
| Finance officer | Payments, refunds, settlement and reconciliation |
| Approver | High-risk adjustment, tariff, refund and command authorization |
| Support officer | Customer account investigation and communication |
| Auditor | Read-only access to evidence, ledger and change history |
| Customer | Own usage, balance, bills, payments, receipts and notifications |
| Automated worker | Synchronization, billing, retry, reconciliation and notifications |

Provider service accounts and payment-gateway credentials are system
identities, not human actors.

## 6. Functional requirements

### 6.1 Organisation and access

- `ORG-001` MSM shall support tenant, site and utility records.
- `ORG-002` MSM shall map upstream provider identifiers without using them as
  internal primary keys.
- `ORG-003` MSM shall support role-based permissions with site scope.
- `ORG-004` MSM shall keep employee, customer and service identities separate.
- `ORG-005` MSM shall require stronger approval for financial adjustments,
  tariff publication, refunds and unsafe meter commands.
- `ORG-006` MSM shall record successful and denied sensitive actions.

### 6.2 Customer and service accounts

- `CUS-001` MSM shall maintain a customer profile linked to zero or more
  effective service accounts.
- `CUS-002` A service account shall define the bill-to relationship, billing
  mode, currency and lifecycle state.
- `CUS-003` Provider customer records shall be mirrored without overwriting MSM
  identity, consent or access records.
- `CUS-004` Customer access shall be granted through an explicit, auditable
  mapping to a service account.
- `CUS-005` Archived customers shall remain available for historical reporting.
- `CUS-006` MSM shall represent each floor and metered shop, office or common
  area as a stable premises position independent of the current tenant name.
- `CUS-007` Tenant occupancy and financial account-holder assignments shall be
  effective-dated so that a tenant change does not rewrite historical usage,
  bills, payments or meter assignments.
- `CUS-008` SteamaCo customer first-name and last-name fields may be imported as
  position and tenant labels, but shall not be used as durable internal keys.

### 6.3 Meter lifecycle and assignments

- `MTR-001` MSM shall mirror provider meter identity, hardware and live status.
- `MTR-002` MSM shall track installation, commissioning, activation,
  suspension, replacement and retirement.
- `MTR-003` Meter-to-service-account assignments shall be effective-dated.
- `MTR-004` A meter shall have at most one current billable assignment.
- `MTR-005` Reassignment shall not rewrite historical consumption or bills.
- `MTR-006` Parent, source, feeder and downstream relationships shall be
  represented independently from customer assignment.
- `MTR-007` Unassigned, never-online, stale and anomalous meters shall be
  visible as readiness exceptions.

### 6.4 Reading ingestion and data quality

- `RDG-001` MSM shall retain an immutable representation of each provider
  reading and its upstream identity.
- `RDG-002` Ingestion shall be idempotent.
- `RDG-003` MSM shall store utility, unit, timezone, provider timestamp and
  receipt timestamp.
- `RDG-004` Consumption shall be calculated from validated register deltas or
  a provider interval value whose semantics are certified.
- `RDG-005` MSM shall detect duplicates, gaps, register decreases, resets,
  negative usage, implausible spikes and late corrections.
- `RDG-006` An anomalous reading shall not silently enter a final bill.
- `RDG-007` Corrected data shall create a new version and preserve the original.
- `RDG-008` Each billing period shall expose coverage and quality status.
- `RDG-009` Historical backfill shall use a resumable cursor or governed report
  import with provenance.

### 6.5 Tariffs

- `TRF-001` Tariffs shall be immutable once published.
- `TRF-002` A tariff version shall have currency, unit, effective interval,
  rounding policy and component definitions.
- `TRF-003` Components may include energy rate, time-of-use rate, tier,
  subscription, connection, tax, discount and approved adjustment.
- `TRF-004` Tariff assignment shall be effective-dated by service account or
  approved group.
- `TRF-005` Historical bills shall use the tariff effective during the
  consumption interval.
- `TRF-006` Tariff publication shall require review and approval.
- `TRF-007` Provider tariff fields shall be synchronized as evidence but shall
  not replace MSM tariff versioning.

### 6.6 Billing

- `BIL-001` MSM shall support prepaid and postpaid service accounts through
  separate lifecycle rules.
- `BIL-002` A billing run shall have draft, validating, review, approved,
  posted, failed and superseded states.
- `BIL-003` Bills shall contain explicit source intervals, tariff components,
  adjustments, taxes and rounding.
- `BIL-004` Re-running a billing period with the same inputs shall produce the
  same result.
- `BIL-005` Posted bills shall not be edited; corrections shall use adjustments
  or superseding bills.
- `BIL-006` Estimated bills shall be clearly marked with reason and approval.
- `BIL-007` No bill shall post when mandatory reading-quality gates fail unless
  an authorized exception is recorded.
- `BIL-008` Bills and statements shall be exportable with stable identifiers.

### 6.7 Payments and prepaid credit

- `PAY-001` MSM shall create a payment intent before redirecting or instructing
  a payment channel.
- `PAY-002` Gateway callbacks shall be signature-verified, replay-protected and
  stored once.
- `PAY-003` Gateway status shall be verified server-to-server before money is
  marked captured.
- `PAY-004` A captured payment shall post balanced immutable ledger entries.
- `PAY-005` Provider credit shall be a separate, retryable step.
- `PAY-006` Each provider-credit attempt shall use a stable MSM reference and a
  vendor-confirmed idempotency mechanism.
- `PAY-007` A customer shall never be credited twice for one captured payment.
- `PAY-008` A failed provider credit shall remain visible as money captured,
  credit pending; it shall not be reported as a failed payment.
- `PAY-009` Refunds and reversals shall use explicit linked records.
- `PAY-010` Receipts shall distinguish money received from electricity credit
  applied.

### 6.8 Ledger and reconciliation

- `LED-001` MSM shall maintain an append-only double-entry financial ledger.
- `LED-002` Provider transactions shall be mirrored separately from MSM ledger
  entries.
- `LED-003` Reconciliation shall compare payment gateway, bank/settlement,
  MSM ledger and SteamaCo transaction facts.
- `LED-004` Mismatches shall create owned exceptions with evidence and status.
- `LED-005` Reconciliation shall be safe to rerun.
- `LED-006` Manual resolution shall require a reason, evidence and approver.
- `LED-007` Daily and period-close summaries shall expose unmatched money and
  unmatched provider credit.

### 6.9 Energy and source reconciliation

- `ENR-001` MSM shall distinguish source/bulk meters from customer meters.
- `ENR-002` Source contribution shall use aligned time windows and units.
- `ENR-003` MSM shall compare grid, solar and later generator inflow with
  downstream billed and unbilled consumption.
- `ENR-004` Technical loss, commercial loss and unmetered load shall not be
  conflated.
- `ENR-005` Source reconciliation shall not create or alter customer charges
  unless an approved tariff rule explicitly requires it.

### 6.10 Operations, alerts and directives

- `OPS-001` MSM shall show freshness, connectivity, relay state and data
  quality separately.
- `OPS-002` Provider alerts and DLMS events shall be mirrored with raw codes.
- `OPS-003` MSM shall support local ownership, acknowledgement and resolution
  without overwriting provider history.
- `OPS-004` Unsafe directives shall remain disabled until the vendor contract
  is confirmed.
- `OPS-005` When enabled, unsafe directives shall require reason, authorization,
  optional dual approval, provider acceptance and device outcome.
- `OPS-006` A timeout shall be unknown/pending, not success.
- `OPS-007` Every directive shall be traceable from request through outcome.

### 6.11 Communications

- `COM-001` MSM shall manage approved templates, channels and consent.
- `COM-002` Billing, payment and outage notices shall reference authoritative
  records.
- `COM-003` Notification delivery shall not determine financial state.
- `COM-004` Failed delivery shall be retryable and observable.
- `COM-005` Customer contact data shall not be included in operational logs.

### 6.12 Reporting

- `RPT-001` Management reports shall include data freshness and scope.
- `RPT-002` Finance reports shall reconcile to ledger totals.
- `RPT-003` Usage reports shall expose unit, timezone, period and quality.
- `RPT-004` Exports shall be reproducible and checksum-addressable.
- `RPT-005` Provider reports shall be retained with request parameters,
  upstream version and retrieval status.
- `RPT-006` Dashboard aggregates shall link back to supporting records.
- `RPT-007` Site energy and revenue views shall support drill-down from Na-Aka
  Hub to floor, premises position, current tenant and historical occupancy.

### 6.13 Customer experience

- `CXP-001` Customers shall see only their assigned service accounts and meters.
- `CXP-002` Customers shall see usage, balance, bills and payment status with
  freshness indicators.
- `CXP-003` The purchase flow shall show pending provider credit separately
  from successful payment.
- `CXP-004` Customers shall download bills and receipts.
- `CXP-005` Customers shall submit support queries against a specific bill,
  payment or meter without receiving privileged provider data.

## 7. Non-functional requirements

### 7.1 Security

- Secrets shall be stored outside source control and rotated.
- Provider access shall be server-side and least-privileged.
- Sensitive records shall be encrypted in transit and at rest.
- Logs shall redact credentials, tokens, personal information and raw payment
  payloads.
- High-risk endpoints shall have rate limits and step-up authorization.

### 7.2 Reliability

- Integration jobs shall use bounded retries with backoff and jitter.
- Jobs shall resume from durable checkpoints.
- Financial writes shall be transactional and use an outbox for side effects.
- Provider outages shall not corrupt local billing or ledger state.
- Backups and restoration shall be regularly tested.

### 7.3 Audit

- Every financial, tariff, assignment and unsafe-command change shall identify
  actor, time, reason, before/after state and correlation ID.
- Audit records shall be append-only for application users.
- Export and approval events shall be auditable.

### 7.4 Performance

Performance targets shall be measured after the first real ingestion baseline.
The product must define separate service levels for:

- interactive cached views;
- provider-backed refresh;
- report generation;
- billing runs;
- reconciliation jobs.

No latency target is certified until it is tested with the expected meter,
reading and transaction volume.

## 8. First-release exclusions

Unless separately approved, the first production release excludes:

- agent commission management;
- multi-currency settlement;
- automated remote disconnect/reconnect;
- provider tariff/configuration writes;
- forecasting-driven billing;
- generator cost attribution before generator metering is commissioned;
- customer-to-customer credit transfer;
- replacing the provider meter head-end system.

## 9. Release acceptance

A capability is releasable only when:

1. requirements and authority are approved;
2. upstream contract and error behavior are captured;
3. tenant and permission scope are tested;
4. happy path, failure, retry and reconciliation tests pass;
5. security and audit evidence is captured;
6. representative real records pass end-to-end verification;
7. operations has a runbook and rollback path;
8. finance approves all money-affecting behavior.
