# Revolving Credit Facility (RCF) — Design Spec

**Date:** 2026-05-19  
**Status:** Approved  
**Approach:** Hybrid — Separate Wizard, Shared Step Components (Approach C)

---

## Overview

Implement a Revolving Credit Facility product on top of Fineract savings accounts. The facility gives clients a reusable credit limit they can draw from and repay multiple times within a tenor. From a UX perspective the experience mirrors the existing term loan flow — same design language, same pipeline — but is served by a completely separate module to eliminate regression risk.

**Core mechanic:** A Fineract savings account backs each RCF. The credit limit is deposited as the opening balance on activation. Drawdowns are withdrawals; repayments are deposits. Available balance is read live from Fineract `summary.availableBalance`.

---

## Tenant Feature Flag

A `hasRevolvingCredit` boolean flag on the `Tenant` model (already exists in schema) gates the entire RCF surface area.

- **Flag OFF:** `/leads/new` redirects immediately to `/leads/new/loan`. Zero UI change for tenants without RCF. Existing flow is untouched.
- **Flag ON:** `/leads/new` renders the product selection screen.

The tenant settings page gets a single new toggle: **"Revolving Credit Facility"** under the features/products section.

---

## Route Structure

```
app/(application)/leads/new/
├── page.tsx                            NEW: product selector (gated by hasRevolvingCredit)
├── loan/                               MOVED: existing wizard, zero code changes
│   ├── page.tsx
│   └── components/
│       ├── new-lead-form.tsx           (unchanged)
│       └── ...all existing files
└── rcf/                                NEW: RCF wizard
    ├── page.tsx
    └── components/
        ├── rcf-lead-form.tsx           wizard shell (4 tabs)
        ├── rcf-facility-terms-form.tsx new step
        └── rcf-contracts.tsx           thin wrapper — imports shared LoanContracts

app/(application)/leads/[id]/
└── components/
    └── lead-detail-tabs.tsx            ADD: "Facility" tab, shown only when facilityType === REVOLVING_CREDIT

app/(application)/clients/[id]/
└── savings/
    └── [savingsId]/                    NEW: mirrors /clients/[id]/loans/[loanId]/
        ├── page.tsx
        └── components/
            ├── savings-overview.tsx
            ├── drawdown-list.tsx
            ├── repayment-list.tsx
            └── transaction-log.tsx

app/api/leads/[id]/
├── facility/
│   ├── route.ts                        GET: facility record + live Fineract balance
│   ├── drawdown/route.ts               POST: disburse drawdown (savings withdrawal)
│   └── repayment/route.ts              POST: record repayment (savings deposit)
└── savings/[savingsId]/route.ts        GET: /savingsaccounts/{id}?associations=all
```

**Shared components — imported, never copied:**
- `ClientRegistrationForm` — step 1 of both wizards
- `AffordabilityForm` — step 2 of both wizards
- `LoanContracts` — final step of both wizards (RCF uses its own template)

---

## Product Selection Page (`/leads/new`)

Rendered only when `hasRevolvingCredit === true`. Two cards side by side:

| Card | Icon | Title | Description | Key Attributes |
|------|------|-------|-------------|----------------|
| Left | receipt | Term Loan | Fixed repayment schedule | Fixed amount, Fixed term, Amortization schedule |
| Right | refresh | Revolving Credit | Reusable credit limit | Flexible drawdowns, Restores on repayment, Up to 10 tranches |

Selecting a card navigates to `/leads/new/loan` or `/leads/new/rcf` respectively.

---

## RCF Lead Creation Wizard (`/leads/new/rcf`)

4-tab wizard using the same Radix UI `Tabs` shell pattern as the term loan form.

| # | Tab | Component | Source |
|---|-----|-----------|--------|
| 1 | Client Details | `ClientRegistrationForm` | Shared import |
| 2 | Affordability | `AffordabilityForm` | Shared import (skippable per tenant setting) |
| 3 | Facility Terms | `RcfFacilityTermsForm` | New |
| 4 | Contracts | `LoanContracts` | Shared import, RCF template |

The lead record is created in our DB on wizard initialisation with `facilityType: REVOLVING_CREDIT` — same pattern as the term loan wizard.

### Facility Terms Form Fields

| Field | Type | Notes |
|-------|------|-------|
| Credit Limit | Number | Becomes savings account opening balance on activation |
| Savings Product | Select | `GET /savingsaccounts/template?clientId={id}` → `productOptions` |
| Interest Rate | Number | Pre-filled from product, editable |
| Tenor | Number (months) | Facility duration |
| Max Drawdowns | Number | Default 10, min 1. Enforced in our DB (Fineract has no native withdrawal count limit) |
| Disbursement Date | Date | When activation triggers |

---

## Approval Pipeline

RCF leads flow through the **same shared pipeline stages** as term loans (configured in admin). No separate pipeline config is needed.

The final disbursement stage is configured with `fineractAction: "activate_revolving"` which triggers the existing `activateRevolvingFacility` method in `team-state-machine-service.ts`:

1. Create Fineract savings account (`POST /savingsaccounts`)
2. Approve (`POST /savingsaccounts/{id}?command=approve`)
3. Activate (`POST /savingsaccounts/{id}?command=activate`)
4. Deposit credit limit as opening balance (`POST /savingsaccounts/{id}/transactions?command=deposit`)
5. Store `fineractSavingsAccountId` on Lead, create `RevolvingCreditFacility` record

