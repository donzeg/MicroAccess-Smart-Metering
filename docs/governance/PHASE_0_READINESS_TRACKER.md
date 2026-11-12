# Phase 0 Readiness Tracker

## 1. Purpose

This tracker turns Phase 0 into owned, evidence-based work. It separates tasks
that MicroAccess can complete now from tasks that require SteamaCo or another
external party.

The vendor questionnaire and formal vendor contact are intentionally on hold
until the internal call with Mr. Marco has taken place. That hold does not stop
inventory cleanup, policy decisions, security preparation or the read-only
integration design.

## 2. Overall status

**Phase 0 status: In progress**

Read-only discovery and product definition are sufficiently advanced to start
internal preparation and the Phase 1 engineering design. The following remain
hard release gates:

- rotation of any credential that has been disclosed outside the approved
  secret-management process;
- named ownership and approval roles;
- clean customer, service-account and meter assignments for the pilot;
- approved billing and tariff policy;
- a non-production mutation path and confirmed vendor contracts before any
  payment credit or remote command is attempted.

## 3. Status definitions

| Status | Meaning |
|---|---|
| Complete | Required evidence exists and has been reviewed |
| In progress | Work has started and has an identified next action |
| Ready to start | No known dependency prevents the work |
| Decision required | MicroAccess management or a named owner must decide |
| External hold | Progress requires a vendor or third-party response |
| Blocked | A critical prerequisite is missing |

## 4. Readiness work register

| ID | Work item | Owner role | Status | Evidence or current position | Next action | Gate |
|---|---|---|---|---|---|---|
| P0-001 | Establish the current documentation authority | Product owner | Complete | `docs/README.md` identifies the current document set and marks legacy documents | Keep the index current through implementation | Phase 1 start |
| P0-002 | Review the inherited application | Technical lead | Complete | `docs/PROJECT_REVIEW.md` records severity-ranked findings and test evidence | Convert accepted findings into implementation backlog items | Phase 1 start |
| P0-003 | Discover the SteamaCo read-only surface | Integration lead | Complete | Authenticated API snapshot and capability matrix dated 26 October 2026 | Revalidate when the upstream release changes | Phase 1 start |
| P0-004 | Define system boundaries and record ownership | Product owner and technical lead | Complete | Product requirements, domain model and target architecture distinguish provider, MSM and payment facts | Approve as the design baseline | Phase 1 start |
| P0-005 | Rotate previously disclosed provider credentials | System administrator | Blocked | Rotation has not been independently evidenced in this repository | Rotate the credential in SteamaCo, revoke old sessions/tokens if supported, and record only the completion date and approver | Security gate |
| P0-006 | Create a controlled provider-secret process | System administrator | Ready to start | Target architecture requires server-side secrets but no operating record exists | Select secret store, define access owners, rotation interval and emergency revocation procedure | Security gate |
| P0-007 | Nominate business and technical owners | Executive sponsor | Decision required | Roles are defined but people are not named | Name the product, operations, billing, finance, security and technical owners plus approvers | Phase 1 start |
| P0-008 | Establish the meter-estate baseline | Metering operator | Complete | Aggregate live snapshot and exception register are in `docs/readiness/` | Obtain the controlled row-level export and reconcile it to the physical estate | Pilot gate |
| P0-009 | Reconcile physical meters to provider meters | Metering operator | Ready to start | 31 provider meters were observed; physical inventory evidence is not yet attached | Walk the site or use the approved asset register; record serial, location, type, source/load role and evidence | Pilot gate |
| P0-010 | Repair customer-to-meter assignments | Metering operator and billing owner | In progress | Snapshot showed 26 unassigned meters and 28 customers without an observed assignment | Complete the controlled assignment register and obtain billing-owner approval | Billing gate |
| P0-011 | Triage connectivity and commissioning | Metering operator | Ready to start | 27 meters were Never Online, three Offline and one Online at the snapshot | Assign cause and action per meter; retest representative pilot meters | Pilot gate |
| P0-012 | Classify source, bulk and customer meters | Energy manager and metering operator | Ready to start | The domain model supports topology; the current provider snapshot does not prove the full topology | Approve grid, solar, distribution/bulk and customer-load classifications | Energy gate |
| P0-013 | Approve prepaid/postpaid operating modes | Product owner and finance owner | Decision required | Target supports both; the initial rollout mode has not been approved | Complete decisions BP-001 through BP-006 in the billing policy pack | Billing gate |
| P0-014 | Approve tariff and rounding policy | Billing owner and finance owner | Decision required | Most observed provider tariff fields were blank and are not authoritative for MSM | Complete decisions BP-020 through BP-036 and publish the initial controlled tariff | Billing gate |
| P0-015 | Approve reading-quality and estimation policy | Billing owner and metering operator | Decision required | Target controls exist; thresholds and estimation authority are not approved | Complete decisions BP-010 through BP-019 | Billing gate |
| P0-016 | Approve payment, refund and reconciliation policy | Finance owner | Decision required | Safe lifecycle is designed; payment gateway and operating limits remain undecided | Complete decisions BP-040 through BP-059 | Payment phase gate |
| P0-017 | Approve energy-loss treatment | Energy manager and finance owner | Decision required | Customer billing and source reconciliation are separated in the design | Complete decisions BP-060 through BP-067 | Energy gate |
| P0-018 | Select staff identity and access approach | Security owner and technical lead | Decision required | Required role classes and scopes are documented | Decide identity provider, MFA requirements, joiner/mover/leaver process and emergency access | Security gate |
| P0-019 | Approve deployment and recovery targets | Technical lead and business owner | Decision required | On-premise is the stated direction; availability, recovery and exposure targets are not approved | Decide RPO, RTO, backup retention, restore testing and controlled internet exposure | Production gate |
| P0-020 | Prepare read-only implementation scope | Technical lead | Complete | `docs/product/PHASE_1_READ_ONLY_SCOPE.md` defines boundaries, work packages and acceptance tests | Estimate and sequence the backlog after owner approval | Phase 1 start |
| P0-021 | Prepare a safe pilot cohort | Metering operator and billing owner | Ready to start | Cohort criteria are defined; approved records are not yet selected | Select representative online source and customer meters with approved assignments | Pilot gate |
| P0-022 | Create non-production test identities and meters | Vendor relationship owner | External hold | The observed account is a live account and must not be used for mutation testing | Raise after the call with Mr. Marco and obtain written scope | Payment and command gates |
| P0-023 | Confirm provider mutation contracts | Vendor relationship owner | External hold | Transaction and directive semantics are incomplete | Resume formal vendor clarification after the call with Mr. Marco | Payment and command gates |
| P0-024 | Confirm historical reading/backfill method | Vendor relationship owner | External hold | Query filters tested during discovery were silently ignored; AMI report may be required | Confirm supported cursor/filter/report workflow after the vendor call | Phase 2 gate |
| P0-025 | Define privacy retention and support access | Data protection owner | Ready to start | PII and secret-handling principles are documented; retention periods are not | Define classification, retention, export, erasure restrictions and privileged support access | Security gate |
| P0-026 | Establish acceptance evidence storage | Quality owner | Ready to start | Acceptance IDs are defined in the Phase 1 scope | Select an evidence location and naming convention that excludes secrets and raw PII | Phase 1 completion |

