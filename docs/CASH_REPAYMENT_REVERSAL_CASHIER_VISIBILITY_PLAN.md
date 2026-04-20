# Cash Repayment Reversal → Cashier Visibility: Implementation Plan

## Summary

When a cash loan repayment is reversed, the cashier transaction history should show a compensating reversal entry so the cashier's visible history and balance movement remain understandable.

Today, Loan Matrix records the original cash repayment into the cashier flow, but repayment undo only reverses the loan transaction in Fineract. It does not create or surface a matching cashier-side reversal entry. As a result, users still see the original cash-in repayment row, but nothing new appears under cashier transactions when that repayment is cancelled.

This document covers:
- the current gap,
- the target behavior,
- the recommended implementation,
- the data flow for create and undo,
- rollout, testing, and edge cases.

---

## Problem Statement

### What users expect

If a cashier receives a cash repayment and that repayment is later cancelled or undone, the cashier transaction history should show:

1. the original cash-in repayment entry, and
2. a compensating reversal entry that removes that cash effect.

This is the same mental model users already see for reversed loan payouts.

### What happens today

1. A cash repayment is posted to Fineract loan transactions.
2. Loan Matrix/Fineract adds a cashier-side cash-in entry for the repayment.
3. Later, the repayment is undone on the loan side.
4. No cashier reversal entry is created or merged into the cashier history.

### Result

- The cashier page still shows the original repayment cash-in.
- Nothing new appears when the repayment is cancelled.
- Users think the system failed to reflect the cancellation.
- The transaction history becomes misleading even when the loan transaction itself is reversed.

---

## Root Cause

There are two separate flows today:

### Cash repayment creation

The repayment route posts the loan repayment to Fineract and, for cash payment types, also allocates cash to the cashier.

This is implemented in:
- `app/api/fineract/loans/[id]/transactions/route.ts`

### Repayment undo

The repayment undo flow only calls:
- `POST /loans/{loanId}/transactions/{transactionId}?command=undo`

This is implemented in:
- `lib/bulk-repayment-reverse.ts`

There is no follow-up logic to:
- create a compensating cashier transaction,
- create a local repayment-reversal record, or
- merge repayment reversals into the cashier transactions API.

### Cashier history behavior

The cashier transactions page already has special merging logic for reversed payouts only.

This is implemented in:
- `app/api/tellers/[id]/cashiers/[cashierId]/transactions/route.ts`

It merges reversed `loanPayout` records, but there is no equivalent handling for reversed cash repayments.

---

## Goals

### Primary goal

When a cash repayment is reversed, the cashier transactions page must show a reversal entry for that repayment.

### Secondary goals

- Preserve a clear audit trail.
- Keep payout reversal behavior unchanged.
- Avoid double-counting reversal entries.
- Support both direct repayment reversals and bulk repayment reversals.
- Keep the cashier page understandable for users and support staff.

### Non-goals

- Redesigning the whole teller/cashier accounting model.
- Rebuilding historical cashier balances from scratch.
- Changing how non-cash repayment reversals behave.

---

## Desired Behavior

For a reversed cash repayment:

1. The original repayment row remains in history.
2. A second row appears showing that the repayment was reversed.
3. The reversal row should be clearly labeled, for example:
   - `Reversal (Cash Out)` or
   - `Repayment Reversed`
4. The reversal row should include:
   - amount,
   - date/time of reversal,
   - cashier,
   - note/reason where available.

### Important UX note

The reversal entry should negate the original cash-in effect.

That means the repayment reversal should behave like cash leaving the cashier drawer, because the original repayment had previously increased the cashier's cash position.

---

## Recommended Approach

## Recommendation

Implement a local repayment-reversal tracking record in Loan Matrix, and merge those records into the cashier transaction history API, similar to reversed payouts.

### Why this is the recommended approach

- Fineract undo does not reliably create a matching cashier transaction entry for reversed repayments.
- We already use synthetic transaction merging for reversed payouts.
- Loan Matrix needs a source of truth for cashier-visible repayment reversals.
- This gives us control over labels, notes, timestamps, and filtering behavior.

### Alternative approaches considered

#### Option A: Depend entirely on Fineract cashier transactions

Do nothing in Loan Matrix, and expect Fineract to create a cashier reversal entry on undo.

Why not recommended:
- Production investigation shows this does not happen reliably for repayment undo.
- We cannot depend on behavior that is missing in live data.

