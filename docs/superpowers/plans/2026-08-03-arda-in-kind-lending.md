# ARDA In-Kind Lending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a farmer to receive stock on credit while Fineract continues to manage the money-value loan, cash repayments, arrears, and statements.

**Architecture:** Loan Matrix owns an immutable, tenant- and branch-scoped inventory ledger. Each issued stock line is linked to one local stock-loan issue and, after the issue succeeds, one monetary Fineract loan disbursement. Fineract never stores quantities; it stores the agreed monetary debt and all cash repayment activity.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Omama Fineract REST API, Vitest-compatible `tsx --test` tests.

## Global Constraints

- Work on branch `ARDA`, created from `origin/dev`.
- Use the local PostgreSQL database named `ARDA` for development data.
- Use the Omama Fineract tenant only for labelled test clients, products, payment types, and transactions.
- Do not change Fineract source code or treat Fineract as an inventory system.
- Every stock quantity/value change must be represented by an immutable local movement record.
- Cash repayments remain the existing Fineract repayment flow and must never alter inventory quantities.
- Initial pilot valuation uses the agreed issue price as both the stock value and the Fineract loan amount. Inventory cost/margin accounting is a later finance-approved phase.
- All inventory reads and writes must be scoped by `tenantId` and Fineract office/branch.

## User Stories

1. **Catalogue management:** As a stock administrator, I can create active stock items with an SKU, unit of measure, branch availability, and agreed unit value.
2. **Stock control:** As a storekeeper, I can receive, adjust, reserve, issue, return, and reverse stock with a reason and a full audit trail.
3. **Stock quote:** As a loan officer, I can select approved stock items and quantities for an in-kind loan, and see the resulting monetary loan value before approval.
4. **Approval:** As an approver, I can review the itemised quote and approve the same monetary value that will be submitted to Fineract.
5. **Issue/disbursement:** As a disburser, I can issue a reserved stock package once; the system reduces the correct branch balance and records the exact monetary disbursement in Fineract.
6. **Cash collection:** As a cashier, I can collect cash repayments against the Fineract loan without changing stock on hand.
7. **Audit/reporting:** As a manager or auditor, I can trace stock, value, farmer, lead, Fineract loan, branch, user, and reversal history from one record.

## Data Model

### Inventory catalogue and balances

Create these Prisma models in `prisma/schema.prisma`:

```ts
enum InventoryMovementType {
  RECEIPT
  ADJUSTMENT_IN
  ADJUSTMENT_OUT
  RESERVATION
  RESERVATION_RELEASE
  ISSUE
  RETURN
  ISSUE_REVERSAL
  TRANSFER_OUT
  TRANSFER_IN
}

enum StockLoanIssueStatus {
  DRAFT
  RESERVED
  PROCESSING
  ISSUED
  FAILED
  RETURNED
  CANCELLED
}

model InventoryItem {
  id              String   @id @default(cuid())
  tenantId        String
  sku             String
  name            String
  description     String?
  unitOfMeasure   String
  defaultUnitValue Decimal @db.Decimal(18, 2)
  isActive        Boolean  @default(true)
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  balances        InventoryBalance[]
  movements       InventoryMovement[]
  issueLines      StockLoanIssueLine[]
  @@unique([tenantId, sku])
  @@index([tenantId, isActive])
}
```

`InventoryBalance` is a current branch-level projection used for fast availability checks. `InventoryMovement` is the non-editable audit ledger. Each movement contains a non-null `idempotencyKey`, quantity/value delta, Fineract office ID, acting user ID/name, optional lead ID, optional Fineract loan ID, optional issue ID, reason, and timestamp. A unique key on `(tenantId, idempotencyKey)` prevents duplicate stock movements.

`StockLoanIssue` links one `Lead` to the selected branch and its issued package. `StockLoanIssueLine` captures the locked `InventoryItem`, quantity, unit value, and line value. The line value total is the only amount sent to Fineract for the stock-loan disbursement.

### Balance rules

```
availableQuantity = quantityOnHand - quantityReserved
```

- Receipt and adjustment-in increase `quantityOnHand` and stock value.
- Reservation increases `quantityReserved` only.
- Issue decreases both `quantityOnHand` and `quantityReserved`.
- Reservation release decreases `quantityReserved` only.
- Return and issue reversal increase `quantityOnHand`; a returned but damaged item is an adjustment-in/out decision with a reason.
- A request may never reduce available quantity below zero.

## Fineract Boundary

1. Configure an Omama Fineract payment type called `In-Kind Stock Disbursement`.
2. When a stock issue succeeds, call the existing `/api/fineract/loans/[id]/disburse` integration with:

```json
{
  "actualDisbursementDate": "dd MMMM yyyy",
  "transactionAmount": 2000.00,
  "paymentTypeId": 0,
  "note": "In-kind stock issue ARDA-<issue-reference>"
}
```

3. `transactionAmount` equals the locked local issue total, not the current catalogue price.
4. The normal Fineract repayment endpoint remains unchanged. Cash/mobile/bank repayment payment types continue to work exactly as they do for cash loans.
5. The local issue ID and delivery-note reference are posted to the Fineract loan note and retained locally. This makes reconciliation possible even if a network retry occurs.

