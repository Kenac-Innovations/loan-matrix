# Credit Facility — Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Approach:** Pure Fineract Datatables (Approach A)

---

## Overview

Implement a Credit Facility feature that groups multiple real Fineract loans under a single umbrella with a shared credit limit, expiry, and drawdown tranche cap. This is distinct from the existing Revolving Credit Facility (RCF), which uses a Fineract savings account for drawdowns and repayments.

| | Existing RCF | Credit Facility |
|---|---|---|
| Drawdowns | Fineract savings withdrawals | Real Fineract loans |
| Repayments | Savings deposits | Standard loan repayments |
| Backbone | Fineract savings account | Fineract loans + datatables |
| Per-drawdown approval | No | Yes — each loan goes through the full pipeline |

**No new Prisma models or columns.** All facility domain data lives in Fineract datatables. Next.js enforces all business rules.

**What is NOT changing:**
- Existing RCF module — zero changes
- Existing term loan flow — zero changes
- Prisma schema — no new models, no new columns
- State machine pipeline config — no new stages

---

## Fineract Datatables (Data Model)

Two datatables must be registered once per Fineract instance before the feature is usable.

### Datatable 1: `credit_facility` — on `m_client` (multi-row)

Stores the facility itself. Multi-row allows a client to have a history of facilities (closed ones + current active).

| Column | Type | Notes |
|---|---|---|
| `facility_ref` | String(50) | Generated cuid — the cross-reference key used by loans |
| `credit_limit` | Decimal | Maximum total disbursable amount |
| `tenor_months` | Number | Facility duration in months |
| `drawdown_tranches` | Number | Maximum number of loan disbursements allowed |
| `currency_code` | String(10) | e.g. "USD", "ZWL" |
| `utilized_amount` | Decimal | Cached sum of disbursed loan amounts; starts at 0 |
| `disbursed_tranches` | Number | Cached count of disbursed loans; starts at 0 |
| `status` | String(10) | `PENDING` → `ACTIVE` → `CLOSED` |
| `created_date` | Date | Facility creation date — used for expiry calculation |

Fineract automatically adds:
- `id` — auto-increment row ID (used for PUT/DELETE)
- `client_id` — FK to `m_client`

**Derived values (calculated in code, not stored):**
- Available balance = `credit_limit - utilized_amount`
- Expiry date = `created_date + tenor_months`

### Datatable 2: `credit_facility_loan` — on `m_loan` (single-row)

Tags a Fineract loan as belonging to a specific facility. Each loan has at most one entry.

| Column | Type | Notes |
|---|---|---|
| `facility_ref` | String(50) | References `credit_facility.facility_ref` |

Fineract automatically adds:
- `id` — auto-increment row ID
- `loan_id` — FK to `m_loan`

---

## Loan Creation Flow

A **"Link to Credit Facility"** toggle is added to the new loan form (off by default — normal loan behaviour unchanged).

### Toggle ON — client has NO active facility

The form expands with facility creation fields:

| Field | Notes |
|---|---|
| Credit Limit | Decimal input |
| Tenor (months) | Number input |
| Max Drawdown Tranches | Number input |
| Currency | Select — pre-filled from loan currency |

**On submit:**
1. Create the Fineract loan normally
2. `POST /datatables/credit_facility/{clientId}` — create facility row (status: `PENDING`, utilized_amount: 0, disbursed_tranches: 0, created_date: today, facility_ref: generated cuid)
3. `POST /datatables/credit_facility_loan/{loanId}` — link the loan (facility_ref)

### Toggle ON — client already HAS an active facility

The form shows a read-only facility summary card:

```
Credit Facility — ACTIVE
Limit: $100,000  |  Available: $70,000  |  Tranches: 2 / 5  |  Expires: Nov 2026
```

**Pre-creation validation (server-side, before anything is created in Fineract):**

| Check | Condition | Error |
|---|---|---|
| Facility active | `status === ACTIVE` | "Facility is not active" |
| Not expired | `today < created_date + tenor_months` | "Credit facility has expired" |
| Credit limit | `loan_amount ≤ credit_limit - utilized_amount` | "Amount exceeds available facility balance ($X)" |
| Tranche limit | `disbursed_tranches < drawdown_tranches` | "Maximum drawdown tranches reached (X / X)" |

If all pass:
1. Create the Fineract loan normally
2. `POST /datatables/credit_facility_loan/{loanId}` — link the loan (facility_ref)
3. No new `credit_facility` row — facility already exists

### Toggle OFF

Normal loan. No datatable entries created. Zero facility involvement.

---

## Approval Flow (Facility Activation)

In the existing loan approval server action, append this logic after the Fineract loan approval call:

1. `GET /datatables/credit_facility_loan/{loanId}` — check if a `facility_ref` exists
2. If yes → `GET /datatables/credit_facility/{clientId}` — find row with matching `facility_ref`
3. If that row has `status: PENDING` → `PUT /datatables/credit_facility/{clientId}/{id}` — set `status: ACTIVE`
4. If already `ACTIVE` (subsequent loan linked to existing facility) — do nothing

No new state machine stages. No Prisma changes.

**Facility lifecycle:**

```
Loan submitted  →  Facility created (PENDING)
Loan approved   →  Facility activated (ACTIVE)
Loans disbursed →  utilized_amount & disbursed_tranches updated
Exhausted/manual close → CLOSED
```

---

## Disbursement Flow (Validation + Counter Updates)

In the existing loan disbursement server action, prepend this logic:

### Pre-disbursement validation