#### Option B: Query reversed loan transactions directly from Fineract every time and infer cashier reversals on the fly

Why not recommended:
- Hard to reliably associate reversal to the original cashier/teller context unless we store it locally.
- More expensive and more complex to reason about.
- Harder to support multiple repayment entry paths consistently.

#### Option C: Persist local repayment-reversal metadata and merge into cashier history

Why recommended:
- Reliable.
- Auditable.
- Consistent with current payout-reversal strategy.
- Works even when Fineract lacks a cashier reversal record.

---

## Proposed Design

## New concept

Introduce a local record for reversed cash repayments.

Two implementation styles are possible:

### Option 1: New dedicated model

Example: `CashRepaymentReversal`

Suggested fields:
- `id`
- `tenantId`
- `loanId`
- `fineractLoanTxnId`
- `cashierId`
- `tellerId`
- `amount`
- `currency`
- `reversedAt`
- `reversedBy`
- `reason`
- `paymentTypeId`
- `paymentTypeName`
- `createdAt`
- `updatedAt`

### Option 2: Extend existing `BulkRepaymentItem` only

Use existing bulk repayment reversal metadata when available, and create no reusable generic reversal model.

Why this is weaker:
- Only covers bulk reversal use cases cleanly.
- Does not support non-bulk/manual repayment reversals well.
- Couples cashier history to collections-specific data structures.

## Recommendation

Use **Option 1: a dedicated model**.

That gives one clean abstraction for:
- bulk repayment undo,
- future manual repayment undo,
- possible admin repair scripts,
- cashier history merging.

---

## Data Model Plan

## New Prisma model

Suggested model:

```prisma
model CashRepaymentReversal {
  id                 String   @id @default(cuid())
  tenantId           String
  loanId             Int
  fineractLoanTxnId  String?
  cashierId          String?
  tellerId           String?
  amount             Decimal  @db.Decimal(19, 4)
  currency           String
  reason             String?
  reversedAt         DateTime
  reversedBy         String?
  paymentTypeId      Int?
  paymentTypeName    String?
  source             String?  // BULK_UNDO, MANUAL_UNDO, SCRIPT, etc.
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([tenantId, cashierId, reversedAt])
  @@index([tenantId, loanId])
  @@index([fineractLoanTxnId])
}
```

### Why `cashierId` and `tellerId` are optional

Some older repayments may not have enough local context to resolve both. We should still allow recording a reversal and use best-effort cashier linking where possible.

---

## Implementation Phases

## Phase 1: Persist repayment-reversal records

### Scope

Update the repayment undo flow so that when a cash repayment is successfully undone, Loan Matrix creates a local `CashRepaymentReversal` record.

### Files likely involved

- `lib/bulk-repayment-reverse.ts`
- `lib/bulk-repayment-reversal-queue-service.ts`
- Prisma schema + migration

### Required steps

1. Add the new Prisma model and migration.
2. After successful Fineract undo, determine whether the original repayment was cash.
3. Resolve teller/cashier context for that repayment.
4. Create one `CashRepaymentReversal` record.
5. Make the operation idempotent.

### Idempotency rule

Prevent duplicate reversal records for the same repayment undo.

Recommended uniqueness rule:
- unique by `tenantId + fineractLoanTxnId + source`
or
- unique by `tenantId + loanId + reversedAt + amount + cashierId` if needed.

Best option:
Add an explicit unique index for the source repayment transaction when possible.

---

## Phase 2: Merge repayment reversals into cashier history

### Scope

Update the cashier transactions API to fetch and merge `CashRepaymentReversal` records for the cashier, similar to reversed payouts.

### File

- `app/api/tellers/[id]/cashiers/[cashierId]/transactions/route.ts`

### Required steps

1. Query local `CashRepaymentReversal` rows for the cashier.
2. Convert them into synthetic transaction objects shaped like Fineract cashier transactions.
3. Merge them into `cashierTransactions.pageItems`.
4. Sort by date descending.

### Synthetic transaction shape

Recommended mapping:

- `id`: `repayment-reversal-${record.id}`
- `txnType.value`: `Repayment Reversed`
- `transactionType.code`: `REPAYMENT_REVERSAL`
- `txnAmount`: amount
- `txnDate` / `createdDate` / `transactionDate`: reversal date
- `txnNote`: `Reversal - ${reason || "Cash repayment reversed"}`
- `_isRepaymentReversal`: true

