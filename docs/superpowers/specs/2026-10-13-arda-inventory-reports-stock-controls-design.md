# ARDA inventory reports and stock controls

Status: proposed specification for review; implementation has not started.

## Outcome and sequencing

ARDA needs an Inventory Reports tab using Loan Matrix's stock records and reliable stock provisioning so that unavailable stock cannot be approved or disbursed through Loan Matrix. Database tenant settings must restrict the additions to ARDA after deployment to shared branches.

Complete reports and stock controls first. Then investigate the October 13 screenshot showing Stock Item and Unit as Not captured, missing Quantity and Unit Value, and Loan Status as Unknown in the existing Fineract disbursement report. That follow-up must use verified ARDA source records and must not modify other tenants.

## Current evidence

- The local ARDA checkout contains uncommitted work that must be preserved. The existing report worktree contains newer finance and Fineract synchronization features; implementation must reconcile against the current dev branch before choosing its base.
- InventoryBalance, InventoryMovement, StockLoanIssue and StockLoanIssueLine already provide tenant-scoped balances, movements and reservations.
- The team state machine validates inventory before external actions but records its inventory operation afterward. The check does not hold stock against concurrent requests.
- The workflow's balance read and replacement update have no explicit row locking or serializable transaction protection. Competing reservations can read the same availability.
- The manual loan-action route sends approval and disbursement commands without invoking the stock workflow guard.
- Existing reservations are accepted by status without comparing their item, branch and quantity to changed loan terms. Released reservations cannot currently be reserved again.
- The newer checkout has database features hasInventoryFinance and ardaStockReports. Neither is a suitable substitute for explicit authorization of the new native reports and enforcement behavior.

These are code findings, not a claim that a production oversell has been reproduced.

## Approach

Extend the existing inventory ledger and workflow services. Add a shared stock-action coordinator used by Loan Matrix's workflow and manual loan endpoints. This keeps one reservation source of truth.

A UI-only stock check would leave manual requests and concurrency unprotected. A separate stock system would duplicate existing balances and require broader integration. Neither alternative is recommended.

## Tenant and access boundaries

Add hasInventoryReports and enforceStockAvailability to Tenant.settings.features, both defaulting to false. Enable them only on the resolved ARDA tenant record with a scoped, repeatable update that preserves all other settings. Existing finance and Fineract report flags keep their distinct meanings.

Require ARDA identity and the relevant database feature on new UI routes, APIs and stock-action coordination. Hiding navigation is not an authorization check. Resolve the authenticated tenant on the server, verify membership and office access using existing permission mechanisms, and scope every database operation by tenant ID. Ignore client-supplied tenant IDs as authority. Exports use the same restrictions and filters as the displayed report.

Other tenants retain their existing workflows. Shared database additions must be backwards compatible and inactive by default. Inventory menu visibility itself needs verification against the deployed branch rather than assuming that the local sidebar already implements a tenant gate.

## Inventory Reports tab

Use stock data owned by Loan Matrix; retain financial transaction reports in the Fineract Reports page. Provide Stock Control, Financials when enabled, and Reports navigation inside Inventory.

Reports:

1. Stock Availability and Value: item, SKU, branch, currency, unit, on-hand, reserved, available, stock value and last movement. Clearly label this as the current position.
2. Reservations and Age: client, loan or lead, item, branch, reserved quantity, value, age, workflow stage and reservation status. Highlight stale reservations for review without automatically releasing stock that could support an active loan.
3. Stock Movement History: receipts, reservations, releases, issues, returns and adjustments with dates, actor and references. Distinguish on-hand movements from reservation movements when calculating totals.
4. Monthly Stock Performance: item, month, office, number of distinct fulfilled stock loans, issued quantity, returns, net quantity and issued stock value. Rank quantities within the same unit; compare values only within a currency.
5. Stock Reconciliation Exceptions: balances versus ledger movements, reservations versus issue records, missing loan links and unresolved external-action outcomes. Provide drill-through references for investigation.

Activity reports accept inclusive start/end dates, office, item and currency; reservations also accept status. Current-position reports must not imply historical balances from an activity date filter. Validate dates and office access. Provide paginated tables, loading/empty/error states, CSV and Excel exports, decimal-safe totals and spreadsheet formula-injection protection.