## Failure and Reversal Rules

- Create and reserve stock before calling Fineract; reject the request before the Fineract call if availability is insufficient.
- Set the issue to `PROCESSING` before calling Fineract. Repeated clicks reuse the same issue and idempotency key.
- If Fineract rejects the disbursement, mark the issue `FAILED` and release the reservation in one local database transaction.
- If Fineract accepts but local finalisation fails, retain `PROCESSING`; a reconciliation endpoint resolves it from the Fineract loan transaction/note without calling Fineract again.
- A completed issue cannot be edited. A return/reversal creates compensating movements and requires the related Fineract disbursement undo to succeed first.
- Cash repayments do not permit a stock return reversal without an explicit manager-approved financial adjustment; this is not part of the pilot.

## Tasks

### Task 1: Create the inventory schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_arda_inventory/migration.sql`
- Create: `lib/__tests__/inventory-ledger-schema.test.ts`

**Produces:** `InventoryItem`, `InventoryBalance`, `InventoryMovement`, `StockLoanIssue`, and `StockLoanIssueLine` Prisma models plus their enums and indexes.

- [ ] Write a schema test asserting all five models, tenant indexes, the balance unique key `(tenantId, fineractOfficeId, inventoryItemId)`, and the movement idempotency unique key are present.
- [ ] Run `npx tsx --test lib/__tests__/inventory-ledger-schema.test.ts` and confirm it fails before the schema is added.
- [ ] Add the models, relations to `Tenant`/`Lead`, migration SQL, and generate Prisma client.
- [ ] Run the schema test and `npx prisma validate`.
- [ ] Commit with `feat(arda): add inventory ledger schema`.

### Task 2: Build the atomic inventory-ledger service

**Files:**
- Create: `lib/inventory/types.ts`
- Create: `lib/inventory/inventory-ledger-service.ts`
- Create: `lib/__tests__/inventory-ledger-service.test.ts`

**Consumes:** `InventoryItem`, `InventoryBalance`, `InventoryMovement`.

**Produces:**

```ts
export async function receiveInventory(input: ReceiveInventoryInput): Promise<InventoryMovement>;
export async function reserveInventory(input: ReserveInventoryInput): Promise<InventoryMovement>;
export async function releaseInventoryReservation(input: ReleaseInventoryInput): Promise<InventoryMovement>;
export async function issueReservedInventory(input: IssueInventoryInput): Promise<InventoryMovement[]>;
```

- [ ] Write failing tests for receipt, reservation, insufficient available quantity, idempotent retry, release, and issue.
- [ ] Use a single `prisma.$transaction` per action to insert an immutable movement and update the balance projection together.
- [ ] Reject inactive items, non-positive quantity/value, tenant mismatch, and insufficient available stock with explicit typed errors.
- [ ] Run `npx tsx --test lib/__tests__/inventory-ledger-service.test.ts` and confirm all cases pass.
- [ ] Commit with `feat(arda): add atomic inventory ledger service`.

### Task 3: Add tenant/branch-scoped inventory APIs and catalogue UI

**Files:**
- Create: `app/api/inventory/items/route.ts`
- Create: `app/api/inventory/items/[id]/route.ts`
- Create: `app/api/inventory/balances/route.ts`
- Create: `app/api/inventory/movements/route.ts`
- Create: `app/api/inventory/receipts/route.ts`
- Create: `app/(application)/inventory/page.tsx`
- Create: `app/(application)/inventory/components/inventory-dashboard.tsx`
- Create: `app/(application)/inventory/components/item-form.tsx`
- Modify: `app/(application)/components/sidebar-nav.tsx`
- Modify: `app/(application)/components/mobile-sidebar.tsx`

**Produces:** Inventory catalogue, branch availability dashboard, receipt/adjustment action, and paginated movement history.

- [ ] Write route tests proving a request cannot read or write another tenant’s item or a branch outside the logged-in user’s Fineract office scope.
- [ ] Reuse the existing Omama office-scope helpers rather than introducing a separate branch permission implementation.
- [ ] Make all item creation, value updates, receipt, and adjustment actions Super Admin only in the first release.
- [ ] Provide a branch selector only to permitted office administrators; all other users see their own Fineract office.
- [ ] Run focused route/component tests and manually verify empty, low-stock, and populated branches.
- [ ] Commit with `feat(arda): add inventory catalogue and stock control`.

### Task 4: Add stock quotes to eligible lead products

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `app/(application)/products/loan-products/create/page.tsx`
- Modify: `app/(application)/products/loan-products/[id]/edit/page.tsx`
- Modify: `app/(application)/leads/new/components/new-lead-form.tsx`
- Create: `app/(application)/leads/new/components/stock-quote-form.tsx`
- Create: `app/api/leads/[id]/stock-issue/route.ts`
- Create: `lib/__tests__/stock-quote-validation.test.ts`

