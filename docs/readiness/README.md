# Meter Estate Readiness Pack

## 1. Purpose

This directory contains the non-personal baseline and controlled templates for
cleaning the customer and meter estate before billing begins.

The repository must not contain a live row-level export of customer names,
phone numbers, email addresses, addresses, payment details or raw provider
payloads. The working assignment register should be stored in an approved,
access-controlled business location. The template here defines its required
columns and validation rules.

## 2. Files

| File | Purpose |
|---|---|
| `estate_baseline.csv` | Aggregate, non-personal snapshot verified on 26 October 2026 |
| `meter_exception_register.csv` | Seeded exception categories and ownership |
| `customer_meter_assignment_register.template.csv` | Schema for the controlled row-level cleanup workbook |
| `METER_ESTATE_CLEANUP.md` | Cleanup method, validation rules and sign-off gate |

## 3. Handling rule

Create the live workbook from the template outside Git. Assign a controlled
document owner, restrict access to operations/billing staff, and record only a
checksum, approval date and summary counts back in this repository.