The lead detail approval UI is unchanged. Stage action buttons remain the same — the pipeline label drives copy where needed.

---

## Facility Tab (Lead Detail Page)

Visible only when `facilityType === REVOLVING_CREDIT` AND `RevolvingCreditFacility` record exists (i.e. facility is activated).

### Summary Row (4 stat cards)

| Stat | Source |
|------|--------|
| Credit Limit | `RevolvingCreditFacility.creditLimit` (our DB) |
| Utilized Amount | `creditLimit - availableBalance` |
| Available Balance | Fineract `summary.availableBalance` (live) |
| Drawdowns Used | `count(drawdowns) / maxDrawdowns` e.g. "2 / 10" |

### Drawdowns Table

Columns: Date | Amount | Status | Officer | Actions  
Top-right: **"Request Drawdown"** button — disabled with tooltip when `drawdownCount >= maxDrawdowns` or `availableBalance <= 0`.

### Repayments Table

Columns: Date | Amount | Recorded By | Fineract Transaction Ref  
Top-right: **"Record Repayment"** button.

### Link

A "View Savings Account" link navigates to `/clients/{clientId}/savings/{savingsId}`.

---

## Drawdown Flow

Officer clicks **"Request Drawdown"** → modal opens:

| Field | Notes |
|-------|-------|
| Amount | Required. Validated: must be ≤ `availableBalance` |
| Transaction Date | Defaults to today |
| Note | Optional |

On submit → `POST /api/leads/[id]/facility/drawdown`:

1. Validate: `drawdownCount < maxDrawdowns`, `amount <= availableBalance`, facility active
2. Call Fineract: `POST /savingsaccounts/{savingsId}/transactions?command=withdrawal`  
   Body: `{ transactionDate, transactionAmount, locale, dateFormat }`
3. Create `RevolvingCreditDrawdown` record (`status: DISBURSED`, `fineractTransactionId` from response)
4. Sync `availableBalance` on `RevolvingCreditFacility` from Fineract response

Single-step, officer-initiated — no separate approval for individual drawdowns.

---

## Repayment Flow

Officer clicks **"Record Repayment"** → modal opens:

| Field | Notes |
|-------|-------|
| Amount | Required |
| Date | Defaults to today |
| Note | Optional |

On submit → `POST /api/leads/[id]/facility/repayment`:

1. Call Fineract: `POST /savingsaccounts/{savingsId}/transactions?command=deposit`  
   Body: `{ transactionDate, transactionAmount, locale, dateFormat }`
2. Create `RevolvingCreditRepayment` record (`fineractTransactionId` from response)
3. Sync `availableBalance` on `RevolvingCreditFacility`

---

## Savings/Facility Detail Page (`/clients/[id]/savings/[savingsId]`)

Mirrors `/clients/[id]/loans/[loanId]/` in structure and design. Four tabs:

| Tab | Content | Data Source |
|-----|---------|-------------|
| Overview | Account metadata, balance summary cards, savings account status | `GET /savingsaccounts/{id}?associations=all` + our DB |
| Drawdowns | Full drawdown history table | Our DB (`RevolvingCreditDrawdown`) |
| Repayments | Full repayment history table | Our DB (`RevolvingCreditRepayment`) |
| Transactions | Raw Fineract transaction log | Fineract `transactions` from `associations=all` |

---

## Schema Changes Required

The existing schema already has `RevolvingCreditFacility`, `RevolvingCreditDrawdown`, `RevolvingCreditRepayment` models and `FacilityType` enum. One addition needed:

```prisma
model RevolvingCreditFacility {
  // existing fields ...
  maxDrawdowns  Int  @default(10)   // ADD: configurable per facility
}
```

---

## Fineract API Reference (Savings)

| Action | Method | Endpoint | Key Body Fields |
|--------|--------|----------|-----------------|
| Create account | POST | `/savingsaccounts` | `clientId`, `productId`, `submittedOnDate` |
| Approve | POST | `/savingsaccounts/{id}?command=approve` | `approvedOnDate` |
| Activate | POST | `/savingsaccounts/{id}?command=activate` | `activatedOnDate` |
| Drawdown | POST | `/savingsaccounts/{id}/transactions?command=withdrawal` | `transactionDate`, `transactionAmount` |
| Repayment | POST | `/savingsaccounts/{id}/transactions?command=deposit` | `transactionDate`, `transactionAmount` |
| Get details | GET | `/savingsaccounts/{id}?associations=all` | — |
| Block drawdowns | POST | `/savingsaccounts/{id}?command=blockDebit` | `reasonForBlock` |

Date format throughout: `"dd MMMM yyyy"` e.g. `"19 May 2026"` — matches existing `formatFineractDate()` util.

---

## What Is NOT Changing

- `lib/team-state-machine-service.ts` — no changes (activate_revolving already implemented)
- `lib/fineract-savings-service.ts` — no changes (all needed methods exist)
- `app/(application)/leads/new/loan/` — zero changes (moved, not modified)
- Existing approval/pipeline UI — no changes
- All existing term loan flows — untouched
