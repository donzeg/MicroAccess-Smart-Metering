# Phase 1 Read-Only Integration Scope

## Implementation checkpoint — 26 October 2026

| Capability | Status | Evidence |
|---|---|---|
| Default read-only operating mode | Implemented and automated-test verified | Legacy purchase, credit, callback and manual-reading routes are absent in Phase 1 mode |
| Fail-closed runtime configuration | Implemented and automated-test verified | Phase 1 requires PostgreSQL outside tests; production rejects placeholders and prototype mode |
| Phase 1 PostgreSQL schema foundation | Implemented and isolated-database verified | Production-style Phase 1 startup applies only migration `0002_phase1_read_only_foundation`, defining integration, mapping, estate, exception, audit and outbox records |
| SteamaCo read-only transport | Implemented with contract fixtures | Public request interface permits only GET, HEAD and OPTIONS; token refresh and sanitized errors are tested |
| Provider synchronization jobs and repositories | Not started | R3-R7 implementation remains |
| Staff identity provider and scoped roles | Not started | Current static management login is transitional and not Phase 1 acceptance evidence |
| Operations screens and controlled export | Not started | R8 remains |
| Live pilot acceptance | Not started | Requires controlled meter cleanup and named owners |

This checkpoint is an engineering foundation, not completion of Phase 1.

## 1. Outcome

Phase 1 will deliver a secure internal operations foundation that mirrors
SteamaCo customer and meter information without changing provider data,
crediting accounts, posting bills or sending meter commands.

At completion, authorized staff will be able to answer:

- What provider sites, customers and meters exist?
- Which physical meter and service account does each record represent?
- Which records are unassigned, stale, offline or never online?
- When was each record last synchronized and from which provider release?
- Did a provider change create an assignment or readiness exception?

## 2. In scope

### 2.1 Platform foundation

- production-safe configuration validation;
- PostgreSQL as the required durable store outside automated tests;
- server-side SteamaCo authentication;
- secret redaction and credential rotation support;
- staff identities, roles and site scope;
- immutable audit events for sensitive reads and configuration changes;
- integration-run, attempt, cursor and error records;
- transactional outbox foundation for later side effects.

### 2.2 Provider mirror

Read-only synchronization of:

- account and permission scope;
- projects, sites and utilities;
- provider customers and relevant billing-configuration evidence;
- meters, manufacturers and OEM references;
- customer-to-meter relationships observed from both sides;
- tags needed for classification;
- current status, connectivity and installation metadata;
- provider transactions as a separate read-only mirror for investigation.

Transactions are mirrored as provider facts. They do not post to the MSM
ledger during this phase.

### 2.3 Internal records

- tenant and site;
- customer identity reference with protected contact data;
- service account;
- provider mappings;
- physical meter and installation reference;
- effective-dated meter assignment;
- topology/source classification;
- readiness exception and ownership;
- synchronization and audit evidence.

### 2.4 Operations experience

- estate summary with freshness timestamp;
- customer and service-account search;
- meter inventory and detail;
- assignment review workspace;
- connectivity/readiness exception queue;
- provider-sync run and error history;
- controlled CSV export without unnecessary personal information.

## 3. Explicitly out of scope

The following remain disabled:

- provider customer, meter or assignment writes;
- provider payment or credit creation;
- payment-gateway capture;
- bills, financial ledger postings and balance mutation;
- refunds, reversals and customer-to-customer transfers;
- remote directives, relay actions or other device commands;
- customer self-service access;
- automated messages;
- use of current-window reads as a substitute for certified historical
  backfill;
- final energy-loss or billing calculations.

## 4. Authority boundaries

| Record or fact | Authority in Phase 1 |
|---|---|
| Provider customer, meter and status snapshot | SteamaCo, mirrored in MSM |
| Physical meter identity and location | Approved MicroAccess estate evidence |
| Service account | MSM |
| Effective assignment used for future billing | MSM, approved by operations and billing |
| Provider transaction | SteamaCo mirror only |
| Staff identity, role and site scope | MSM identity/access system |
| Sync time, result and error | MSM |
| Live money, bill or customer balance | Not created in Phase 1 |