Do not label repayment receipts minus stock issues as profit. Cost, selling value, principal recovery and interest/fee income are different measures; profitability requires a verified costing and allocation model.

## Reservation and disbursement behavior

Drafts hold no stock. Entering active review reserves the selected quantity; approval also ensures a valid reservation if a permitted path reaches approval directly. Available quantity is on-hand minus reserved, scoped by tenant, item, branch and currency.

Use a short database transaction to lock or atomically compare/update the balance, validate the item and available quantity, and persist the reservation and ledger movement together. All balance writers participating in the flow must observe the same concurrency control. Serialize commands for the same loan and give each logical operation a durable identifier. Do not hold a database transaction open across a Fineract network call.

Known stock loans missing stock selection or a product-to-stock association must block with an actionable message. Missing metadata must not silently turn them into ordinary cash loans. Product classification must use verified tenant configuration and Fineract product identity rather than a broad name prefix alone.

Changing quantity, item, branch or currency must atomically replace the old reservation or retain it intact if the new selection is unavailable. Rejection, cancellation or return to draft releases the recorded reservation exactly once; resubmission creates a fresh reservation generation. Release uses the reservation's persisted lines rather than potentially edited lead metadata.

Before disbursement, verify that the loan's reservation matches its current terms, remains supported by physical stock and belongs to an active item. Mark a durable operation pending, retaining the stock hold. On confirmed Fineract success, consume the reservation and record the issue exactly once. On confirmed failure, restore the appropriate approved reservation state. On timeout or ambiguous outcome, keep the hold and reconcile the Fineract loan/transaction state before retrying or releasing anything.

Use the coordinator in workflow approvals/disbursements, manual action and disbursement routes, and any other Loan Matrix command path found during the endpoint audit. Cover backward transitions and undo commands: a financial undo does not prove physical goods were returned, so record a reconciliation exception rather than inventing a stock receipt.

## External boundary

These guards enforce Loan Matrix operations. Users who call raw Fineract or use the raw Mifos UI can bypass Loan Matrix. Universal prevention requires separate Fineract-side enforcement or ARDA-specific restrictions on those command permissions. Do not silently remove administrative access; report this remaining boundary explicitly.

## Value improvements in this scope

- Display current branch availability and requested quantity during stock selection and approval.
- Provide clear shortage messages identifying the item, branch and available quantity.
- Show unresolved stock actions and aging reservations in the exception report.
- Preserve actor, timestamps and references for finance and operations review.
- Keep units and currencies separate and make the meaning of each financial measure explicit.

Further candidates to assess, rather than silently add: item reorder thresholds, batch/expiry tracking, branch transfers, procurement requests, and cost-based margin reporting. Each needs additional data or workflow decisions.

## Verification and rollout

Use behavior tests and a disposable database for concurrent reservations. Two requests competing for the last units must not both reserve or approve. Verify insufficient stock, inactive items, missing metadata, changed terms, release/resubmit, duplicate requests, confirmed failure, ambiguous external outcomes and recovery after a local finalization failure.

Exercise manual routes as well as state-machine transitions. Verify report totals with multiple items, units, offices and currencies, including reversed/released movements and date boundaries. Check exports, authorization and another tenant's unchanged behavior with new features disabled.

Prepare in an isolated branch, preserving existing local edits. Audit existing ARDA reservations and outstanding loans before enabling enforcement; expose inconsistencies rather than fabricating stock history. Enable only ARDA after the implementation is deployed and verified. Turning enforcement off is not a reason to delete reservations or audit records.

## Next task: missing stock details in Fineract reports

After the above work, trace the screenshot's loan by its actual loan ID to ARDA lead metadata, issue lines, the inventory catalogue and the Fineract arda_stock_details row. Verify the deployed metadata synchronization path and its tenant feature before attributing the issue to reporting SQL.

Backfill only fields supported by an unambiguous historical record, through ARDA's Fineract API, with before/after evidence and repeatable updates. Do not derive a stock item's identity or quantity solely from the loan amount or borrower name. If no reliable source exists, keep it explicitly missing and request the missing business information.

Investigate the Unknown loan status against the actual Fineract status and enum mapping. Verify whether the displayed Stock Value is captured inventory value or the existing SQL's principal fallback; make that distinction visible rather than treating the fallback as evidence that stock was captured. Re-run ARDA reports after correction and verify that other tenant definitions and settings remain unchanged.
