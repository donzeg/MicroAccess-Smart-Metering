# SteamaCo API Contract

## 1. Document status

| Item | Value |
|---|---|
| Evidence status | Live verified through authenticated, read-only requests |
| Review date | 26 October 2026 |
| API base URL | `https://api.steama.co` |
| Observed release branch | `release/v4.40.0` |
| Observed Git revision | `b1a731a52` |
| Mutation policy during review | No resource POST, PUT, PATCH or DELETE requests |
| Secret handling | Temporary credential file deleted; no token stored |

This document records observable API structure and behavior. It does not
replace SteamaCo's commercial agreement, service-level commitments or
undocumented business rules.

## 2. Authentication and account scope

### 2.1 Token acquisition

`POST /get-token/`

Request fields:

| Field | Type | Required |
|---|---|---|
| `username` | string | Yes |
| `password` | string | Yes |

The observed response contains only `token`. It does not contain an expiry,
refresh token or scope list.

Authenticated requests use:

`Authorization: Token <token>`

### 2.2 Account capabilities

`GET /my-account/` returns identity, company, timezone, currency and capability
flags. The reviewed account exposed:

- read, create, edit, report and message capabilities;
- account-management capability;
- a separate `can_send_unsafe_commands` capability;
- unrestricted site access;
- a distinct dashboard-visibility capability.

MSM must not translate these flags directly into MSM application roles. They
describe the upstream service account, not an MSM employee or customer.

### 2.3 Authentication findings

- Anonymous collection requests normally return HTTP 403.
- Anonymous `GET /alerts/` returned HTTP 500 during review and should be
  reported to SteamaCo.
- `/docs/` is a browsable HTML API, not an OpenAPI specification.
- Common OpenAPI and Swagger paths returned HTTP 404.
- The API exposes no machine-readable token-expiry contract.

## 3. Root resources

The authenticated root returned 24 resources.

| Root key | Path | Advertised collection methods | MSM classification |
|---|---|---|---|
| agents | `/agents/` | GET, POST | Conditional agent channel |
| alerts | `/alerts/` | GET, POST | Operations |
| bitharvesters | `/bitharvesters/` | GET, POST | Communications infrastructure |
| customers | `/customers/` | GET, POST | Core |
| directives | `/directives/` | GET | Legacy command/event history |
| directives-v2 | `/directives-v2/` | GET | Current command/event history |
| dlms-event-logs | `/dlms-event-logs/` | GET | Diagnostics and tamper events |
| exchange-rates | `/exchange-rates/` | GET | Conditional multi-currency |
| feeders | `/feeders/` | GET, POST | Electrical topology |
| invalid-payments | `/payments/invalid/` | GET, POST | Finance exceptions |
| inverters | `/inverters/` | GET, POST | Solar infrastructure |
| messages | `/messages/` | GET | Messaging directory |
| meter-manufacturers | `/meters/manufacturers/` | GET | Hardware reference |
| meter-original-equipment-manufacturers | `/meter-original-equipment-manufacturers/` | GET | Hardware reference |
| meters | `/meters/` | GET, POST | Core |
| my-account | `/my-account/` | GET, PUT, PATCH | Integration account |
| projects | `/projects/` | GET | Provider hierarchy |
| reports | `/reports/` | GET, POST | Reporting |
| sites | `/sites/` | GET | Core hierarchy |
| stats | `/stats/` | GET | Derived operational analytics |
| tags | `/tags/` | GET, POST | Classification |
| transactions | `/transactions/` | GET | Provider ledger |
| users | `/users/` | GET, POST | Provider operator accounts |
| utilities | `/utilities/` | GET | Utility and unit definitions |

Collection methods are route-level metadata. Detail routes may advertise
additional methods, and permissions can further restrict a particular account.

## 4. Customer contract

### 4.1 Customer collection and detail

`GET, POST /customers/`

`GET, PUT, PATCH /customers/{customer_id}/`

Important field groups:

| Group | Fields |
|---|---|
| Identity | `id`, `account_number`, `integration_id`, `index_number`, names, telephone, email |
| Scope | `site`, `site_url`, `site_name`, district, region, state, service centre |
| Financial state | `account_balance`, `energy_balance`, `currency_display`, `energy_price` |
| Billing configuration | `payment_plan`, `service_based_tariff`, `TOU_hours`, `low_balance_level`, `low_balance_warning` |
| Classification | `customer_class`, `user_type`, tags |
| Control | `control_type`, archive/demo/user/field-manager flags |
| Relationships | meter, transaction, message, balance, utility and revenue URLs |
| Audit | creation time, revision number, audit-log URL |