## 5. Synchronization design

### 5.1 Job sequence

1. authenticate using the server-side service identity;
2. capture provider release/account scope without recording credentials;
3. synchronize reference data and hierarchy;
4. synchronize customers;
5. synchronize meters;
6. compare relationship observations;
7. synchronize relevant transaction references read-only;
8. derive readiness exceptions;
9. publish the run summary and watermark;
10. retain sanitized evidence and metrics.

### 5.2 Safety controls

- the Phase 1 provider client allows only `GET`, `HEAD` and `OPTIONS`;
- any attempted mutation method fails locally before a network request;
- credentials are never returned through an API or client bundle;
- retries are bounded and use backoff;
- a failed page does not advance its durable cursor;
- repeated runs upsert by stable provider mapping and do not duplicate records;
- upstream deletion/absence produces a review state, not immediate local
  deletion;
- raw payload access is restricted, encrypted where retained and subject to
  retention policy;
- application logs use internal correlation IDs and redact personal data.

### 5.3 Change detection

For each mirrored resource, record:

- upstream resource type and ID;
- checksum of the normalized source representation;
- first and last observed timestamps;
- last successful run;
- active/missing state;
- material-field changes;
- resulting exception, if any.

Provider IDs are mappings and never become MSM primary keys.

## 6. Minimum data model

| Record | Minimum purpose |
|---|---|
| `IntegrationAccount` | Provider, environment, scope and secret reference |
| `IntegrationRun` | Start/end, release, status, counts and correlation |
| `IntegrationAttempt` | Endpoint/page attempt, safe error and retry state |
| `ProviderMapping` | Internal record to provider resource ID |
| `ProviderSnapshot` | Checksum, observation times and protected payload reference |
| `Tenant`, `Site`, `Utility` | Internal operating hierarchy |
| `Customer`, `ServiceAccount` | Customer and bill-to relationship |
| `Meter`, `MeterInstallation` | Physical device and installation epoch |
| `MeterAssignment` | Effective-dated billable relationship |
| `MeterTopologyLink` | Source/bulk/downstream classification |
| `ReadinessException` | Type, severity, owner, state and evidence |
| `AuditEvent` | Actor, action, scope, result and correlation |
| `OutboxMessage` | Durable future side-effect boundary |

## 7. Roles and permissions

| Capability | Administrator | Metering operator | Billing officer | Auditor |
|---|---:|---:|---:|---:|
| View scoped provider mirror | Yes | Yes | Yes | Yes |
| Run/retry read-only sync | Yes | Optional | No | No |
| Maintain physical installation evidence | Yes | Yes | View | View |
| Propose an assignment | Yes | Yes | No | No |
| Approve an assignment for billing | No by default | No by default | Yes | No |
| Classify topology/source role | Yes | Yes | View | View |
| Resolve readiness exception | Yes | Assigned types | Assigned types | No |
| View integration/audit evidence | Yes | Scoped | Scoped | Yes |
| Call provider mutation | No | No | No | No |

Named people, segregation rules and site scopes must be approved before user
acceptance testing.

## 8. Work packages

| Package | Deliverable | Depends on | Completion evidence |
|---|---|---|---|
| R1 | Secure configuration, database-only runtime and secret references | Credential rotation and deployment decision | Startup fails closed; secret/redaction tests pass |
| R2 | Identity, roles, tenant/site scope and audit | Named owners and identity decision | API and browser authorization tests |
| R3 | Integration run/attempt/mapping/snapshot foundation | R1 | Migration, retry and idempotency tests |
| R4 | Typed read-only SteamaCo adapter | R1 and API contract | Contract fixtures and mutation-denial tests |
| R5 | Reference, customer and meter synchronization | R3-R4 | Repeat-run and change-detection evidence |
| R6 | Service accounts, installations and effective assignments | R2 and controlled cleanup register | Invariant and approval tests |
| R7 | Readiness exception engine | R5-R6 | Seeded scenario tests and count reconciliation |
| R8 | Internal operations screens and safe export | R2 and R5-R7 | Real pilot browser tests by role |
| R9 | Monitoring, runbook, backup and restore evidence | All packages | Alert test, restore test and operating sign-off |

