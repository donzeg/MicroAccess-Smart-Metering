# MicroAccess Smart Metering Delivery Plan

## 1. Delivery rule

MSM will advance through evidence gates, not calendar claims. A phase is
complete only when its exit evidence is captured. Work may be prototyped ahead,
but it is not production-ready until its governing gate passes.

## 2. Workstreams

| Workstream | Scope |
|---|---|
| Vendor Contract | SteamaCo and payment-provider schemas, sandbox and change control |
| Data Readiness | Inventory, assignments, connectivity, backfill and quality |
| Product and UX | Management and customer workflows |
| Billing and Finance | Tariffs, bills, ledger, payments and reconciliation |
| Operations | Alerts, incidents, commissioning and directives |
| Platform | Identity, deployment, security, observability, backups and CI |

## 3. Phase 0 — Contract and operational readiness

### Objectives

- Approve product boundaries and authority.
- Resolve blocking vendor questions.
- Prepare a safe sandbox/test scope.
- Remediate the current inventory enough for representative tests.

### Deliverables

- approved API contract and capability matrix;
- vendor response register;
- sandbox credentials and test customer/meter;
- data-processing/security assessment;
- meter/customer assignment remediation plan;
- connectivity/commissioning exception list;
- architecture decisions for identity, payment and deployment;
- acceptance-test catalogue.

Working controls for this phase are maintained in the
[Phase 0 Readiness Tracker](../governance/PHASE_0_READINESS_TRACKER.md),
[Meter Estate Readiness Pack](../readiness/README.md) and
[Billing Policy Decision Pack](BILLING_POLICY_DECISION_PACK.md). Vendor contact
is currently held pending an internal call; the tracker identifies which work
can continue independently.

### Exit gate

- SteamaCo confirms payment/idempotency, readings/backfill, reports, webhooks
  and directive contracts.
- A non-production mutation path exists.
- Representative source, downstream and customer meters are online.
- Named business owners approve prepaid/postpaid and tariff policies.

No real payment or remote command work proceeds before this gate.

## 4. Phase 1 — Identity, mappings and read-only provider mirror

### Objectives

- Establish the authoritative organisation and access model.
- Mirror provider structure without financial or device mutations.

### Deliverables

- tenant/site/utility model;
- staff and service identities with scoped roles;
- provider account/site/customer/meter mappings;
- effective-dated meter assignments;
- typed SteamaCo adapter;
- customer, meter and reference-data synchronization;
- integration attempt, audit and outbox foundation;
- management inventory/readiness screens.

The detailed boundary, work packages and acceptance tests are defined in the
[Phase 1 Read-Only Integration Scope](PHASE_1_READ_ONLY_SCOPE.md).

### Exit gate

- Repeated sync is idempotent.
- Provider changes are detected and audited.
- Customer access cannot cross service-account/site boundaries.
- All billable pilot meters have approved current assignments.
- No credentials or personal data appear in client code or logs.

## 5. Phase 2 — Meter data and quality

### Objectives

- Build reliable current and historical consumption records.

### Deliverables

- raw provider payload/snapshot retention;
- utility and metric ingestion;
- deduplication and resumable watermarks;
- governed AMI report backfill;
- normalized usage intervals;
- anomaly, reset, gap and correction handling;
- freshness/coverage dashboards;
- source-meter topology.

### Exit gate

- Register delta and provider usage comparisons pass on representative meters.
- Required historical period is complete or gaps are documented.
- Unit/timezone precision is tested.
- Corrections preserve original evidence.
- Billing eligibility can be computed per service account and period.

## 6. Phase 3 — Tariffs, ledger and shadow billing

### Objectives

- Produce reproducible bills without affecting customers or provider balances.

### Deliverables

- tariff plan/version/component model;
- approval and effective assignment workflow;
- deterministic billing engine;
- billing run and exception workflow;
- double-entry ledger;
- bills, lines, adjustments and statements;
- source-energy reconciliation;
- shadow-period comparison reports.

### Exit gate

- Same inputs reproduce identical results.
- Every bill line traces to readings and tariff version.
- Ledger journals balance.
- Finance signs off shadow bills against independently checked samples.
- Source reconciliation uses aligned periods and discloses residuals.

## 7. Phase 4 — Payments and provider credit in sandbox

### Objectives

- Prove the full money-to-credit lifecycle safely.

### Deliverables

