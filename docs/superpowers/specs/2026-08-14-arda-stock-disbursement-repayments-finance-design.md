# ARDA Stock Disbursement, Money Repayments, and Inventory Finance Design

## Purpose

This phase turns the first ARDA inventory screen into a usable lending workflow. Users should be able to configure practical stock setup values, receive stock into branches by branch name, issue stock to borrowers, record money repayments against issued stock value, and view a finance page that helps reconcile stock and money movement.

The first version keeps stock control local to Loan Matrix. Fineract remains the source for clients, loans, branches, and loan actions when needed, but physical inventory quantities and ARDA stock recovery balances are owned by Loan Matrix.

## Confirmed Business Rule

Repayments are money only against the value of stock issued.

This means repayments do not return physical inventory to stock. Instead, they reduce the outstanding money value the borrower still owes for issued stock.

## Scope

### Included

- Replace visible branch office ID fields with branch name dropdowns.
- Store and use the Fineract office ID internally after the user selects a branch name.
- Add a configurable unit dropdown for stock items.
- Add a configurable currency dropdown for stock values and repayments.
- Add stock issue/disbursement from branch stock.
- Add money repayment capture against issued stock.
- Add an inventory finance page that summarizes received stock, issued stock, repayments collected, outstanding stock recovery, and balancing position.

### Excluded From This Phase

- Crop or produce repayments.
- Fineract accounting journal entries.
- Automatic Fineract loan disbursement as part of stock issue.
- Multi-level approval for stock issue.
- Full tenant-level settings administration for units and currencies beyond an initial local configurable list.

## User Experience

### Stock Setup

The inventory page should show `Branch` as a dropdown with human-readable branch names instead of asking users to type a branch office ID. The selected branch still maps to the Fineract office ID internally.

The stock item form should use a unit dropdown rather than a free text field. Initial units:

- bag
- kg
- tonne
- litre
- box
- unit

The value fields should include currency. Initial currencies:

- USD
- ZMW
- ZWL

### Stock Issue

Users should issue stock from a selected branch to a borrower or loan reference. The form should capture:

- Branch
- Stock item
- Borrower/client name or reference
- Optional Fineract loan ID or loan account number
- Quantity issued
- Unit value
- Currency
- Notes/reference

When stock is issued:

- Quantity on hand decreases.
- Stock value decreases.
- A stock issue record is created.
- An inventory movement of type `ISSUE` is recorded.
- The issue has a recoverable money value equal to quantity times unit value.

If the branch does not have enough available stock, the system must block the issue.

### Money Repayments

Users should select an issued stock record and record money paid by the borrower. The form should capture:

- Stock issue
- Payment amount
- Currency
- Payment date
- Payment reference
- Notes

When a repayment is recorded:

- It does not increase physical stock.
- It increases repayments collected.
- It reduces outstanding money recovery for that stock issue.
- The system blocks overpayment unless the user later requests overpayment handling.

### Inventory Finances

Add an `Inventory Finances` view under Inventory. It should show:

- Total stock received value
- Total stock issued value
- Total repayments collected
- Outstanding stock recovery
- Current stock value on hand
- Balance/reconciliation position

Recommended reconciliation formula for this phase:

```text
Outstanding stock recovery = stock issued value - repayments collected
Inventory position = current stock value on hand + outstanding stock recovery
```

This lets the user compare what remains in stock plus what is still owed by borrowers.

## Data Model Changes

Add branch display metadata to stock balances and movements where useful:

- `fineractOfficeName`

Add currency to inventory values:

- Inventory item default currency
- Inventory balance currency
- Inventory movement currency
- Stock issue currency

Add money repayment records:

- Tenant ID
- Stock issue ID
- Amount
- Currency
- Payment date
- Payment reference
- Notes
- Actor user ID/name
- Created date

Stock issue records already exist in the schema foundation, so this phase should extend and use them rather than creating a separate unrelated issue table.

## API Design

Add or extend APIs:

- `GET /api/inventory/config` for units, currencies, and branches.
- `POST /api/inventory/items` to accept unit and currency.
- `POST /api/inventory/receipts` to accept branch selection by office ID/name and currency.
- `POST /api/inventory/issues` to issue stock.
- `GET /api/inventory/issues` to list stock issues and outstanding recovery.
- `POST /api/inventory/repayments` to record money repayments.
- `GET /api/inventory/finances` to summarize inventory financial position.

All write endpoints must remain tenant scoped and authenticated.

## Error Handling

- Missing branch, item, quantity, value, or currency should return a clear validation error.
- Stock issue with insufficient available stock should be blocked.
- Repayment greater than outstanding issue value should be blocked.
- Duplicate retries should be safe using idempotency keys where movements affect stock or money balances.
- Fineract branch lookup failure should show a friendly message and allow the rest of local inventory data to load where possible.

## Testing

Automated tests should cover:

- Branch dropdown uses names while storing Fineract office ID internally.
- Unit and currency dropdowns appear on the inventory page.
- Stock issue reduces on-hand quantity and stock value.
- Stock issue fails when available stock is insufficient.
- Money repayment reduces outstanding recovery.
- Money repayment fails when it exceeds outstanding value.
- Inventory finance summary calculates received, issued, repaid, outstanding, and current stock value correctly.

Manual testing should cover:

- Create stock item.
- Receive stock into a named branch.
- Issue stock to a borrower/loan reference.
- Record money repayment.
- Check inventory finance page balances.

## Open Follow-Up Items

- Decide whether unit and currency lists should later become tenant-admin configurable screens.
- Decide when stock issue should become part of the formal Fineract loan disbursement flow.
- Decide whether stock issue should require approval before reducing stock.