## 5. Work that can proceed during the vendor hold

The following sequence has no dependency on the vendor questionnaire:

1. rotate and govern credentials;
2. name owners and approvers;
3. reconcile the physical estate to the controlled meter register;
4. repair customer, service-account and meter assignments;
5. triage never-online and offline meters;
6. approve billing, tariff, data-quality and reconciliation policies;
7. approve identity, deployment, privacy and recovery decisions;
8. estimate and build the Phase 1 read-only foundation;
9. select a representative pilot cohort;
10. capture acceptance evidence for every completed gate.

## 6. Vendor-dependent hold register

| Hold ID | Capability held | Safe work allowed meanwhile | Release evidence required |
|---|---|---|---|
| VH-001 | Create SteamaCo payment/credit transaction | Model and test the internal purchase lifecycle using contract fixtures only | Written schema, amount/unit/sign semantics, idempotency behavior and sandbox test |
| VH-002 | Reverse/refund provider credit | Design internal reversal state and approval rules | Written reversal/STS contract and sandbox test |
| VH-003 | Submit remote meter directives | Mirror existing directives read-only and design approval workflow | Supported command list, request schema, outcome semantics and controlled test meter |
| VH-004 | Production historical backfill | Build resumable ingestion and report-import framework | Supported query/report contract and completeness test |
| VH-005 | Rely on webhook delivery | Build polling and reconciliation safely | Authentication, retry, ordering and replay contract plus test evidence |

## 7. Phase 0 exit checklist

Phase 0 may be closed only when all boxes are evidenced:

- [ ] P0-005 credential rotation is confirmed.
- [ ] P0-006 secret-management operating procedure is approved.
- [ ] P0-007 all required owners and approvers are named.
- [ ] Every billable pilot meter has a verified physical identity, location and
      current assignment.
- [ ] Representative pilot meters are online and producing sufficiently fresh
      readings.
- [ ] Billing mode, tariff, rounding, estimation and adjustment policies are
      approved.
- [ ] Identity, privacy, deployment, backup and recovery decisions are
      approved.
- [ ] A controlled evidence location and acceptance process exist.
- [ ] Vendor-dependent capabilities remain disabled unless their individual
      hold evidence is complete.
- [ ] A non-production mutation path exists before the payment or directive
      phases begin.

## 8. Review cadence

Review this tracker weekly during Phase 0. Every status change must include the
evidence location, date and approving role. A verbal assurance alone does not
close a gate.
