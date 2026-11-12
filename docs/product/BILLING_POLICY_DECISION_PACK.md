# Billing Policy Decision Pack

## 1. Purpose

This pack records the business decisions that must be made before MSM can
calculate, approve or post customer charges. It is written for management,
operations and finance; the approved answers will become controlled inputs to
the tariff, billing and payment designs.

The recommendations below are safe starting positions, not assumed decisions.
Enter an approved answer, owner and date for every item that applies to the
pilot.

## 2. Decision record format

For each decision record:

- **Approved answer** is the exact policy chosen by MicroAccess.
- **Owner** is the business role accountable for the policy.
- **Approver** is the person or committee authorized to approve it.
- **Effective date** is when the policy begins to apply.
- **Evidence** links to an approved tariff, resolution, contract or procedure.

No blank answer should be converted into application behavior.

## 3. Service and billing model

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-001 | Which service accounts are prepaid, postpaid or excluded? | Classify each service account explicitly; do not infer from provider balance | Pending | Product owner | Executive sponsor | Pending |
| BP-002 | Can one customer hold multiple service accounts? | Yes, with separate balances, meter assignments and statements | Pending | Product owner | Executive sponsor | Pending |
| BP-003 | Can one service account have multiple active customer meters? | Only through an approved multi-meter rule with a named primary/aggregation policy | Pending | Billing owner | Product owner | Pending |
| BP-004 | What is the normal postpaid billing period? | Calendar month in the site timezone | Pending | Billing owner | Finance owner | Pending |
| BP-005 | What timezone governs periods and tariff boundaries? | The configured site timezone; store source timestamps in UTC | Pending | Billing owner | Product owner | Pending |
| BP-006 | When is a service account opened, suspended, closed or archived? | Use effective dates and retain history; never delete posted financial history | Pending | Product owner | Finance owner | Pending |

## 4. Meter readings and consumption

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-010 | Which measurement is the billing source? | Validated register delta, cross-checked against provider `usage_amount` | Pending | Metering operator | Billing owner | Pending |
| BP-011 | What freshness is required at period close? | Define a maximum age per meter class; do not post if the closing evidence is stale | Pending | Metering operator | Billing owner | Pending |
| BP-012 | What reading coverage is required for a final bill? | Require complete boundary evidence or an approved estimate exception | Pending | Billing owner | Finance owner | Pending |
| BP-013 | What tolerance is allowed between register delta and provider usage? | Set an absolute and percentage tolerance by meter/utility precision | Pending | Metering operator | Billing owner | Pending |
| BP-014 | How are register resets, rollovers and meter replacements handled? | Require an installation/reset event and opening/closing evidence before use | Pending | Metering operator | Billing owner | Pending |
| BP-015 | Which conditions make an interval non-billable? | Negative unexplained delta, duplicate, unit/timezone mismatch, unresolved reset or severe anomaly | Pending | Billing owner | Finance owner | Pending |
| BP-016 | May consumption be estimated? | Only under an approved method, threshold, reason and reviewer | Pending | Billing owner | Finance owner | Pending |
| BP-017 | What estimation methods are allowed and in what order? | Same-period history, adjacent validated trend, then documented manual estimate | Pending | Billing owner | Finance owner | Pending |
| BP-018 | How is an estimated bill corrected after actual data arrives? | Issue an explicit true-up/adjustment; never rewrite the posted bill | Pending | Billing owner | Finance owner | Pending |
| BP-019 | Who may approve a reading-quality override? | A role independent of the preparer, with reason and evidence | Pending | Billing owner | Finance owner | Pending |

