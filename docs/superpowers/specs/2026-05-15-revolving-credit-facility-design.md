# Revolving Credit Facility — Design Spec

**Date:** 2026-05-15  
**Status:** Approved for implementation  
**Approach:** Extend existing lead origination + dedicated facility management layer (Approach 3)

---

## 1. Overview

A revolving credit facility gives a borrower access to a pre-approved credit limit backed by a **Fineract savings account**. Unlike a term loan, the borrower can draw down, repay, and draw again within the limit. Loan Matrix owns the full lifecycle — origination, drawdown approvals, disbursements, and repayments.

### Key principles

- Origination reuses the existing lead wizard with minimal surgical changes
- All new revolving-specific logic lives in **new files** — minimal changes to working code
- The savings account in Fineract is the source of truth for balances; Loan Matrix drives all transactions
- Drawdown approvals mirror the existing lead approval pattern (StageApproval reuse)

---

## 2. Architecture

```
Lead (facilityType=REVOLVING_CREDIT)
  │
  ├── Lead origination wizard (client → affordability → loan → contracts)
  │     repayment schedule tab is hidden; savings product selected instead of loan product
  │
  ├── Pipeline stages (same engine: approve → activate_revolving)
  │     fineractAction="activate_revolving" opens savings account + deposits credit limit
  │
  └── RevolvingCreditFacility (1:1 with Lead, created on activation)
        ├── fineractSavingsAccountId
        ├── creditLimit
        ├── availableBalance (synced from Fineract)
        └── RevolvingCreditDrawdown[]
              ├── status: REQUESTED | APPROVED | DISBURSED | REJECTED
              ├── requestedAmount
              ├── approvedAmount
              ├── fineractTransactionId (set on disbursement)
              └── RepaymentTransaction[] (each deposit back to savings)
```

---

## 3. Data Model Changes

### 3.1 FacilityType enum

```prisma
enum FacilityType {
  TERM_LOAN
  INVOICE_DISCOUNTING
  REVOLVING_CREDIT        // new
}
```

### 3.2 New model: RevolvingCreditFacility

```prisma
model RevolvingCreditFacility {
  id                      String                    @id @default(cuid())
  leadId                  String                    @unique
  tenantId                String
  creditLimit             Float
  availableBalance        Float                     // synced from Fineract savings account balance
  fineractSavingsAccountId Int                      // Fineract savings account ID
  fineractSavingsAccountNo String?                  // display account number
  savingsProductId        Int                       // Fineract savings product used
  activatedAt             DateTime                  @default(now())
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @updatedAt
  lead                    Lead                      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tenant                  Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  drawdowns               RevolvingCreditDrawdown[]

  @@index([tenantId])
}
```

### 3.3 New model: RevolvingCreditDrawdown

```prisma
enum RevolvingCreditDrawdownStatus {
  REQUESTED
  APPROVED
  DISBURSED
  REJECTED
}

model RevolvingCreditDrawdown {
  id                      String                          @id @default(cuid())
  facilityId              String
  tenantId                String
  requestedAmount         Float
  approvedAmount          Float?
  disbursedAmount         Float?
  status                  RevolvingCreditDrawdownStatus   @default(REQUESTED)
  requestedByUserId       String
  requestedByUserName     String?
  approvedByUserId        String?
  approvedByUserName      String?
  disbursedByUserId       String?
  note                    String?
  fineractTransactionId   String?                         // set when withdrawal executes
  requestedAt             DateTime                        @default(now())
  approvedAt              DateTime?
  disbursedAt             DateTime?
  rejectedAt              DateTime?
  rejectionReason         String?
  createdAt               DateTime                        @default(now())
  updatedAt               DateTime                        @updatedAt
  facility                RevolvingCreditFacility         @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  repayments              RevolvingCreditRepayment[]

  @@index([facilityId])
  @@index([tenantId])
}
```

### 3.4 New model: RevolvingCreditRepayment