**Produces:** A `disbursementMode` field (`CASH` or `IN_KIND_STOCK`) on Loan Matrix loan-product configuration and locked itemised stock quote records for a lead.

- [ ] Write failing validation tests that reject an empty quote, inactive item, zero quantity, mixed tenant item, and total that differs from the lead/Fineract amount.
- [ ] Make the stock quote visible only after a product with `IN_KIND_STOCK` is selected.
- [ ] Lock line unit values and quantities at the approval boundary. Later catalogue price changes must not alter an approved quote.
- [ ] Block approval and stock reservation unless the selected branch has sufficient availability.
- [ ] Run the quote tests and a manually created Omama test lead.
- [ ] Commit with `feat(arda): add in-kind stock quotes to leads`.

### Task 5: Replace cash payout with an in-kind issue/disbursement orchestration

**Files:**
- Modify: `app/(application)/leads/[id]/components/state-transition-manager.tsx`
- Modify: `app/(application)/leads/[id]/components/payout-modal.tsx`
- Modify: `app/api/leads/[id]/transition/route.ts`
- Modify: `lib/team-state-machine-service.ts`
- Create: `lib/inventory/stock-loan-disbursement-service.ts`
- Create: `app/api/inventory/issues/[id]/reconcile/route.ts`
- Create: `lib/__tests__/stock-loan-disbursement-service.test.ts`

**Produces:**

```ts
export async function completeStockLoanDisbursement(input: {
  tenantId: string;
  leadId: string;
  fineractLoanId: number;
  fineractOfficeId: number;
  actor: { userId: string; userName: string };
}): Promise<{ issueId: string; fineractTransactionId: number }>;
```

- [ ] Write failing tests for no reservation, duplicate submission, Fineract disbursement failure, local-finalisation failure, and successful issue with matching total.
- [ ] For in-kind products, show an itemised read-only delivery note instead of cashier/teller payout controls.
- [ ] Record `PROCESSING`, call Fineract once using the configured in-kind payment type, issue reserved inventory, and persist the Fineract transaction reference.
- [ ] Preserve the current cash, mobile-money, and bank-transfer payout paths unchanged for cash products.
- [ ] Add a restricted reconciliation action for a stuck `PROCESSING` issue; it inspects Fineract before retrying any local work.
- [ ] Run the service test suite and one Omama-labelled test disbursement end to end.
- [ ] Commit with `feat(arda): issue stock against Fineract loans`.

### Task 6: Deliver stock, loan, and reconciliation reporting

**Files:**
- Modify: `app/(application)/clients/[id]/page.tsx`
- Modify: `app/(application)/clients/[id]/loans/[loanId]/page.tsx`
- Create: `app/(application)/inventory/reports/page.tsx`
- Create: `app/api/inventory/reports/route.ts`
- Create: `app/api/inventory/issues/[id]/delivery-note/route.ts`
- Create: `lib/__tests__/inventory-reporting.test.ts`

**Produces:** Stock-on-hand, stock value, reservations, issued-on-credit value, delivery note, per-farmer issue history, and Fineract cash-repayment context.

- [ ] Write tests that exclude other tenants/offices and preserve historical line values after catalogue price changes.
- [ ] Show both balances on an in-kind loan: `Stock issued value` from the local issue and `Loan outstanding` from Fineract.
- [ ] Keep all cash repayment and arrears values sourced from Fineract.
- [ ] Provide CSV/PDF delivery-note export with farmer, branch, loan account, issue lines, signatures, and issue reference.
- [ ] Commit with `feat(arda): add stock lending reports and delivery notes`.

### Task 7: Validate ARDA locally against Omama Fineract

**Files:**
- Create: `docs/arda-local-test-runbook.md`
- Modify: `.env.example` only; do not commit local credentials.

- [ ] Set local `DATABASE_URL` to the `ARDA` database and run the new migration.
- [ ] Configure or verify one Omama Fineract `In-Kind Stock Disbursement` payment type and one clearly labelled ARDA test loan product/client.
- [ ] Execute: stock receipt -> quote -> reserve -> approve -> issue/Fineract disburse -> cash repayment -> report verification.
- [ ] Run every ARDA focused test, `npx prisma validate`, `git diff --check`, and the applicable project build command.
- [ ] Document actual test identifiers, expected balances, reconciliation steps, and cleanup instructions without storing secrets.
- [ ] Commit with `test(arda): document local Omama integration verification`.

## Acceptance Criteria

- Issuing 10 bags at ZMW 200 reduces local inventory by 10 bags and ZMW 2,000.
- The linked Fineract loan is disbursed once for ZMW 2,000 with the in-kind payment type.
- A ZMW 500 cash repayment reduces Fineract outstanding to ZMW 1,500 and leaves inventory unchanged.
- A duplicate click creates neither a second issue nor a second Fineract disbursement.
- A failed Fineract disbursement leaves inventory on hand unchanged and releases the reservation.
- Every screen and API query is restricted to the current tenant and allowed branch scope.
- Every reversal or adjustment creates a compensating ledger record; no historical movement is edited or deleted.
