# Meter Estate Cleanup Procedure

## 1. Objective

Produce one approved, effective-dated relationship between each billable
service account and its physical meter evidence before any shadow or live
billing run.

The 26 October 2026 provider snapshot is a discovery baseline, not a physical
asset audit. It showed 31 meters but only five observed assignments, with 27
meters marked Never Online. These conditions make estate cleanup a billing
prerequisite.

## 2. Controlled workbook

Use `customer_meter_assignment_register.template.csv` to create the working
register in an approved access-controlled location. Do not commit the populated
file to Git.

Required classifications for `meter_role`:

- `customer_load`;
- `grid_source`;
- `solar_source`;
- `generator_source`;
- `distribution_or_bulk`;
- `spare`;
- `retired`;
- `test`;
- `unknown`.

Required values for `review_status`:

- `unreviewed`;
- `investigating`;
- `ready_for_approval`;
- `approved`;
- `rejected`.

## 3. Cleanup workflow

### Step 1 — Export and protect

Export provider customer, meter, site and assignment identifiers using a
read-only service identity. Store the export outside Git and restrict it to the
approved operations and billing group.

### Step 2 — Reconcile meter identity

For every provider meter:

1. match the physical serial/reference;
2. match the asset register reference;
3. confirm site and precise location;
4. record manufacturer/model/phase in the asset system or evidence;
5. classify the meter role;
6. identify spare, removed, duplicated or unknown records.

### Step 3 — Verify installation and communication

For each installed meter, confirm:

- installation evidence and opening register;
- power and communications path;
- gateway/BitHarvester association where applicable;
- latest provider status and timestamp;
- at least two valid chronological readings for pilot candidates;
- any reset, replacement or commissioning event.

### Step 4 — Establish the service account

Do not use the provider customer record alone as the bill-to record. Create or
approve an internal service account with:

- customer reference;
- site;
- billing mode and currency;
- lifecycle dates;
- approved tariff version;
- controlled customer access mapping, if self-service is later enabled.

### Step 5 — Approve the assignment

Record an effective start and optional end. Operations confirms the physical
relationship; billing independently approves its use for charges. Historical
assignments are closed, not overwritten.

### Step 6 — Resolve exceptions

Use `meter_exception_register.csv` for the baseline categories. A row may be
approved only when its blocking exception has evidence or an authorized
non-billable classification.

## 4. Validation rules

The working register must reject or flag:

- duplicate provider meter IDs or physical serials without an approved reason;
- overlapping current billable assignments for one meter;
- overlapping primary-meter assignments for one service account unless an
  approved multi-meter policy exists;
- billable meters with role `unknown`, `spare`, `retired` or `test`;
- missing assignment start, service account, billing mode or tariff;
- assignment dates outside the installation epoch;
- customer-load meters mapped to a different site than the service account;
- billable meters without identity, installation and current-reading evidence;
- personal information copied into free-text notes.

## 5. Pilot selection rule

The first read-only pilot should include, where available:

- one grid/source or bulk meter;
- one solar/source meter;
- at least two customer-load meters with different usage patterns;
- only meters with verified physical identities and approved assignments;
- only meters producing fresh, sequential readings.

If the estate cannot meet these criteria, Phase 1 may still build the mirror
and exception screens, but billing certification cannot begin.

## 6. Sign-off evidence

The repository may record the following non-personal evidence after approval:

| Evidence | Required value |
|---|---|
| Controlled register checksum | SHA-256 or approved document version |
| Snapshot date | UTC date/time |
| Total provider meters | Count |
| Physically verified meters | Count |
| Billable assigned meters | Count |
| Source/bulk meters | Count by role |
| Open critical/high exceptions | Count |
| Operations approval | Role, date and evidence reference |
| Billing approval | Role, date and evidence reference |

Do not record customer names, contacts, addresses, credentials or raw payloads
in this repository.