Observed choices:

| Field | Values |
|---|---|
| `control_type` | Manual; Automatic/Cloud; Automatic/STS Local; Manual/STS Local |
| `service_based_tariff` | A, B, C, D, E |
| `user_type` | Not specified; Residential; Business; Institution |

### 4.2 Customer nested resources

| Route | Methods | Purpose |
|---|---|---|
| `/customers/{id}/balances/` | GET | Timestamped account-balance history |
| `/customers/{id}/transactions/` | GET, POST | Provider charges, payments and adjustments |
| `/customers/{id}/meters/` | GET, POST | Assigned provider meters |
| `/customers/{id}/messages/` | GET, POST | Customer messages |
| `/customers/{id}/utilities/` | GET | Utility definitions and usage links |
| `/customers/{id}/utilities/{utility_id}/readings/` | GET | Cumulative readings and interval usage |
| `/customers/{id}/utilities/{utility_id}/usage/` | GET | Timestamped usage series |
| `/customers/{id}/availability-hours/` | GET | Supply availability |
| `/customers/{id}/import-energy/` | GET | Imported energy |
| `/customers/{id}/reactive-energy/` | GET | Reactive-energy series |
| `/customers/{id}/revenue/` | GET | Provider revenue series |
| `/customers/{id}/tags/` | GET, POST | Provider-side tags |

## 5. Metering contract

### 5.1 Meter collection and detail

`GET, POST /meters/`

`GET, PUT, PATCH /meters/{meter_id}/`

Important field groups:

| Group | Fields |
|---|---|
| Identity | `id`, `reference`, `name`, `seal_number`, vendor, version, manufacturer and OEM |
| Electrical model | meter type, phase, rating, pulse ratio, parent meter and feeder |
| Assignment | customer, site, project, utility, tags and installation metadata |
| Communication | BitHarvester, communication method, signal, SIM and logging intervals |
| Current status | latest reading, voltage, timestamps, online-duration status |
| Relay state | `connection_is_on` plus cloud, local-credit, power-limit and outage causes |
| Safety | critical error, lid tamper, reset, power-limit and usage-spike indicators |
| Relationships | metric, directive, event-log, uptime, audit and energy URLs |

### 5.2 Meter nested resources

| Route | Methods | Purpose |
|---|---|---|
| `/meters/{id}/metrics/` | GET | Metric definitions linked to the meter |
| `/meters/{id}/directives/` | GET | Directive/event history |
| `/meters/{id}/dlms-event-logs/` | GET | Meter protocol events |
| `/meters/{id}/availability-hours/` | GET | Supply availability |
| `/meters/{id}/comms_uptime/` | GET | Communications uptime |
| `/meters/{id}/overall-uptime/` | GET | Overall uptime |
| `/meters/{id}/power-uptime/` | GET | Power uptime |
| `/meters/{id}/import-energy/` | GET | Imported energy |
| `/meters/{id}/reactive-energy/` | GET | Reactive-energy series |
| `/meters/{id}/residual-energy-balance-kwh/` | GET | Residual balance |
| `/meters/{id}/audit-log/` | GET | Provider meter audit history |
| `/meters/{id}/tags/` | GET, POST | Provider-side tags |

The first meter records inspected returned empty `metrics` collections even
when a latest reading existed. Site and utility routes are therefore the
verified source for the current reading streams.

## 6. Site, utility and metric contract

### 6.1 Site

`GET /sites/`

`GET, PUT, PATCH /sites/{site_id}/`

Site records contain:

- currency and timezone;
- time-of-use, per-kWh and usage-tier settings;
- counts of customers and meters;
- notification and reconciliation settings;
- utility, metric, revenue, forecast and reliability links.

### 6.2 Utility consumption

`GET /sites/{site_id}/utilities/`

Utility definitions contain display units and links to:

- `/sites/{site_id}/utilities/{utility_id}/readings/`
- `/sites/{site_id}/utilities/{utility_id}/usage/`

Reading records contain:

- timestamp;
- cumulative `reading`;
- interval `usage_amount`;
- `is_anomalous`;
- meter, customer, inverter, site and BitHarvester references.

Usage records contain timestamp and `usage`.

### 6.3 Electrical metrics