### Transaction label behavior

The UI should show this as a negative cash effect.

Recommended cashier label:
- `Reversal (Cash Out)`

That is the clearest user-facing meaning.

---

## Phase 3: Update cashier transaction page labels

### Scope

Teach the cashier UI page to display repayment reversal rows clearly.

### File

- `app/(application)/tellers/[id]/cashiers/[cashierId]/transactions/page.tsx`

### Required steps

1. Add detection for `_isRepaymentReversal`.
2. Map it to a distinct badge/label.
3. Ensure export uses the same label.
4. Keep current payout reversal behavior unchanged.

### Recommended labels

- For payout reversal: `Reversal (Cash In)`
- For repayment reversal: `Reversal (Cash Out)`

This avoids ambiguity and reflects the cash direction correctly.

---

## Phase 4: Backfill and repair support

### Scope

Because production already contains reversed cash repayments with no local reversal record, we need a safe way to backfill them.

### Recommended backfill strategy

1. Query reversed Fineract loan transactions where:
   - transaction type is repayment,
   - payment type is cash,
   - no corresponding local `CashRepaymentReversal` exists.
2. Resolve cashier/teller context from available app data or known repayment flow metadata.
3. Insert synthetic reversal records into `CashRepaymentReversal`.

### Deliverable

A one-off script, for example:
- `scripts/backfill-cash-repayment-reversals.ts`

### Important constraint

Backfill should be dry-run capable before writing anything.

---

## End-to-End Flow

## Flow A: Cash repayment creation

### Current and expected behavior

1. User submits repayment.
2. Loan Matrix posts repayment to Fineract loan transaction API.
3. If payment type is cash:
   - Loan Matrix calls `allocateCashToCashier(...)`.
4. Cashier history shows a `Cash In` row for the repayment.

### Flow diagram

```text
Repayment UI
  -> POST /api/fineract/loans/{loanId}/transactions?command=repayment
  -> Fineract creates loan repayment
  -> Loan Matrix checks payment type
  -> If cash:
       -> Fineract allocateCashToCashier(...)
       -> cashier history gets cash-in effect
```

---

## Flow B: Cash repayment reversal

### Target behavior

1. User/admin/system triggers repayment undo.
2. Loan Matrix calls Fineract undo for the repayment.
3. If Fineract undo succeeds:
   - Loan Matrix confirms the original repayment was cash.
   - Loan Matrix creates local `CashRepaymentReversal`.
4. Cashier transactions API merges that record into the cashier history.
5. UI shows a `Reversal (Cash Out)` row.

### Flow diagram

```text
Undo action
  -> Loan Matrix resolves undoable repayment transaction
  -> POST Fineract /loans/{loanId}/transactions/{transactionId}?command=undo
  -> Fineract reverses the loan transaction
  -> Loan Matrix checks original repayment payment type
  -> If original repayment was cash:
       -> create CashRepaymentReversal locally
  -> Cashier transactions API loads Fineract cashier rows
  -> Cashier transactions API merges local repayment reversals
  -> UI shows reversal row as Reversal (Cash Out)
```

---

## Flow C: Cashier transactions page load

### Target merged data sources

1. Base Fineract cashier transactions
2. Reversed payout synthetic rows
3. Reversed repayment synthetic rows

### Flow diagram

```text
Cashier Transactions Page
  -> GET /api/tellers/{tellerId}/cashiers/{cashierId}/transactions
  -> fetch Fineract summary + cashierTransactions
  -> fetch local reversed payouts
  -> fetch local cash repayment reversals
  -> map local records into synthetic transaction rows
  -> merge all rows
  -> sort descending by date
  -> return unified response
```

---

## Detailed Logic Rules

## Rule 1: Only cash repayments create repayment-reversal cashier rows

If the original repayment was not cash, do not create `CashRepaymentReversal`.

## Rule 2: Only successful loan undo creates a repayment-reversal record

If Fineract undo fails, do not create a local reversal row.

## Rule 3: Repayment reversal rows should be append-only

Do not mutate or delete the original repayment cash-in row. Add a separate reversal row for auditability.

## Rule 4: Use reversal timestamp, not original repayment timestamp

The reversal entry should appear at the time the reversal happened, not when the original repayment happened.

## Rule 5: Use best-effort reason text

Priority:
1. explicit user/admin reason,
2. Fineract reversal note if available,
3. fallback text such as `Cash repayment reversed`.