1. `GET /datatables/credit_facility_loan/{loanId}` — get `facility_ref` (if none → normal loan, skip all checks)
2. `GET /datatables/credit_facility/{clientId}` — find row matching `facility_ref`
3. Run all four checks:

| Check | Condition | Error |
|---|---|---|
| Facility active | `status === ACTIVE` | "Facility is not active" |
| Not expired | `today < created_date + tenor_months` | "Credit facility has expired" |
| Credit limit | `utilized_amount + loan_amount ≤ credit_limit` | "Disbursement would exceed facility credit limit (available: $X)" |
| Tranche limit | `disbursed_tranches < drawdown_tranches` | "Maximum drawdown tranches reached (X / X)" |

If any check fails → block disbursement, return error. Fineract is not called.

### Post-disbursement update

After successful Fineract disbursement:

```
PUT /datatables/credit_facility/{clientId}/{id}
{
  "utilized_amount": <old + loan_amount>,
  "disbursed_tranches": <old + 1>
}
```

**Auto-close:** If after update `utilized_amount >= credit_limit` OR `disbursed_tranches >= drawdown_tranches` → also set `status: CLOSED`.

---

## UI Changes

### Lead Detail Page

A **facility info banner** below the lead header — visible only when the lead's loan has a `credit_facility_loan` datatable entry:

```
┌──────────────────────────────────────────────┐
│  Credit Facility — ACTIVE                    │
│  Limit: $100,000  |  Available: $90,000      │
│  Tranches: 1 / 5  |  Expires: May 2027       │
└──────────────────────────────────────────────┘
```

Small info card/banner — communicates "this loan is under a facility" at a glance.

### Loan Detail Page

A **"Credit Facility" section** in the loan overview:

| Field | Value |
|---|---|
| Facility Status | ACTIVE |
| Credit Limit | $100,000 |
| Available Balance | $90,000 |
| Utilized | $10,000 |
| Tranches Used | 1 / 5 |
| Expires | May 2027 |

Only rendered when `credit_facility_loan` datatable entry exists for the loan.

### Client Detail Page — New "Facility" Tab

New tab alongside existing Loans / Savings / Documents tabs.

**Facility Details card (top):**

| Field | Value |
|---|---|
| Status | ACTIVE |
| Credit Limit | $100,000 |
| Available Balance | $70,000 |
| Utilized Amount | $30,000 |
| Tranches Used | 2 / 5 |
| Created | May 2026 |
| Expires | May 2027 |

**Loans Under This Facility table (bottom):**

| Loan # | Amount | Status | Disbursed Date | Officer |
|---|---|---|---|---|
| #00123 | $10,000 | Active | 01 May 2026 | John |
| #00145 | $20,000 | Active | 10 May 2026 | Jane |

Each row links to the loan detail page.

**Data fetching strategy:**
1. `GET /datatables/credit_facility/{clientId}` → find ACTIVE facility row
2. `GET /loans?clientId={clientId}` → fetch client's loans
3. For each loan → `GET /datatables/credit_facility_loan/{loanId}` → filter to those with matching `facility_ref`

---

## Datatable Setup (One-Time Per Tenant)

A server action `setupCreditFacilityDatatables(tenantId)` is exposed via a button in tenant settings (admin only): **"Initialize Credit Facility"**.

The action posts both datatable registrations to Fineract. It is idempotent — if a datatable already exists, Fineract returns a conflict error which the action catches and ignores.

**Registration payload — `credit_facility`:**
```json
{
  "datatableName": "credit_facility",
  "apptableName": "m_client",
  "multiRow": true,
  "columns": [
    { "name": "facility_ref",       "type": "String",  "length": 50, "mandatory": true },
    { "name": "credit_limit",       "type": "Decimal",               "mandatory": true },
    { "name": "tenor_months",       "type": "Number",                "mandatory": true },
    { "name": "drawdown_tranches",  "type": "Number",                "mandatory": true },
    { "name": "currency_code",      "type": "String",  "length": 10, "mandatory": true },
    { "name": "utilized_amount",    "type": "Decimal",               "mandatory": true },
    { "name": "disbursed_tranches", "type": "Number",                "mandatory": true },
    { "name": "status",             "type": "String",  "length": 10, "mandatory": true },
    { "name": "created_date",       "type": "Date",                  "mandatory": true }
  ]
}
```

**Registration payload — `credit_facility_loan`:**
```json
{
  "datatableName": "credit_facility_loan",
  "apptableName": "m_loan",
  "multiRow": false,
  "columns": [
    { "name": "facility_ref", "type": "String", "length": 50, "mandatory": true }
  ]
}
```

---

## Fineract API Reference

| Action | Method | Endpoint | Notes |
|---|---|---|---|
| Register datatable | POST | `/datatables` | One-time setup |
| Create facility | POST | `/datatables/credit_facility/{clientId}` | On first facility loan submission |
| Get facility | GET | `/datatables/credit_facility/{clientId}` | Returns array (multi-row); filter by facility_ref or status |
| Update facility | PUT | `/datatables/credit_facility/{clientId}/{id}` | Update status, utilized_amount, disbursed_tranches |
| Link loan | POST | `/datatables/credit_facility_loan/{loanId}` | On facility-linked loan creation |
| Get loan link | GET | `/datatables/credit_facility_loan/{loanId}` | Check if loan belongs to a facility |

---

## What Is NOT Changing

- `prisma/schema.prisma` — no additions
- RCF module (`app/actions/rcf-actions.ts`, savings service, RCF UI) — untouched
- Existing term loan creation wizard — untouched
- State machine pipeline stages — no new stages or fineractActions
- All existing approval/disbursement flows — existing logic runs first; facility logic is appended/prepended
