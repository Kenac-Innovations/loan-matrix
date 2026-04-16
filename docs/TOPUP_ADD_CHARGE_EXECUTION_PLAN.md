# Top-Up Add-Charge Execution Plan

## Goal

For top-up loans, do not rely on Fineract automatically applying disbursement charges on the full new principal.

Instead:

1. identify the charges to apply from Prisma
2. match them to Fineract charges using `fineractChargeId`
3. apply them through the Fineract loan add-charge endpoint
4. calculate each charge amount using:

`new loan principal - old loan balance`

Example:

- old loan balance = `5,000`
- new loan principal = `9,000`
- charge base = `4,000`

Each qualifying top-up disbursement charge must be applied on `4,000`, not `9,000`.

## Charge Selection Rules

For top-up loans, select only Prisma charge products that satisfy all of the following:

- `chargeTimeType = DISBURSEMENT`
- `active = true`
- `fineractChargeId` is present
- `fineractChargeTimeType = SPECIFIED_DUE_DATE`

These Prisma records are the source of truth for which charges should be applied in the custom top-up flow.

Matching to Fineract is done through:

- `ChargeProduct.fineractChargeId` -> Fineract `chargeId`

## Intended Runtime Behavior

When a loan is a top-up:

1. get the new loan principal
2. get the old loan balance from the loan being topped up
3. compute:

`difference = new loan principal - old loan balance`

4. load qualifying Prisma charge products
5. for each matching charge product:
   - use `fineractChargeId` as the `chargeId`
   - calculate the actual amount on the `difference`
   - call the Fineract add-charge endpoint for the loan

The add-charge request should send the final actual amount, not the full new principal and not a template-derived amount.

## Current Problem Being Fixed

Today, top-up loans can still end up with disbursement charges being applied from the normal loan creation flow, which allows Fineract to use the full new principal.

That is not the intended behavior for top-ups.

The new top-up rule should be:

- top-up disbursement charges are added explicitly through add-charge
- charge base is always the difference
- full-principal automatic application must not be the source for top-up charges

## Execution Plan

### 1. Identify the top-up-only charge path

Use the existing top-up-specific charge flow as the main implementation point.

Primary file:

- [lib/topup-disbursement-charge-service.ts](/home/parten/Documents/kenac%20dev/Loan%20Matrix/loan-matrix/lib/topup-disbursement-charge-service.ts)

This is the right place because it already:

- detects top-up loans
- reads top-up loan details
- calculates a remaining amount
- applies charges via Fineract add-charge

### 2. Tighten Prisma charge filtering

Update the Prisma query so that top-up charges are selected only when all of these are true:

- `type = LOAN`
- `chargeTimeType = DISBURSEMENT`
- `active = true`
- `syncStatus = SYNCED`
- `fineractChargeId != null`
- `fineractChargeTimeType = SPECIFIED_DUE_DATE`

This ensures the system only applies the intended custom add-charge-compatible charge products.

### 3. Use the difference as the charge base

Compute:

`difference = new loan principal - old loan balance`

Data sources:

- new loan principal from the created/disbursed loan
- old loan balance from the top-up details / loan being closed

Guardrails:

- if either value is missing, skip safely and log clearly
- if `difference <= 0`, skip safely

### 4. Calculate the final amount for each charge

For every qualifying Prisma charge product:

- read the Prisma charge configuration
- calculate the actual amount using the `difference`
- send that final amount to Fineract as the `amount`

Important:

- Fineract charge time type is `SPECIFIED_DUE_DATE`
- Fineract charge calculation type is effectively handled as `FLAT` at add-charge time because we send the final computed amount

So the application logic must compute the amount first, then call add-charge.

### 5. Apply charges through Fineract add-charge only

Use:

- `POST /loans/{loanId}/charges`

Payload per charge should include:

- `chargeId`
- `amount`
- `dueDate`
- `dateFormat`
- `locale`

Where:

- `chargeId` comes from `fineractChargeId`
- `amount` is calculated from the `difference`

### 6. Prevent top-up charges from being applied automatically on full principal

For top-up loans, disbursement charges that belong to this custom flow must not be allowed to remain in the normal automatic loan-creation charge path.

That means we need to stop top-up disbursement charges from being applied by the standard creation behavior before the custom add-charge logic runs.

Implementation effect:

- top-up loans use custom add-charge logic for disbursement charges
- non-top-up loans keep current behavior unless separately changed

### 7. Add idempotency protection

Before adding a charge, check whether the same charge already exists on the loan for the same effective amount/date combination.

Purpose:

- avoid double charging if disbursement logic runs more than once
- avoid duplicate add-charge calls across different disbursement entry points

### 8. Test scenarios

Add verification for these cases:

- top-up loan with `new principal = 9000` and `old balance = 5000` applies charges on `4000`
- only Prisma charges matching all required conditions are selected
- charge uses `fineractChargeId` when calling add-charge
- non-top-up loans do not use this top-up path
- missing old balance causes safe skip
- repeated trigger does not duplicate charges
- top-up loans no longer depend on Fineract automatic full-principal disbursement charge behavior

## Acceptance Criteria

The feature is correct when all of the following are true:

- a top-up loan does not get its target disbursement charges based on the full new principal
- qualifying Prisma charge products are selected by `fineractChargeId`
- only active `DISBURSEMENT` charges with Fineract time type `SPECIFIED_DUE_DATE` are used
- each selected charge is applied through add-charge
- the applied amount is based on:

`new loan principal - old loan balance`

- duplicate charge creation is prevented

## Summary

The intended top-up behavior is:

- find matching Prisma charge products
- filter to active disbursement charges with `fineractChargeTimeType = SPECIFIED_DUE_DATE`
- match to Fineract using `fineractChargeId`
- calculate each charge on the difference between the new principal and the old loan balance
- apply the charge through the Fineract add-charge endpoint

That is the execution model this plan is designed to implement.