## 5. Tariffs, fees, taxes and rounding

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-020 | What tariff plans apply to the pilot? | Publish a controlled local tariff version for every billable service account | Pending | Billing owner | Executive sponsor | Pending |
| BP-021 | Is the energy rate flat, tiered or time-of-use? | Configure explicitly per tariff version; do not infer from provider fields | Pending | Billing owner | Executive sponsor | Pending |
| BP-022 | If tiered, do tiers reset per purchase, day or billing period? | Reset by the defined billing period unless the approved tariff states otherwise | Pending | Billing owner | Finance owner | Pending |
| BP-023 | If time-of-use, what clock, calendar and holiday rules apply? | Use site local time with an approved calendar and daylight-saving policy | Pending | Billing owner | Finance owner | Pending |
| BP-024 | Are fixed subscription or service charges allowed? | Model as explicit tariff components, never embed in the energy rate | Pending | Billing owner | Finance owner | Pending |
| BP-025 | Are connection, disconnection or reconnection fees allowed? | Only approved, itemized fees with an event reference | Pending | Billing owner | Executive sponsor | Pending |
| BP-026 | Which taxes or levies apply, and to what base? | Configure each rate, legal basis, effective date and taxable components | Pending | Finance owner | Executive sponsor | Pending |
| BP-027 | Are discounts or subsidies allowed? | Use explicit effective-dated components with eligibility and approval | Pending | Finance owner | Executive sponsor | Pending |
| BP-028 | What currency and minor-unit precision apply? | NGN with decimal money arithmetic and an approved display/settlement precision | Pending | Finance owner | Executive sponsor | Pending |
| BP-029 | What quantity precision applies to energy? | Preserve source precision; round only at the approved calculation stage | Pending | Metering operator | Billing owner | Pending |
| BP-030 | What midpoint rounding rule applies? | Half-up or half-even must be selected explicitly and used consistently | Pending | Finance owner | Executive sponsor | Pending |
| BP-031 | Is rounding performed per interval, tier, line or bill total? | Prefer component/line rounding, with unrounded intermediate quantities retained | Pending | Finance owner | Executive sponsor | Pending |
| BP-032 | How are tariff changes approved and announced? | Maker-checker approval with a future effective date and customer notice period | Pending | Billing owner | Executive sponsor | Pending |
| BP-033 | Can a tariff be backdated? | No, except a formally approved correction with impact analysis and adjustment records | Pending | Billing owner | Executive sponsor | Pending |
| BP-034 | How is the initial tariff assigned to existing accounts? | Controlled migration with exception report and 100% assignment coverage | Pending | Billing owner | Finance owner | Pending |
| BP-035 | Are provider tariff/payment-plan fields authoritative? | No; mirror as evidence and map to an approved MSM tariff version | Pending | Product owner | Finance owner | Pending |
| BP-036 | What minimum vend or bill amount applies? | Define by payment channel and tariff; reject before taking money | Pending | Finance owner | Executive sponsor | Pending |

## 6. Postpaid billing and collections

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-040 | How many review/approval steps precede posting? | Preparer plus independent approver for the pilot | Pending | Billing owner | Finance owner | Pending |
| BP-041 | What is the bill issue date and due-date rule? | Fixed, documented offsets from period close in site time | Pending | Billing owner | Finance owner | Pending |
| BP-042 | How are partial payments allocated? | Oldest due receivable first unless a payment is explicitly designated | Pending | Finance owner | Executive sponsor | Pending |
| BP-043 | Are overpayments carried, refunded or both? | Carry as customer credit; refund only through an approved workflow | Pending | Finance owner | Executive sponsor | Pending |
| BP-044 | Are late fees or interest allowed? | Disabled until legal basis, calculation and notice policy are approved | Pending | Finance owner | Executive sponsor | Pending |
| BP-045 | What collection stages and service actions apply? | Separate notice, review and approved service action; never automate disconnection initially | Pending | Finance owner | Executive sponsor | Pending |
| BP-046 | How are disputed bills handled? | Freeze disputed amount from adverse action while investigation is open | Pending | Support owner | Finance owner | Pending |
| BP-047 | Who may create and approve adjustments or credit notes? | Separate maker and approver with reason and supporting evidence | Pending | Billing owner | Finance owner | Pending |