---

## Technical Design Details

## How to determine whether original repayment was cash

Recommended approach:

1. Look up the original Fineract loan transaction.
2. Join through `payment_detail_id`.
3. Read `payment_type_id`.
4. Determine `is_cash_payment`.

This should happen in the undo orchestration layer before creating a local reversal record.

## How to resolve cashier and teller for reversal

Preferred order:

1. Use stored app-side context if available from the original repayment flow.
2. If the reversal originated from bulk repayment records and those records include enough context, use that.
3. If not available, infer from known repayment/cashier allocation linkage.
4. If still unresolved:
   - create reversal record without cashier/teller only if necessary, or
   - log and skip if the cashier page depends on that relation.

## Recommendation

Do not silently guess a random cashier. If cashier resolution is ambiguous, log it and leave the record unmatched until manually repaired.

---

## Observability and Logging

Add logs at these points:

1. When repayment undo succeeds in Fineract.
2. When original repayment is confirmed as cash/non-cash.
3. When cashier/teller resolution succeeds or fails.
4. When `CashRepaymentReversal` is created.
5. When cashier transaction API merges reversal rows.

Recommended log fields:
- tenant
- loanId
- fineractTxnId
- cashierId
- tellerId
- amount
- currency
- reversal source

---

## Testing Checklist

- [ ] Cash repayment undo creates a `CashRepaymentReversal` row
- [ ] Non-cash repayment undo does not create a repayment-reversal row
- [ ] Cashier transactions API merges repayment reversal rows
- [ ] Payout reversal behavior still works
- [ ] Repayment reversal rows are labeled as `Reversal (Cash Out)`
- [ ] Sorting works when Fineract and synthetic rows are mixed
- [ ] Export includes repayment reversal rows correctly
- [ ] Undo retries do not create duplicate reversal rows
- [ ] Backfill script detects historical reversed cash repayments correctly
- [ ] Backfill script is safe in dry-run mode

---

## Edge Cases

| Case | Handling |
|------|----------|
| Repayment reversed but original payment type was non-cash | Do not create cashier reversal row |
| Repayment reversed but cashier cannot be resolved | Log and skip or create unmatched record for manual repair |
| Duplicate undo event | Idempotent create; do not duplicate rows |
| Historical reversals before this feature | Backfill script |
| Cashier page pagination | Merge synthetic rows before final pagination if possible, or document limitations |
| Fineract also starts creating repayment cashier reversal rows in future | Deduplicate using note/txn match rules |

---

## Rollout Plan

## Step 1

Add Prisma model and migration for `CashRepaymentReversal`.

## Step 2

Update repayment undo path to create reversal records after successful Fineract undo.

## Step 3

Update cashier transactions API to merge repayment reversal rows.

## Step 4

Update cashier page labeling for repayment reversal direction.

## Step 5

Run dry-run backfill in production-like environment.

## Step 6

Run controlled production backfill for missing historical reversals.

## Step 7

Verify with known examples, including the April 16, 2026 `1,971.50` repayment case.

---

## Acceptance Criteria

This work is complete when:

1. Undoing a cash repayment results in a visible reversal row under cashier transactions.
2. The row appears with the correct amount and reversal date.
3. The row is labeled clearly as a repayment reversal / cash-out effect.
4. Existing payout reversal visibility still works.
5. Historical missing repayment reversals can be backfilled safely.

---

## Suggested Files to Modify

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add `CashRepaymentReversal` model |
| `prisma/migrations/...` | Migration for new table/indexes |
| `lib/bulk-repayment-reverse.ts` | Persist repayment reversal after successful undo |
| `lib/bulk-repayment-reversal-queue-service.ts` | Wire queue-driven reversal flow into persistence |
| `app/api/tellers/[id]/cashiers/[cashierId]/transactions/route.ts` | Merge repayment reversal rows into cashier history |
| `app/(application)/tellers/[id]/cashiers/[cashierId]/transactions/page.tsx` | Show repayment reversal label/badge |
| `scripts/backfill-cash-repayment-reversals.ts` | One-off historical repair |

---

## Final Recommendation

Do not try to solve this only in the UI.

The right fix is:

1. persist repayment-reversal events locally,
2. merge them into cashier history the same way we already do for reversed payouts,
3. backfill missing historical events.

That gives a stable, auditable, production-safe solution and keeps the cashier screen aligned with how users expect cancelled cash repayments to appear.