## 9. Acceptance catalogue

### Security and access

- `R1-ACC-001`: runtime startup fails when database, provider or application
  secrets are missing or unsafe outside tests.
- `R1-ACC-002`: no provider credential, token, customer contact detail or raw
  payment payload appears in browser assets, logs or exports.
- `R1-ACC-003`: each role can access only its approved tenant/site scope.
- `R1-ACC-004`: denied sensitive actions create an auditable result without
  exposing protected data.
- `R1-ACC-005`: the provider adapter rejects `POST`, `PUT`, `PATCH` and `DELETE`
  locally in the Phase 1 build.

### Synchronization and integrity

- `R1-ACC-010`: running the same source snapshot twice creates no duplicate
  customer, meter, mapping, assignment observation or provider transaction.
- `R1-ACC-011`: pagination failure preserves the last safe cursor and resumes
  without skipping or duplicating records.
- `R1-ACC-012`: material upstream changes produce a new snapshot/change event;
  unchanged records do not create false changes.
- `R1-ACC-013`: upstream absence marks a record for review and never silently
  deletes internal history.
- `R1-ACC-014`: every mirrored row identifies its provider mapping, first/last
  observation and successful integration run.
- `R1-ACC-015`: current collection counts reconcile to the provider response or
  have explicit, owned exceptions.

### Assignment and readiness

- `R1-ACC-020`: one meter cannot have overlapping current billable assignments.
- `R1-ACC-021`: reassignment closes/creates effective records without changing
  historical assignments.
- `R1-ACC-022`: customer/source/spare/test classifications are independent of
  provider customer assignment.
- `R1-ACC-023`: an unassigned, never-online, offline, stale or unknown-role
  meter creates the correct readiness exception.
- `R1-ACC-024`: no meter becomes billing-ready without verified identity,
  installation, approved service account, current assignment and tariff
  reference.
- `R1-ACC-025`: aggregate estate and exception counts can be traced to the
  controlled row-level records.

### User experience and operations

- `R1-ACC-030`: inventory and exception screens show source and freshness time.
- `R1-ACC-031`: authorized staff can trace a provider customer to service
  account, meter, installation and assignment without seeing unrelated sites.
- `R1-ACC-032`: the safe export contains only approved fields and records its
  requester, scope and checksum.
- `R1-ACC-033`: integration failures show an actionable category, correlation
  and retry state without secrets or raw PII.
- `R1-ACC-034`: the dashboard never labels missing or stale telemetry as zero
  consumption.

### Operability

- `R1-ACC-040`: backup and restore are tested using the agreed RPO/RTO evidence.
- `R1-ACC-041`: monitoring detects failed sync, stale successful sync and a
  rising critical-exception count.
- `R1-ACC-042`: the operating runbook covers credential rotation, failed sync,
  provider outage, mapping correction and evidence capture.
- `R1-ACC-043`: a provider release change triggers contract review before newly
  shaped data is accepted silently.

## 10. Pilot dataset

The pilot uses real, approved records—never fabricated production records. It
should include a source/bulk meter and at least two customer meters where the
estate permits. Every included record must have:

- controlled row-level identity and mapping;
- physical and installation evidence;
- an approved service account and current assignment;
- fresh provider status;
- safe, non-personal test expectations.

The current snapshot does not yet prove that such a cohort is available. That
is an operations readiness task, not a reason to insert mock records.

## 11. Definition of done

Phase 1 is complete only when:

- all work packages R1-R9 meet their completion evidence;
- all applicable `R1-ACC-*` tests pass against real approved pilot records;
- repeated synchronization is demonstrably idempotent;
- provider and physical-estate counts reconcile or have owned exceptions;
- operations and billing approve every pilot assignment;
- no provider mutation path is enabled;
- security, operations and quality owners sign off the runbook and evidence.

Passing unit tests or rendering a dashboard alone does not complete Phase 1.
