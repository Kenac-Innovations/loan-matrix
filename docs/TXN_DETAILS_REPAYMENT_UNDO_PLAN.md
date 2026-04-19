# Transaction Details Repayment Undo Plan

## Goal

Update the loan transaction details page so that:

1. the `Undo` button is enabled for repayment transactions, not only disbursements
2. after a successful repayment undo in Fineract, Loan Matrix also reduces the cashier float by calling the cashier `settle` endpoint

This plan is specifically for the transaction details page:

- [app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx:1)

Related existing design work:

- [docs/CASH_REPAYMENT_REVERSAL_CASHIER_VISIBILITY_PLAN.md](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/docs/CASH_REPAYMENT_REVERSAL_CASHIER_VISIBILITY_PLAN.md:1)

## Current Behavior

### Undo button

On the transaction details page, `Undo` is only enabled for disbursements:

- [page.tsx:124](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx:124)

The current undo action:

1. opens the "Undo Disbursement" modal
2. calls `POST /api/fineract/loans/{loanId}/transactions/{transactionId}?command=undo`
3. refreshes the page

Relevant code:

- [page.tsx:240](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx:240)
- [page.tsx:274](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx:274)

### Repayment creation

Cash repayment today is a two-step flow:

1. create repayment on the loan in Fineract
2. separately allocate cash into the cashier till

Relevant code:

- [repayment-modal.tsx:304](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/components/repayment-modal.tsx:304)
- [repayment-modal.tsx:330](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/components/repayment-modal.tsx:330)
- [app/api/fineract/loans/[id]/transactions/route.ts:67](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/fineract/loans/[id]/transactions/route.ts:67)
- [app/api/tellers/[id]/cashiers/[cashierId]/allocate/route.ts:362](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/tellers/[id]/cashiers/[cashierId]/allocate/route.ts:362)

Important detail:

- repayment allocation for `source === "repayment"` is written to Fineract only
- Loan Matrix intentionally does **not** create a local `CashAllocation` row for that repayment

## Problem

Undoing a repayment currently only fixes the loan transaction ledger.

It does **not** reduce the cashier float, so loan history and cashier balance drift apart.

## Key Constraint

The repayment transaction details page does **not** currently know which teller and cashier originally received the repayment cash.

That data is not available directly on the repayment transaction object shown on the page, and the current repayment flow does not persist a local repayment-to-cashier mapping.

That means:

- we can enable `Undo` for repayment quickly
- but we cannot safely auto-call `settle` unless we first know which cashier to settle against

## Recommended Approach

Use a two-part implementation:

1. short-term UI and orchestration change for repayment undo from the details page
2. add explicit cashier context for the undo operation so the correct `settle` call can be made safely

## Proposed Implementation

### Phase 1: Enable Undo for repayments

Update the transaction details page so the `Undo` button is enabled when:

- `transaction.type.disbursement` is true, or
- `transaction.type.repayment` is true, or
- `transaction.type.recoveryRepayment` is true

Also keep it disabled when:

- `transaction.manuallyReversed` is true

UI changes:

- rename the modal title from "Undo Disbursement" to something neutral like `Undo Transaction`
- render modal copy based on transaction type

Files:

- [app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx:1)

### Phase 2: Add repayment-specific undo flow

For repayment undo only:

1. call Fineract undo exactly as today
2. if undo succeeds, call the cashier `settle` endpoint to reduce float

Settlement endpoint:

- [app/api/tellers/[id]/cashiers/[cashierId]/settle/route.ts](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/tellers/[id]/cashiers/[cashierId]/settle/route.ts:1)

Recommended payload for repayment reversal cash-out:

- `amount`: original repayment amount
- `currency`: transaction currency
- `date`: undo date or original transaction business date, depending business rule
- `notes`: `Repayment reversal - Loan #{loanId} / Txn #{transactionId}`
- `transactionType`: `EXPENSE`

Reason for `EXPENSE`:

- this is not a loan disbursement payout
- it is a cash removal from the cashier till to offset a previously received repayment

### Phase 3: Resolve teller/cashier context

This is the critical step.

Before calling `settle`, the page must know the correct:

- teller ID
- cashier ID

Recommended short-term option:

- for repayment undo, extend the undo modal to require teller and cashier selection
- reuse the same lookup APIs used by the repayment modal:
  - `GET /api/tellers`
  - `GET /api/tellers/{tellerId}/cashiers`

Why this is recommended:

- no risky guessing
- works with current data model
- avoids settling the wrong cashier

Alternative long-term option:

- persist repayment-to-cashier linkage at repayment time
- then auto-resolve the right cashier during undo with no user input

## API / UI Sequence

### Repayment undo from transaction details page

1. user opens transaction details page
2. page detects repayment transaction and enables `Undo`
3. user clicks `Undo`
4. modal asks for confirmation
5. if repayment is cash, modal also asks for teller and cashier
6. frontend calls:
   - `POST /api/fineract/loans/{loanId}/transactions/{transactionId}?command=undo`
7. if undo succeeds, frontend calls:
   - `POST /api/tellers/{tellerId}/cashiers/{cashierId}/settle`
8. if settle succeeds, page closes modal and refreshes
9. if settle fails, show partial-success error:
   - loan repayment was undone
   - cashier float was not reduced

## Backend Shape

Recommended cleanup:

Instead of keeping the orchestration split in the page component, add a dedicated Loan Matrix endpoint for repayment undo, for example:

- `POST /api/loans/{loanId}/transactions/{transactionId}/undo-repayment`

That route would:

1. validate transaction is repayment-like and not already reversed
2. call Fineract undo
3. call cashier settle
4. return one combined success/failure response

Benefits:

- keeps business logic out of the page
- easier to reuse later from bulk undo or other screens
- easier to log and make idempotent

## Files To Update

### UI

- [app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/(application)/clients/[id]/loans/[loanId]/transactions/[transactionId]/page.tsx:1)

### Existing backend to reuse

- [app/api/fineract/loans/[id]/transactions/[transactionId]/route.ts](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/fineract/loans/[id]/transactions/[transactionId]/route.ts:1)
- [app/api/tellers/[id]/cashiers/[cashierId]/settle/route.ts](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/tellers/[id]/cashiers/[cashierId]/settle/route.ts:1)
- [app/api/tellers/route.ts](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/tellers/route.ts:1)
- [app/api/tellers/[id]/cashiers/route.ts](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/app/api/tellers/[id]/cashiers/route.ts:1)

### Optional new backend orchestration route

- `app/api/loans/[loanId]/transactions/[transactionId]/undo-repayment/route.ts`

## Error Handling Rules

### Case 1: Fineract undo fails

- do not call `settle`
- show user the Fineract undo error

### Case 2: Fineract undo succeeds, settle fails

- show partial-success state
- tell user loan ledger is reversed but cashier float still needs correction
- include enough detail for manual follow-up

### Case 3: duplicate click / retry

- make the orchestration idempotent where possible
- avoid a second `settle` if the repayment is already manually reversed

## Risks

### Wrong cashier selected

Biggest risk in the short-term UI-driven approach.

Mitigation:

- require explicit teller/cashier selection
- only show active cashiers
- optionally display office and cashier name clearly in the confirmation modal

### Undo allowed for non-cash repayment

If repayment was non-cash, no cashier settle should happen.

Mitigation:

- inspect `transaction.paymentDetailData.paymentType`
- only request teller/cashier and call `settle` when repayment payment type is cash

### Settle endpoint semantics

The `settle` route was built mainly for cash-out/withdrawal/disbursement style movements.

Mitigation:

- verify `transactionType: "EXPENSE"` is acceptable for repayment reversal
- use explicit reversal notes so audit trail is clear

## Test Plan

1. repayment transaction details page shows `Undo` enabled for repayment
2. disbursement behavior remains unchanged
3. already reversed repayment keeps `Undo` disabled
4. non-cash repayment undo does not ask for teller/cashier and does not call `settle`
5. cash repayment undo:
   - Fineract undo succeeds
   - settle is called
   - cashier balance decreases
6. settle failure after undo shows partial-success message
7. wrong or inactive cashier cannot be used

## Recommendation

Implement this in two commits:

1. UI enablement plus repayment-specific undo modal
2. repayment undo orchestration with cashier `settle`

For the first implementation, I recommend requiring teller/cashier selection in the undo modal for cash repayments. It is the safest path with the current data model.