- selected payment-gateway adapter;
- payment intent, callback, verification and settlement records;
- prepaid purchase orchestration;
- provider-credit attempt model;
- confirmed SteamaCo transaction payload;
- idempotency and ambiguous-timeout handling;
- refund and provider-reversal workflows;
- finance reconciliation and exception queues.

### Required scenarios

- successful payment and credit;
- duplicate and out-of-order callback;
- failed payment;
- capture with provider unavailable;
- provider timeout after commit;
- validation rejection;
- duplicate credit attempt;
- reversal and refund;
- settlement mismatch.

### Exit gate

- No scenario can double-credit.
- Captured money remains visible when credit is pending/failed.
- Gateway, MSM ledger and SteamaCo reconcile.
- Finance and security approve the evidence.

## 8. Phase 5 — Management operations release

### Objectives

- Give authorised staff a complete operating workspace.

### Deliverables

- operations dashboard with freshness and scope;
- customer/service account and meter workspaces;
- assignment and commissioning workflow;
- billing review, posting and adjustments;
- payment/credit/reconciliation work queues;
- alerts, DLMS events and incident workflow;
- governed reports and exports;
- runbooks and support procedures.

### Exit gate

- Role/site restrictions pass API and browser tests.
- Real pilot records complete daily operations.
- Finance totals reconcile.
- Restore, monitoring and incident drills pass.
- Operations accepts the runbooks.

## 9. Phase 6 — Customer self-service

### Objectives

- Provide safe access to usage, bills and payments.

### Deliverables

- customer login and access grants;
- balance, usage and freshness views;
- bills, statements and receipts;
- prepaid purchase flow;
- payment/credit progress;
- notifications and support references.

### Exit gate

- Customers cannot access other accounts/meters.
- Payment and credit states remain accurate under refresh/retry.
- Customer-visible totals reconcile with bills/ledger.
- Accessibility, mobile and real-device/browser tests pass.

## 10. Phase 7 — Controlled directives

### Objectives

- Enable only approved remote operations after vendor certification.

### Deliverables

- typed directive contract;
- request/approval/submission/outcome lifecycle;
- dual approval for configured commands;
- device confirmation and timeout reconciliation;
- emergency suspension and audit;
- operations training.

### Exit gate

- Vendor sandbox/device tests pass.
- Permission and approval bypass tests fail safely.
- Timeout never displays as success.
- Rollback/manual-response procedures are proven.

## 11. Cross-phase quality gates

Every phase requires:

- requirements traceability;
- schema migrations and rollback;
- automated unit, integration and contract tests;
- access-control tests;
- data migration/reconciliation evidence;
- observability and runbook updates;
- security review proportional to risk;
- documented unfinished work.

Build success alone is not certification. Mock-provider tests support
development but do not prove live-provider behavior.

## 12. Immediate backlog

### Vendor and policy

1. Send the vendor confirmation register.
2. Obtain sandbox and rate-limit/change-policy details.
3. Select payment gateway and obtain webhook/settlement contracts.
4. Approve prepaid/postpaid and tariff policies.

### Data readiness

1. Resolve 26 unassigned meters.
2. Investigate 27 meters marked never online.
3. Identify the two meters currently producing utility readings.
4. Confirm grid, solar and future generator bulk-meter roles.
5. Backfill a representative billing period.

### Engineering

1. Disable live provider mutation in the current prototype.
2. Replace the speculative SteamaCo transaction body after vendor confirmation.
3. Build a read-only versioned adapter and contract-test harness.
4. Establish tenant/site/customer/meter mappings.
5. Implement raw reading and quality records before billing endpoints.
6. Implement the ledger before customer payment release.

## 13. Definition of done

A feature is done only when:

- approved requirement and owner exist;
- code and migration are reviewed;
- tests cover success, denial, failure and retry;
- real integration evidence exists where applicable;
- permissions and tenant/site scope pass;
- logs and metrics are safe and actionable;
- runbook and recovery behavior exist;
- documentation matches deployed behavior;
- no unresolved critical reconciliation or security issue remains.

## 14. Deferred decisions

The following need explicit decisions rather than assumptions:

- customer payment gateway;
- whether the first release is prepaid-only or mixed;
- tariff/tax/rounding policy;
- estimated billing policy;
- customer notification channels and consent;
- financial chart of accounts;
- command approval thresholds;
- data retention and recovery objectives;
- generator commissioning and allocation.