`GET /sites/{site_id}/metrics/` returned 12 definitions:

| Metric | Code in nested path | Unit |
|---|---|---|
| Current | CURR | A |
| Frequency | FREQ | Hz |
| Neutral Current | NCUR | A |
| Phase 1 line-to-neutral voltage | P1NV | V |
| Phase 2 line-to-neutral voltage | P2NV | V |
| Phase 3 line-to-neutral voltage | P3NV | V |
| Active Power | PACT | W |
| Apparent Power | PAPP | VA |
| Power Factor | PFAC | ratio |
| Reactive Power | PREA | var |
| Reactive Energy Export | REGE | kVArh |
| Reactive Energy Import | REGI | kVArh |

Each definition links to:

- `/sites/{site_id}/metrics/{metric_code}/readings/`
- `/sites/{site_id}/metrics/{metric_code}/totals/`

Metric readings contain timestamp and reading. Totals contain timestamp,
average, minimum, maximum and number of data points.

### 6.4 Site analytics

Verified nested site routes include:

- active-core and active-meter counts;
- availability hours;
- communications;
- forecasts;
- grid reliability metrics;
- import and reactive energy;
- online smart/STS meter counts;
- payment counts;
- residual energy balance;
- response efficiency;
- revenue;
- tags and utilities.

Equivalent aggregate routes are discoverable from `/stats/`. These are derived
views and must not be used as MSM's billing ledger.

## 7. Transactions and payments

### 7.1 Global provider ledger

`GET /transactions/`

Transaction records include:

- amount, category, currency and timestamp;
- provider reference and synchronization status;
- post-transaction account balance;
- customer, site, meter, user and agent associations;
- payment-provider fields;
- raw input/message fields;
- reversal relationships;
- optional STS token information.

Raw provider payload fields may contain sensitive or provider-specific content.
They must not be exposed to customer clients.

### 7.2 Customer transaction creation

`POST /customers/{customer_id}/transactions/`

The live OPTIONS schema marks only `category` as required. Relevant writable
fields include:

- `amount`;
- `category`;
- `timestamp`;
- `reference`;
- `raw_message`;
- `raw_input`;
- `payment_provider`;
- `reverses`;
- `meter_number`;
- `sts_token_info`.

Observed categories:

| Code | Meaning |
|---|---|
| PAY | Payment |
| DWN | Down-payment charge |
| LN | Loan-repayment charge |
| SUB | Subscription-plan charge |
| UCH | Usage charge |
| LIM | Usage-limit top-up charge |
| LIC | Usage-limit top-up cancellation |
| CON | Connection-fee charge |
| COF | Connection-fee paid marker |
| UCU | User credit update |
| FPA | Free-power adjustment |
| REV | Reversal |
| NBA | Negative-balance adjustment |

Observed `payment_provider` choices are Flutterwave and Sterling.

### 7.3 Invalid payments

`GET, POST /payments/invalid/`

Important fields include provider, reference, payment timestamp, raw input,
reason, amount, currency, customer/company association and STS token
information.

### 7.4 Unresolved financial guarantees

The API metadata does not confirm:

- whether `reference` is unique;
- whether an `Idempotency-Key` header is accepted or enforced;
- how duplicate, delayed or reordered payment submissions behave;
- whether `amount` adds credit, records money or represents another unit;
- authoritative reversal/refund sequencing;
- how STS tokens are issued, retrieved and invalidated;
- webhook availability and signature rules.

No live transaction was created during review.

## 8. Reports

`GET, POST /reports/`

Report records contain ID, name, author, type and a generic `params` object.
Observed parameters contain `date_from` and `date_to`.

Supported report types:

1. feeder hourly usage with meter breakdown;
2. feeder daily usage with meter breakdown;
3. site hourly usage with meter breakdown;
4. site daily usage with meter breakdown;
5. meter uptime by feeder;
6. meter uptime by site;
7. failed payments;
8. anomalous readings by feeder;
9. anomalous readings by site;
10. AMI readings output.

The record and detail schemas expose no status, completion timestamp, failure
reason or download URL. Output delivery requires vendor confirmation. No report
was generated during review.

## 9. Alerts, messages and directives

### 9.1 Alerts

`GET, POST /alerts/`

Verified alert types:

- meter bypass;
- illegal connection;
- payment transaction anomaly.

Alerts support high, medium and low priority plus open, closed and resolved
states. Filters are exposed for page, page size, creation range, state,
priority and description.

