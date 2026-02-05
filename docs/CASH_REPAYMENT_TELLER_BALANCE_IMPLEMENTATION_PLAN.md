# Cash Repayment → Teller/Cashier Balance: Implementation Plan

## Summary

When a loan repayment is made with **cash**, the teller/cashier balance should **increase** to reflect the cash received. Currently, repayments go directly to Fineract's loan transaction API and bypass the teller module, so no cashier balance update occurs.

---

## Current State

| Component | Behavior |
|-----------|----------|
| **Repayment flow** | Repayment modal → `POST /api/fineract/loans/[id]/transactions?command=repayment` → proxies directly to Fineract |
| **Payment type** | Modal sends `paymentTypeId` (optional); template includes `paymentTypeOptions` with `isCashPayment` |
| **Teller/Cashier balance** | Displayed from Fineract `getCashierSummaryAndTransactions` (netCash, sumCashAllocation) |
| **Fineract loan API** | Does NOT automatically update teller/cashier balance when processing repayments |

---

## Approach: Intercept Repayment + Fineract Allocate

Because the cashier balance shown on the "Manage Cashiers" page comes from Fineract, we must call Fineract's `allocateCashToCashier` API to increase the till. Local `CashAllocation` records are only used as fallback when Fineract data is unavailable.

**Recommended strategy:**
1. Intercept `command=repayment` in our transactions route (no longer pure proxy).
2. After successful Fineract repayment, if payment is cash:
   - Determine target teller/cashier (loan office → teller → cashier).
   - Call Fineract `allocateCashToCashier` with the repayment amount.
   - Optionally create a local `CashAllocation` for audit/fallback.

---

## Implementation Plan

### Phase 1: Repayment Route Enhancement

**File:** `app/api/fineract/loans/[id]/transactions/route.ts`

1. **Intercept `command=repayment`**
   - Parse body for `paymentTypeId`, `transactionAmount`, `transactionDate`.
   - Call Fineract as today (proxied POST).

2. **Post-success logic (only when `command === 'repayment'`)**
   - Check if payment is cash:
     - If `paymentTypeId` present: call `/api/fineract/paymenttypes` (or internal helper) and find `isCashPayment === true`.
     - If no `paymentTypeId`: treat as non-cash (skip).
   - If cash:
     - Call new helper `recordCashRepaymentToTeller(loanId, amount, currency, date, tenantId)`.
   - Return Fineract response as today.

3. **Error handling**
   - If Fineract repayment succeeds but teller update fails: log error, optionally retry via background job, but **do not fail the repayment response** (repayment is already committed).

---

### Phase 2: Cash Repayment → Teller Helper

**File:** `lib/cash-repayment-teller.ts` (new)

**Function:** `recordCashRepaymentToTeller(loanId, amount, currency, date, tenantId)`

1. **Resolve loan office**
   - Fetch loan from Fineract: `GET /loans/{loanId}`.
   - Use `clientOfficeId` (loan belongs to client’s office).

2. **Resolve teller**
   - Query `Teller` where `tenantId` and `officeId === clientOfficeId`, `isActive === true`.
   - If multiple: pick first (or add config later).
   - If none: log warning and exit (no teller for office).

3. **Resolve cashier**
   - **Option A (recommended):** Require frontend to send `cashierId` (Fineract cashier ID) or `tellerId`/`cashierId` (our DB IDs) when payment is cash.
   - **Option B:** Use first active cashier for the teller:
     - Fetch Fineract cashiers for teller.
     - Filter by `isRunning` or active session.
     - Pick first.
   - If no cashier: log warning and exit.

4. **Call Fineract allocate**
   - Use `allocateCashToCashier(tellerId, cashierId, { txnDate, currencyCode, txnAmount, txnNote: "Loan repayment #" + loanId })`.
   - Date format: `dd MMMM yyyy` (Fineract expects this for allocate).

5. **Optional: Local CashAllocation**
   - Create `CashAllocation` with:
     - `amount`: positive (repayment amount),
     - `cashierId`: resolved cashier DB id (or null if teller-level),
     - `notes`: `Loan repayment #${loanId}`,
     - `allocatedBy`: system user or session user.

---

### Phase 3: Repayment Modal – Cashier Selection (Optional)

**File:** `app/(application)/clients/[id]/loans/[loanId]/components/repayment-modal.tsx`

When payment type has `isCashPayment === true`:

1. **Show cashier selector**
   - Fetch tellers for the loan’s office (need office from template or separate fetch).
   - Fetch cashiers for selected teller.
   - Show dropdown: Teller → Cashier.

2. **Include in payload**
   - Add `cashierId` (Fineract ID) and/or `tellerId` when payment is cash.
   - Backend uses this to target the correct till.

If we skip this, backend falls back to “first active cashier” (Option B above).

---

## Data Flow Diagram

```
Repayment Modal (paymentTypeId, amount, date, [cashierId])
    │
    ▼
POST /api/fineract/loans/[id]/transactions?command=repayment
    │
    ├─► Fineract: POST /loans/{id}/transactions?command=repayment  ✓
    │
    └─► If cash:
            ├─► Resolve office from loan
            ├─► Resolve teller (officeId)
            ├─► Resolve cashier (teller + payload or first active)
            ├─► Fineract: allocateCashToCashier(tellerId, cashierId, amount)  ✓
            └─► (Optional) Create CashAllocation
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| No payment type selected | Skip teller update (conservative) |
| Payment type not cash | Skip teller update |
| No teller for office | Log warning, skip (repayment still succeeds) |
| No active cashier | Log warning, skip |
| Allocate API fails | Log error, do not fail repayment |
| Multi-currency | Use loan currency for allocate |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/api/fineract/loans/[id]/transactions/route.ts` | Intercept repayment, add post-success cash handling |
| `lib/cash-repayment-teller.ts` | **New** – `recordCashRepaymentToTeller` |
| `app/(application)/clients/[id]/loans/[loanId]/components/repayment-modal.tsx` | **Optional** – cashier selector when cash |

---

## Testing Checklist

- [ ] Cash repayment increases cashier balance (Fineract and UI)
- [ ] Non-cash repayment does not change cashier balance
- [ ] Repayment without payment type does not change cashier balance
- [ ] Repayment succeeds even if teller update fails
- [ ] Office with no teller: repayment succeeds, no crash
- [ ] Office with no active cashier: repayment succeeds, no crash
- [ ] Multi-currency loan: correct currency used in allocate

---

## Rollout Order

1. Implement `recordCashRepaymentToTeller` and wire it in the transactions route (Option B: first active cashier).
2. Validate end-to-end with cash repayments.
3. Add optional cashier selector in repayment modal (Phase 3) if needed.

---

## Dependencies

- `getFineractServiceWithSession` – existing
- `allocateCashToCashier` – existing in `lib/fineract-api.ts`
- `fetchFineractAPI` / loan fetch – existing
- `getTenantFromHeaders` – for tenant resolution in route
- Prisma `Teller` model – existing

---

## Notes

- **Fineract allocate semantics:** `allocateCashToCashier` adds cash to the till (vault → till). For repayments, the source is customer → till; the net effect (till increases) is correct. Fineract does not expose a separate “customer deposit” API; allocate is the appropriate mechanism to reflect cash in the till.
- **Session requirement:** Fineract allocate may require an active cashier session. If allocate fails with “no session,” we can document that cashiers must have an active session for cash repayments, or explore session auto-start if supported.