## 7. Prepaid purchases, payment and refunds

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-050 | Which payment channels are permitted at launch? | Start with one selected gateway/channel and management visibility | Pending | Finance owner | Executive sponsor | Pending |
| BP-051 | What proves that money was captured? | Server-to-server gateway verification followed by settlement reconciliation | Pending | Finance owner | Security owner | Pending |
| BP-052 | When is provider credit attempted? | Only after verified capture and balanced internal ledger posting | Pending | Finance owner | Product owner | Pending |
| BP-053 | What does the customer see when money is captured but credit is pending? | A clear pending-credit state, reference and support route | Pending | Product owner | Finance owner | Pending |
| BP-054 | What retry limits apply to provider credit? | Automated bounded retries only for safe errors; ambiguous outcomes require reconciliation first | Pending | Technical lead | Finance owner | Pending |
| BP-055 | Who may manually retry an uncertain or rejected credit? | Authorized finance/operations role with maker-checker control above an approved limit | Pending | Finance owner | Security owner | Pending |
| BP-056 | What are the refund eligibility rules and service levels? | Define reason codes, approval thresholds, destination and target completion time | Pending | Finance owner | Executive sponsor | Pending |
| BP-057 | Must provider credit be reversed before cash is refunded? | Decide per confirmed vendor capability; never conceal unmatched credit | Pending | Finance owner | Executive sponsor | Pending |
| BP-058 | How are gateway charges treated? | Record as separate expense/fee; do not silently reduce customer energy value | Pending | Finance owner | Executive sponsor | Pending |
| BP-059 | What daily reconciliation sign-off is required? | Reconcile gateway, bank/settlement, MSM ledger and provider transactions with owned exceptions | Pending | Finance owner | Executive sponsor | Pending |

## 8. Source energy and losses

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-060 | Which meters represent grid, solar, generator and bulk distribution? | Approve an effective-dated topology independent of customer assignments | Pending | Energy manager | Metering operator | Pending |
| BP-061 | What common interval is used for source reconciliation? | Use the highest reliable common interval and aligned site-time boundaries | Pending | Energy manager | Finance owner | Pending |
| BP-062 | How are technical losses reported? | Show separately from commercial loss and unmetered load | Pending | Energy manager | Executive sponsor | Pending |
| BP-063 | Are source costs allocated to customers? | Only through an approved tariff component; reconciliation alone does not create charges | Pending | Finance owner | Executive sponsor | Pending |
| BP-064 | How is generator fuel converted to energy cost? | Defer until fuel, runtime, generation and calibration evidence are reliable | Pending | Energy manager | Finance owner | Pending |
| BP-065 | What variance triggers investigation? | Set absolute and percentage thresholds by period and data coverage | Pending | Energy manager | Finance owner | Pending |
| BP-066 | Who owns unresolved energy variances? | Named energy/operations owner with ageing and escalation | Pending | Energy manager | Executive sponsor | Pending |
| BP-067 | Can an energy variance change a posted customer bill? | No; only a separately approved bill adjustment under tariff rules can do so | Pending | Billing owner | Finance owner | Pending |

## 9. Customer communication and records

| ID | Decision | Recommended baseline | Approved answer | Owner | Approver | Effective date |
|---|---|---|---|---|---|---|
| BP-070 | Which documents must customers receive? | Bill or purchase receipt, payment reference, tariff summary and support reference | Pending | Product owner | Finance owner | Pending |
| BP-071 | Which channels may be used? | Only consented, approved channels with delivery attempts recorded separately | Pending | Support owner | Data protection owner | Pending |
| BP-072 | What notice is required for tariff changes? | Define a minimum notice period and durable evidence of publication | Pending | Product owner | Executive sponsor | Pending |
| BP-073 | What records may support staff see? | Least privilege; mask contact/payment data unless needed for the case | Pending | Support owner | Data protection owner | Pending |
| BP-074 | How long are readings, bills, ledger and payment records retained? | Apply legal/contractual requirements; financial history must outlive routine operational logs | Pending | Data protection owner | Finance owner | Pending |

## 10. Approval summary

The initial policy is ready for implementation only when:

- every decision used by the pilot has an approved answer and effective date;
- every tariff component has a calculation example independently checked by
  finance;
- approval limits and segregation of duties are named;
- the controlled tariff file and policy evidence are versioned;
- unresolved decisions are represented as disabled functionality, not software
  defaults.

## 11. Worked examples required before approval

Finance and billing should provide anonymized examples for:

1. one normal prepaid purchase;
2. one normal postpaid month;
3. a tier boundary;
4. a time-of-use boundary, if applicable;
5. a tariff change inside a billing period;
6. a meter replacement or reset;
7. a missing-reading estimate and later true-up;
8. a partial payment and overpayment;
9. a refund or reversal;
10. grid/solar source reconciliation for the same interval.

These examples become acceptance fixtures. They must not contain live customer
personal information.