### 9.2 Messages

`GET /messages/` returns directories for agent, BitHarvester and customer
messages.

Nested customer message collections support GET and POST. Top-level
`/messages/` is not itself a message-creation endpoint.

### 9.3 Directives

The following all advertise read-only access:

- `/directives/`;
- `/directives-v2/`;
- `/meters/{meter_id}/directives/`.

Directive records expose category, nature, data, associated meter/customer,
message state, anomaly/suspicion flags and duplicate relationships.

The reviewed account possessed unsafe-command permission, but no directive
creation route was exposed. MSM must not infer a command endpoint or automate
connect/disconnect actions without a vendor-provided contract.

## 10. Filtering, pagination and history

Paginated collections normally use `count`, `next`, `previous` and `results`.
Several analytical routes return plain lists instead.

Verified filter behavior:

- transaction `created_after` filters the global ledger;
- transaction `category` filters the global ledger;
- alert filters are described in its OPTIONS response;
- `page_size` limits paginated responses.

The following candidate reading filters were silently ignored during safe
probes:

- `date_from`;
- `date_to`;
- `timestamp_after`;
- `timestamp_before`;
- `meter`;
- `is_anomalous`.

Clients must not assume that an accepted HTTP 200 means a query parameter was
applied. The current utility-reading endpoints appear to expose a recent
window. Historical and incremental retrieval require confirmation, most likely
through the AMI readings report or an undocumented filter contract.

## 11. Observed tenant snapshot

This section is operational evidence, not a permanent system inventory.

| Observation | Result |
|---|---:|
| Customers | 33 |
| Meters | 31 |
| Assigned meters | 5 |
| Unassigned meters | 26 |
| Customers without an observed meter assignment | 28 |
| Meters marked never online | 27 |
| Online meters | 1 |
| Provider transactions | 976 |
| Usage-charge transactions | 976 |
| Payment transactions | 0 |
| Meters in the current utility-reading stream | 2 |

The current site reading window contained 188 records from 19 to 26 October
2026. It had no anomaly flags, negative usage, duplicate meter timestamps,
register decreases or mismatches between 186 comparable register deltas and
`usage_amount`.

Only three customers had a non-empty `Monthly Tiers` payment plan and only two
had service tariff class A. The remaining observed payment-plan and tariff
class fields were blank.

## 12. MSM authority boundary

SteamaCo is authoritative for:

- provider meter identity and live state;
- raw provider readings and derived provider telemetry;
- provider-side customer balances and transactions;
- DLMS events and provider command outcomes;
- provider hardware and communications metadata.

MSM must be authoritative for:

- MSM users, roles and login-to-customer relationships;
- effective-dated meter assignment history;
- synchronized raw snapshots and ingestion cursors;
- validated consumption intervals and correction history;
- tariff versions and effective assignments;
- bills, adjustments and the MSM financial ledger;
- payment attempts and provider-credit attempts;
- reconciliation cases and approval history;
- customer-facing notification state;
- MSM audit and outbox records.

Payment gateways remain authoritative for captured, failed, reversed and
refunded money.

## 13. Vendor confirmation register

The following block production integration:

1. supported authentication lifetime and token-rotation policy;
2. rate limits, retry headers and concurrency limits;
3. sandbox and production separation;
4. stable field/version change policy;
5. exact payment/top-up request and response examples;
6. reference uniqueness and idempotency guarantees;
7. reversal, refund and STS-token lifecycle;
8. webhook event types, delivery guarantees and signatures;
9. reading retention, backfill, incremental filters and correction behavior;
10. tariff field semantics, units, rounding and effective dates;
11. report execution, status, retention and download delivery;
12. directive submission and outcome lifecycle;
13. tenant, site and user permission semantics;
14. source-data export and termination provisions.

## 14. Contract testing requirements

Before an upstream release is accepted, automated tests must verify:

- authentication and account scope;
- root-resource presence;
- schema compatibility for core read models;
- pagination and supported filters;
- timestamp, timezone, unit and decimal handling;
- transaction reference and idempotency behavior in sandbox;
- payment, reversal and failure scenarios;
- reading corrections and anomaly behavior;
- report creation and output retrieval;
- directive creation and outcome handling, when authorized.

Production mutation tests require a dedicated vendor sandbox or a named,
approved test customer and meter. They must never run against ordinary customer
accounts.
