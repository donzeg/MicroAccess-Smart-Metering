# MicroAccess Smart Metering Documentation

This directory is the authoritative starting point for the MicroAccess Smart
Metering (MSM) redesign.

The repository also contains earlier concept documents. Those files remain as
historical inputs, but they are not implementation contracts unless a current
document below explicitly adopts their content.

## Evidence labels

Every current MSM document uses these labels:

- **Live verified**: observed through authenticated, read-only SteamaCo API
  requests on 26 October 2026.
- **Repository verified**: observed in the current source code or automated
  tests.
- **Target design**: the proposed product behavior. It is not evidence that the
  behavior has been implemented.
- **Vendor confirmation required**: a material dependency that the available
  API metadata does not resolve.
- **Business decision required**: a policy choice that MicroAccess must make.

## Authoritative documents

| Document | Status | Purpose |
|---|---|---|
| [Project Review](PROJECT_REVIEW.md) | Repository and live verified | Records the disposition of the inherited prototype and legacy documents |
| [SteamaCo API Contract](vendor/steama/API_CONTRACT.md) | Live verified | Authentication, resources, nested routes, schemas, observed behavior and gaps |
| [SteamaCo Capability Matrix](vendor/steama/CAPABILITY_MATRIX.md) | Live verified plus target mapping | Decides which provider capabilities MSM will use and in which phase |
| [Product Requirements](product/PRODUCT_REQUIREMENTS.md) | Target design | Defines product scope, actors, capabilities and acceptance rules |
| [Domain Model](product/DOMAIN_MODEL.md) | Target design | Defines authoritative records, relationships and invariants |
| [Billing and Payments](product/BILLING_AND_PAYMENTS.md) | Target design | Defines consumption, tariffs, bills, payments, credit and reconciliation |
| [Target Architecture](product/TARGET_ARCHITECTURE.md) | Target design | Defines system boundaries, components, integrations, security and operations |
| [Delivery Plan](product/DELIVERY_PLAN.md) | Target design | Defines implementation phases and evidence-based release gates |
| [Phase 0 Readiness Tracker](governance/PHASE_0_READINESS_TRACKER.md) | Active tracker | Separates internal readiness work, decisions and vendor-dependent holds |
| [Billing Policy Decision Pack](product/BILLING_POLICY_DECISION_PACK.md) | Business decision required | Captures the policies needed before tariffs or billing can be implemented |
| [Meter Estate Readiness Pack](readiness/README.md) | Live baseline plus controlled template | Guides physical, customer and meter reconciliation without committing PII |
| [Phase 1 Read-Only Scope](product/PHASE_1_READ_ONLY_SCOPE.md) | Approved scope required | Defines the first safe engineering milestone and its acceptance catalogue |

## Legacy documents

The following root documents were written before authenticated API discovery:

- `STEAMA_API_CATEGORIZATION.md`
- `PROJECT_SUMMARY.md`
- `TECHNICAL_ARCHITECTURE.md`
- `TECH_STACK_FINAL.md`
- `TECH_STACK_ON_PREM.md`

They contain useful context and prototypes, but also stale endpoint paths,
unverified API operations and implementation-readiness claims. Each now carries
a supersession notice pointing to this documentation set.

## Change control

The SteamaCo contract is tied to the observed upstream release. A future API
review must record:

1. review date;
2. upstream release branch and Git revision, when exposed;
3. account and permission scope, without recording identities or credentials;
4. added, removed or changed resources and fields;
5. impact on MSM requirements, mappings and tests.

Credentials, tokens, cookies, customer personal information and raw payment
payloads must never be committed to this repository.
