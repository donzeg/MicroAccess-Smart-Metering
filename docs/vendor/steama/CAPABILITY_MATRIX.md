# SteamaCo Capability Matrix

## 1. Purpose

This matrix translates the live SteamaCo API into MSM product decisions. It
distinguishes resources that must be documented from resources that should be
integrated into the first release.

The evidence baseline is the authenticated `release/v4.40.0` review dated
26 October 2026.

## 2. Decision vocabulary

| Decision | Meaning |
|---|---|
| Integrate | MSM requires the capability in the target product |
| Mirror | Synchronize upstream data into an MSM-owned read model |
| Reference | Retain for enrichment or support, but not as a core workflow |
| Conditional | Implement only when the named business condition exists |
| Defer | Do not implement until an explicit safety or product gate passes |
| Exclude | Do not use for the stated MSM responsibility |

## 3. Resource decisions

| Resource | Verified capability | MSM decision | Delivery phase | Gate or caveat |
|---|---|---|---|---|
| `/my-account/` | Account scope, currency, timezone and capability flags | Integrate server-side | 0 | Never expose the provider account to clients |
| `/projects/` | Provider project hierarchy; currently empty | Reference | 1 | MSM tenant hierarchy must not depend on it |
| `/sites/` | Site configuration and links to analytics | Mirror | 1 | Map provider site IDs to MSM sites |
| `/utilities/` | Utility names and display units | Mirror | 1 | Preserve upstream units with every reading |
| `/customers/` | Customer, balance and billing configuration | Mirror and map | 1 | MSM owns login identity and effective assignments |
| `/meters/` | Meter inventory, assignment, state and diagnostics | Mirror | 1 | Resolve 26 unassigned meters before billing |
| `/tags/` | Provider classification | Mirror selectively | 1 | MSM classifications remain authoritative locally |
| `/transactions/` | Provider ledger | Mirror | 2 | Treat as provider ledger, not captured-money truth |
| `/customers/{id}/transactions/` | Read and create customer transactions | Defer mutation | 4 | Payment body, units and idempotency require confirmation |
| `/payments/invalid/` | Invalid-payment exceptions | Mirror | 4 | Map into reconciliation cases |
| `/reports/` | Usage, uptime, anomaly, failed-payment and AMI reports | Integrate | 2 | Output-delivery contract is unresolved |
| `/stats/` | Derived operational analytics | Integrate as secondary views | 3 | Never use as billing source of truth |
| `/alerts/` | Bypass, illegal-connection and payment-anomaly cases | Mirror | 3 | Preserve provider state and local acknowledgement separately |
| `/messages/` | Directories for customer, agent and gateway messages | Conditional | 5 | Use only when channel delivery semantics are documented |
| `/directives/` | Legacy directive/event history | Mirror for audit | 3 | Do not build new commands on v1 |
| `/directives-v2/` | Current directive/event history | Mirror for audit | 3 | Creation endpoint and lifecycle are missing |
| `/dlms-event-logs/` | Meter protocol events | Mirror | 3 | Normalize event codes without discarding raw values |
| `/bitharvesters/` | Communications-gateway registry | Conditional operations | 3 | Collection was empty for reviewed account |
| `/feeders/` | Feeder registry | Integrate when topology is configured | 3 | Required for feeder loss reporting |
| `/inverters/` | Solar inverter registry and metrics link | Integrate for solar | 3 | Collection was empty for reviewed account |
| `/agents/` | Agent identity, credit and transaction/message links | Conditional | 6 | Only if MicroAccess adopts a cash-agent channel |
| `/exchange-rates/` | Currency-pair rates | Exclude from first release | Later | First site is NGN; financial conversion needs policy |
| `/meters/manufacturers/` | Manufacturer reference | Reference | 1 | Useful for inventory and support |
| `/meter-original-equipment-manufacturers/` | OEM reference | Reference | 1 | Useful for warranty and support |
| `/users/` | Provider operator accounts and permissions | Exclude for MSM authentication | 0 | MSM owns its employee/customer access model |

## 4. Capability decisions

### 4.1 First-release essentials

The first operational release requires:

1. account and site-scope validation;
2. customer and meter mirror;
3. meter/customer assignment remediation;
4. utility readings and usage ingestion;
5. provider transaction mirror;
6. raw and normalized data-quality records;
7. report-based historical backfill;
8. local tariff, billing and ledger models;
9. reconciliation views.

### 4.2 Later, safety-gated capabilities

These require a dedicated gate:

| Capability | Required gate |
|---|---|
| Provider payment/top-up posting | Sandbox success, idempotency proof, reversals and finance approval |
| Remote connect/disconnect | Vendor endpoint, authorization model, dual approval, device outcome and rollback |
| Tariff/configuration writes | Effective-date semantics, validation, approval and audit |
| Customer messaging | Consent, delivery evidence, templates and retry policy |
| Agent operations | Approved channel model, cash control and commission policy |

## 5. Current-data readiness

| Area | Current condition | Required action |
|---|---|---|
| Customer/meter mapping | 5 assigned meters, 26 unassigned | Create and approve effective assignments |
| Connectivity | 27 meters marked never online | Commission or diagnose before billing |
| Reading coverage | Current stream represents two meters | Establish coverage and freshness gates |
| Payment evidence | No provider `PAY` transactions observed | Validate end-to-end payment in sandbox |
| Tariff setup | Most payment-plan/tariff fields blank | Approve and version local tariffs |
| Topology | Feeder/inverter/gateway collections empty in account | Confirm permissions and configure source topology |
| Historical access | Direct reading filters not verified | Confirm AMI report/backfill mechanism |

## 6. Provider dependency rule

An MSM feature is not considered supported merely because:

- a field name exists;
- an HTTP method appears in an `Allow` header;
- an unknown query parameter receives HTTP 200;
- a provider dashboard displays the result;
- a prototype can simulate the workflow.

Support requires a documented contract, a safe test path, captured evidence and
an MSM failure/reconciliation design.
