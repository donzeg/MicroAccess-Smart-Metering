# MicroAccess Smart Metering Project Review

## 1. Review disposition

The repository is useful as a prototype and discovery record, but it is not a
safe production baseline for billing or live meter control.

The approved direction is:

1. retain the existing code as prototype evidence;
2. use the authenticated SteamaCo contract as the provider baseline;
3. redesign the authoritative records and financial lifecycles;
4. build a read-only provider mirror first;
5. add money and command mutations only after their separate safety gates.

No application code was changed during this documentation review.

## 2. Review scope

Reviewed:

- all root Markdown documentation;
- backend source, routes, repositories, services and tests;
- sample meter-reading CSV files and HTML prototypes;
- dependency audit and backend quality gates;
- authenticated SteamaCo API release `v4.40.0`;
- current provider account inventory in aggregate, without recording personal
  values.

## 3. Severity-ranked implementation findings

### P0 — Live provider credit payload does not match the API

`backend/src/services/providerClient.ts` submits `amount`,
`payment_method=mobile_money` and `description`.

The live SteamaCo transaction schema instead requires `category` and exposes
fields such as reference, payment provider, reverses, meter number and STS token
information. It does not advertise `payment_method` or `description`.

Impact: enabling the live connector is likely to reject every credit request.

Disposition: production provider mutation is prohibited until the vendor
contract and sandbox tests pass.

### P0 — Provider credit can be attempted without verified payment

`PurchaseService.creditViaProvider` automatically moves an `initiated`
purchase to payment-confirmed/credit-pending before calling the provider.

Impact: a caller reaching the credit operation can bypass the intended payment
evidence boundary.

Disposition: the replacement lifecycle requires independently verified gateway
capture and ledger posting before a provider-credit attempt.

### P0 — A later failed callback can corrupt a successful state

`PurchaseService.processPaymentCallback` transitions a purchase to `failed` on
a failed callback without protecting an already credited economic outcome.

Impact: late or reordered callbacks can contradict money and provider-credit
facts.

Disposition: callbacks become immutable events; state projection applies
allowed transitions and cannot silently downgrade a completed effect.

### P0 — Meter analytics sum cumulative registers

`MeterReadingService` sums `readingKwh` values to produce `sumKwh` and
`totalKwh`.

A runtime review example with cumulative readings 100 and 105 returned 205
instead of 5.

Impact: consumption, top-consumer, cost and billing analytics are wrong for
cumulative registers.

Disposition: use validated interval usage or end-minus-start register deltas as
defined in the new billing design.

### P1 — Missing production configuration silently selects prototype behavior

`backend/src/config/env.ts` supplies default application credentials, JWT
secret and callback secret.

`backend/src/app.ts` silently selects:

- in-memory repositories when PostgreSQL configuration is absent;
- a fake in-memory credit provider when SteamaCo configuration is absent.

Impact: a misconfigured deployment can appear operational while losing data or
simulating provider success.

Disposition: production startup must fail closed when required secrets,
database or provider mode are missing.

### P1 — Reconciliation does not reconcile

`PurchaseService.reconcile` changes any failed purchase to `reconciled` without
querying SteamaCo, the payment gateway, settlement evidence or the ledger.

Impact: the status can assert financial consistency without proof.

Disposition: reconciliation becomes a comparison run with matches, exceptions,
evidence and approved resolution.

### P1 — Purchase state and audit are not atomic

The purchase repository persists purchase state/transitions in one database
transaction. The audit repository writes separately after the state update.

Impact: a failure between writes can leave a financial state change without its
audit record, or vice versa.

Disposition: lifecycle write, ledger effect, audit and outbox record must share
one transaction.

### P1 — Meter readings are process memory

The current `MeterReadingService` stores and seeds readings in memory.

Impact: data is lost on restart and cannot serve as billing evidence.

Disposition: raw provider payloads, readings, usage intervals and corrections
must be durable and versioned.

### P1 — Current tenant is not billing-ready

The authenticated snapshot found:

- 31 meters, of which only 5 were customer-assigned;
- 27 meters marked never online;
- 33 customers, 28 without an observed meter assignment;
- current utility readings from only two meters;
- 976 provider transactions, all usage charges and no payments;
- mostly blank payment-plan/tariff-class fields.

Disposition: assignment, commissioning, coverage and tariff remediation are
Phase 0/1 release gates.

### P2 — Provider client lacks live contract tests

Tests exercise the in-memory provider and application lifecycle, but no test
validates the SteamaCo request body or response against a captured schema or
sandbox.

Disposition: add versioned contract fixtures and sandbox tests before enabling
provider writes.

### P2 — Dependency findings require remediation

The review observed:

- four high-severity production-tree dependency findings;
- fifteen findings across production and development dependencies;
- two critical findings in the development tree.

Disposition: update and retest dependencies before a release baseline is
declared.

## 4. Documentation findings

### 4.1 API categorisation

The legacy categorisation:

- used stale root paths;
- omitted live resources including directives v2 and reports;
- represented nested resources as root resources;
- assumed write operations that the live routes do not advertise;
- did not record auth scope, pagination, errors, units, idempotency, retention
  or version evidence.

It is retained only as historical product ideation.

### 4.2 Technical architecture

The legacy architecture mixed target concepts with implementation claims. It
did not establish:

- separate payment and provider-credit facts;
- effective tariff versions;
- immutable financial ledger;
- meter assignment history;
- raw-versus-normalized reading records;
- governed correction/reconciliation.

It also included deployment and database examples that were not validated
against the repository.

### 4.3 Technology and on-premise documents

The documents labelled technology decisions “final” while retaining unresolved
alternatives and missing deployable artifacts.

The on-premise proposal included inconsistent ports/environment names and
unsafe exposure examples for database, cache, dashboards or administration.
It is not a production runbook.

### 4.4 Project summary and readiness claims

The project summary mixed completed, planned and conceptual capabilities.
Passing builds and focused tests were presented too close to production
readiness despite missing live-provider, database, browser and finance
acceptance.

The replacement delivery plan defines evidence gates for each claim.

### 4.5 Prototypes and samples

HTML/mobile prototypes are design inputs only. They contain hard-coded data and
must not be treated as functional product evidence.

The sample solar/grid CSV analysis also showed that:

- the source files did not cover identical periods;
- the solar sample included anomaly/delta inconsistencies;
- exact timestamp matching could misalign grid and solar rows;
- applying a current tariff to historical/lifetime totals was unsafe.

These observations informed the new data-quality and tariff requirements.

## 5. Quality-gate evidence

At the reviewed repository state:

- lint passed;
- TypeScript checking passed;
- build passed;
- 27 automated tests passed;
- one PostgreSQL parity test was skipped because no test database was supplied.

These results prove the tested prototype behavior only. They do not certify the
business correctness issues listed above.

## 6. Documentation remediation completed

The redesign adds:

- a versioned live SteamaCo API contract;
- a resource/capability decision matrix;
- product requirements with 87 unique requirement IDs;
- an authoritative domain model;
- separate billing, payment and reconciliation lifecycles;
- target integration, security and deployment architecture;
- a phase-and-gate delivery plan.

Legacy documents now carry supersession warnings. The root README points to the
new authority set and no longer presents stale root API paths as verified.

## 7. Production blockers

Production billing remains blocked until:

1. current P0/P1 implementation findings are remediated;
2. vendor financial/idempotency semantics are confirmed;
3. a sandbox mutation path passes;
4. assignments, connectivity and reading coverage are ready;
5. tariffs and finance policies are approved;
6. durable meter data, ledger and reconciliation are implemented;
7. access, browser/device, backup and recovery gates pass.
