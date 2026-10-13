# ARDA inventory reports and stock controls

## Deployment and activation

This branch adds native Inventory → Reports and coordinated stock approvals/disbursements. It does not activate either feature in production. Existing financial reports remain Fineract API reports.

1. Deploy the application and run the additive Prisma migration `20261013120000_arda_inventory_controls`. Generate the Prisma client. Do not enable the flags with an older deployment.
2. Verify the active ARDA tenant, its Fineract connection, authorized offices, stock balances and existing loans. Take a settings backup. Resolve the historical issue below before relying on availability.
3. Verified ARDA product IDs on 13 October 2026: 1, 2, 3 and 4, with external IDs ARDA-STOCK-1M, ARDA-STOCK-2M, ARDA-STOCK-3M and ARDA-STOCK-6M. Recheck these against the deployment's Fineract tenant before activation.
4. With the correct application database supplied securely, preview:

   ```sh
   pnpm exec tsx scripts/arda/configure-inventory-controls.ts --stock-product-ids=1,2,3,4
   ```

   After the prerequisites are verified, repeat with `--apply`. The script merges ARDA's settings and preserves unrelated keys. It enables `settings.features.hasInventoryReports` and `settings.features.enforceStockAvailability`, and records `settings.inventory.stockProductIds`. Both flags default to false, and server checks require the tenant slug `arda`. Other tenants are not enabled even if a flag is accidentally set.
5. Verify authenticated ARDA reports and direct URL/API denial from another tenant. Check ordinary cash-loan workflows without submitting production financial transactions. Refresh tenant configuration caches/sessions according to deployment practice.

### Read-only production audit, 13 October 2026

- ARDA had two active items, both USD/bag at Head Office: Maize Seed 10kg, on hand 100, reserved 0, value 2,500; Groundnut Seed 10kg, on hand 60, reserved 0, value 2,700.
- There were no StockLoanIssue records. Loan 1 was Active, disbursed 250, with a saved selection of 10 maize bags at 25. Loan 2 was pending approval with a saved selection of 65 maize bags at 25.
- **Activation prerequisite:** establish whether loan 1's 10 bags were physically issued and reconcile the ledger against source documents and a stock count. Do not invent an issue or reduce stock solely because a loan was disbursed. If delivered and the count excludes those bags, record the verified movement through the ledger workflow with an audit reference before enabling enforcement.
- New flags and the reservation-generation migration were absent in production during the audit. No live settings, stock quantities, loan approvals, payouts or repayments were changed by this work.

## Reports and semantics

Five native reports cover availability/value; reservations and age; movements; monthly item performance; and reconciliation exceptions. Filters include office, item and currency; activity reports accept inclusive UTC dates; reservation status applies to the reservation report. Availability and reservations show the current position, not historical balances. Rankings compare net quantities within the same month, unit and currency; each branch/item is a row. Returns reduce net quantities. Distinct issued stock loans determine disbursement counts.

CSV/Excel exports use the applied table filters, retain decimal precision and prevent formula interpretation of text. Exports are capped at 50,000 rows; narrow filters above that limit. Page size is capped at 200. Values are the ledger's existing valuation convention; the system has not gained a separate accounting cost or realized-profit model.

## Concurrency, retries and recovery

ARDA's stock writers share a short tenant advisory lock. Reserve before approval; verify before disbursement; record the external operation before making its network call; consume exactly once after confirmation. Database locks are released before network calls. Terms changes replace an existing hold atomically and are blocked while an external operation is pending. Cancellation uses persisted reservation lines even if selection metadata is damaged.

An uncertain response keeps the reservation and presents a reconciliation message. Never repeat a payout manually because the browser timed out. Look at Stock Reconciliation Exceptions and the operation ID. A concurrent successful reconciliation cannot be overwritten by a late timeout.

Set `ARDA_FINERACT_BASE_URL` to the verified API v1 URL and supply Fineract credentials securely. Preview:

```sh
pnpm exec tsx scripts/arda/reconcile-stock-actions.ts
```

Use `--apply` only after reviewing the preview. The script only finalizes already-confirmed approval results or disbursements with a matching external transaction identifier, type, amount and unreversed status; it never initiates a financial action. Repeated runs cannot issue stock twice.

Uncertain approvals and other loan mutations need manual investigation because there is no reliable external action identifier for them. Check Fineract audit/loan history and the saved operation snapshot. If execution is confirmed, finalize the corresponding local lifecycle under the stock lock in a reviewed repair; if nonexecution is proven, mark the operation failed under that lock before allowing a retry. Do not infer nonexecution from a missing response. Preserve the audit evidence and reservation generation. An undone financial disbursement does not create a physical stock return; verify actual returned goods separately.

Actions made directly in Mifos/Fineract bypass Loan Matrix's controls. Enforcing those actions requires a Fineract-side rule or restricting direct approval/disbursement permissions. This branch does not provide that separate mechanism.

## Rollback

Keep the additive schema and operation history. To stop exposing reports, set only ARDA's hasInventoryReports to false. Do not disable enforcement while approvals/disbursements continue: it restores the previous paths and can bypass unresolved holds. First suspend stock financial actions, review pending operations, reconcile stock, then change only ARDA's flag if rollback is necessary. Never delete operation records or release holds to clear an error.

## Live Fineract metadata repair

The empty `arda_stock_details` row for loan 1 was populated through the ARDA datatable API from its explicitly saved Loan Matrix selection and the matching inventory item. Loan external ID, application lead ID, office, currency and total were verified. The source reference is `lead-selection:<lead-id>`, not a fabricated inventory issue.

Reports 205 (ARDA Disbursements by Month), 206 (ARDA Outstanding Balance by Branch) and 207 (ARDA Stock Repayment Report) were updated through Fineract's reports API, retaining existing report and parameter association IDs. Missing stock values no longer silently substitute loan principal/disbursement amounts. The tenant has no loan-status rows in r_enum_value; report status labels were mapped from live Fineract responses for current statuses 100 and 300, with the numeric status retained as a fallback for unmapped future states.

Readback of all three reports showed Maize Seed 10kg, unit bag, quantity 10, unit value 25, stock value 250 and status Active. Goodfellow report 326 was read before/after and unchanged. No financial or inventory movement was created. Future stock loans still need the application deployment and synchronization path; the historical metadata repair does not repair the missing stock ledger movement.

Do not rerun the older ARDA report-registration script over these live reports without reconciling definitions: its source definitions predate the live cashier/payment filters and this repair. Application requests do not automatically rerun that script.

## Verification and remaining finance improvements

The full suite passed 474 tests, including real PostgreSQL competing reservations, duplicate payout requests, delayed timeout after reconciliation, terms replacement rollback, pending-edit rejection, tenant/office scoping, decimal exports and date boundaries. Prisma validation and the production build passed. Desktop and 390px mobile report layouts were inspected using actual components with synthetic report responses; this is not a live authenticated end-to-end workflow test. Existing stock selectors already display availability and disable unavailable items.

Repository-wide TypeScript and lint checks have existing failures in unrelated code (including existing modified files); new inventory modules are checked separately. The production build configuration skips TypeScript validation, so a successful build is not a clean type-check claim. No production financial transaction was used as a test.

Potential next finance work: separately recorded procurement cost versus selling value; verified cost-of-goods and margin reporting; batch/lot expiry; documented physical returns; and aging exception ownership. Receipts less issued stock value must not be labeled profit without an agreed cost and revenue-recognition model.