```prisma
model RevolvingCreditRepayment {
  id                      String                    @id @default(cuid())
  drawdownId              String
  facilityId              String
  tenantId                String
  amount                  Float
  recordedByUserId        String
  recordedByUserName      String?
  fineractTransactionId   String?                   // set when deposit executes
  note                    String?
  repaidAt                DateTime                  @default(now())
  createdAt               DateTime                  @default(now())
  drawdown                RevolvingCreditDrawdown   @relation(fields: [drawdownId], references: [id], onDelete: Cascade)

  @@index([facilityId])
  @@index([drawdownId])
}
```

### 3.5 Lead model additions

Two new fields on `Lead`:

```prisma
fineractSavingsAccountId  Int?      // set when savings account is opened on activation
revolving                 RevolvingCreditFacility?
```

### 3.6 Tenant model addition

```prisma
revolvingCreditFacilities RevolvingCreditFacility[]
```

---

## 4. Lead Origination Changes (surgical — existing files)

### 4.1 `new-lead-form.tsx`

- When facility type is `REVOLVING_CREDIT`, remove `"schedule"` from `tabOrder`
- Tab count and grid class adjustments follow the same `hideAffordability` pattern already in place

### 4.2 `loan-terms-form.tsx`

- When `facilityType === "REVOLVING_CREDIT"`, label the amount field "Credit Limit" instead of "Loan Amount"
- Hide interest rate / term / repayment frequency fields (not applicable to savings-backed facility)
- Show savings product selector (reuse the existing `savingsProductId` field on Lead)

### 4.3 `team-state-machine-service.ts` — `executeFineractAction`

Add one new `case` to the existing switch:

```ts
case "activate_revolving": {
  // 1. Create savings account for the client using savingsProductId from lead
  // 2. Approve & activate the savings account
  // 3. Deposit the credit limit as the opening balance
  // 4. Store fineractSavingsAccountId on Lead
  // 5. Create RevolvingCreditFacility record
  return `Revolving facility activated, savings account #${savingsAccountId} opened`;
}
```

No other changes to the state machine are needed.

---

## 5. Fineract Savings API Integration

All calls go through the existing `fineractService` / `fetchFineractAPI` pattern.

| Operation | Fineract endpoint |
|---|---|
| Create savings account | `POST /savingsaccounts` |
| Approve savings account | `POST /savingsaccounts/{id}?command=approve` |
| Activate savings account | `POST /savingsaccounts/{id}?command=activate` |
| Get account + balance | `GET /savingsaccounts/{id}` |
| Drawdown (withdrawal) | `POST /savingsaccounts/{id}/transactions?command=withdrawal` |
| Repayment (deposit) | `POST /savingsaccounts/{id}/transactions?command=deposit` |

A new `lib/fineract-savings-service.ts` file wraps these calls, keeping them out of the state machine and API routes.

---

## 6. New API Routes

All routes live under `app/api/leads/[id]/revolving/`.

| Route | Method | Purpose |
|---|---|---|
| `/revolving/facility` | GET | Fetch facility record + balance (syncs from Fineract) |
| `/revolving/drawdowns` | GET | List all drawdowns for a facility |
| `/revolving/drawdowns` | POST | Create a new drawdown request |
| `/revolving/drawdowns/[drawdownId]` | GET | Get single drawdown |
| `/revolving/drawdowns/[drawdownId]/approve` | POST | Approve drawdown (sets status=APPROVED) |
| `/revolving/drawdowns/[drawdownId]/disburse` | POST | Disburse drawdown (calls Fineract withdrawal, sets status=DISBURSED) |
| `/revolving/drawdowns/[drawdownId]/reject` | POST | Reject drawdown |
| `/revolving/drawdowns/[drawdownId]/repayments` | POST | Record a repayment (calls Fineract deposit) |

---

## 7. UI — New "Facility" Tab on Lead Detail Page

A new tab is added to `lead-detail-tabs.tsx` **only when** `lead.facilityType === "REVOLVING_CREDIT"`.

### 7.1 Facility summary card
- Credit limit
- Available balance (live from Fineract)
- Drawn amount
- Savings account number
- "Request Drawdown" button

### 7.2 Drawdown list
- Table of all drawdowns with status badges (REQUESTED / APPROVED / DISBURSED / REJECTED)
- Expandable row showing repayment history per drawdown
- Actions per row depending on status:
  - REQUESTED → Approve / Reject buttons (for authorised officers)
  - APPROVED → Disburse button
  - DISBURSED → Record Repayment button

### 7.3 Request Drawdown modal
- Amount input (validated against available balance)
- Note field
- Submit → creates drawdown with status REQUESTED

### 7.4 Approve Drawdown modal
- Shows requested amount, allows adjusting to approved amount
- Note field

### 7.5 Disburse Drawdown modal
- Shows approved amount
- Confirmation + note → calls Fineract withdrawal

### 7.6 Record Repayment modal
- Amount input
- Note field
- Calls Fineract deposit

---

## 8. Pipeline Stage Configuration

Tenants configure revolving credit facility pipeline stages the same way they configure any other lead pipeline. The only difference is the `fineractAction` value on the final activation stage:

| Stage name (suggested) | fineractAction |
|---|---|
| New Application | _(none)_ |
| Credit Review | _(none)_ |
| Approved | _(none — internal approval, no Fineract call needed)_ |
| Activated | `activate_revolving` (opens savings account + deposits credit limit) |
| Rejected | `reject` |

Only `activate_revolving` is a new `fineractAction` value. The Approved stage requires no Fineract call — savings accounts don't have a separate loan-approval step.

---

## 9. Error Handling

- If savings account creation fails during `activate_revolving`, the state transition is rolled back (lead stays on previous stage)
- If a drawdown withdrawal fails in Fineract, the drawdown stays in APPROVED status and the error is surfaced to the officer
- If a repayment deposit fails, the repayment record is not persisted and the error is returned to the UI
- Available balance is fetched fresh from Fineract on every `/revolving/facility` GET — no stale cache risk

---

## 10. Tenant Feature Flag

A new tenant setting `leadRevolvingCreditEnabled` (boolean, default `false`) gates the feature. When disabled, `REVOLVING_CREDIT` does not appear as a facility type option during lead creation. This follows the existing `leadAffordabilityOptional` pattern.

---

## 11. Files Changed vs. Files Added

### Changed (surgical, existing files)
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add enum value + 3 new models + 2 Lead fields |
| `lib/team-state-machine-service.ts` | Add `activate_revolving` and `approve_revolving` cases to switch |
| `app/(application)/leads/new/components/new-lead-form.tsx` | Hide schedule tab for REVOLVING_CREDIT |
| `app/(application)/leads/new/components/loan-terms-form.tsx` | Field label + visibility adjustments for REVOLVING_CREDIT |
| `app/(application)/leads/[id]/components/lead-detail-tabs.tsx` | Add Facility tab when facilityType=REVOLVING_CREDIT |

### Added (new files, zero regression risk)
| File | Purpose |
|---|---|
| `lib/fineract-savings-service.ts` | Wraps all Fineract savings API calls |
| `app/api/leads/[id]/revolving/facility/route.ts` | Facility fetch + balance sync |
| `app/api/leads/[id]/revolving/drawdowns/route.ts` | List + create drawdowns |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/approve/route.ts` | Approve drawdown |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/disburse/route.ts` | Disburse drawdown |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/reject/route.ts` | Reject drawdown |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/repayments/route.ts` | Record repayment |
| `app/(application)/leads/[id]/components/revolving-facility-tab.tsx` | Full facility tab UI |
| `app/(application)/leads/[id]/components/drawdown-request-modal.tsx` | Request drawdown modal |
| `app/(application)/leads/[id]/components/drawdown-approve-modal.tsx` | Approve drawdown modal |
| `app/(application)/leads/[id]/components/drawdown-disburse-modal.tsx` | Disburse drawdown modal |
| `app/(application)/leads/[id]/components/drawdown-repayment-modal.tsx` | Record repayment modal |
| `prisma/migrations/YYYYMMDD_revolving_credit_facility/migration.sql` | DB migration |

---

## 12. Out of Scope

- Revolving facility statements / export (future)
- Drawdown approval limits per team member (future — approvalLimit field already exists on TeamMember)
- USSD-initiated drawdown requests (future)
- Automatic credit limit reviews (future)
