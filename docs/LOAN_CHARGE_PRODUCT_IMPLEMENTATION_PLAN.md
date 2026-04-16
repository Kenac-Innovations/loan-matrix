# Loan Matrix Charge Product Plan (Fineract Reflection)

## Goal
Add a Loan Matrix feature to create **loan charge products** from our UI, persist them in Prisma, create the matching charge in Fineract, and store the returned Fineract charge ID locally.

This is only for maintaining charge-product definitions (placeholders), not yet for applying/collecting charges during disbursement.

## Confirmed Requirements (From You)
- Create charge product from Loan Matrix UI (instead of using Mifos UI at `#/products/charges/create`).
- Persist charge product in local Prisma table.
- After local save, create same charge in Fineract.
- Persist returned Fineract charge ID in local table.
- Fixed Fineract defaults on create:
1. `chargeCalculationType = Flat`
2. `chargePaymentMode = Regular`
3. `amount = 1` for the placeholder charge created in Fineract (local Prisma still keeps full detail)
4. `active = true`
- Form should ask for:
1. charge name
2. amount
3. currency
4. type (show all options used by Mifos UI)
- Charge time type in Loan Matrix UI must show the same options as Mifos create-charge form.
- Charge time type in Loan Matrix UI should have **no default selection** (user must choose).
- Save enum values in Prisma (not numeric Fineract IDs).
- Special rule for Fineract sync:
1. if user selects `Disbursement`, send `Specified due date` to Fineract instead
2. if user selects `Disbursement`, also force Fineract `chargeCalculationType = Flat` and `amount = 1`
3. all other charge time selections are sent as selected
4. this is intentional so charges are not auto-applied by Fineract on disbursement yet
5. Loan Matrix still stores the full original charge details in Prisma; Prisma remains source of truth for later manual charge execution

## Cluster Verification (What Serves Your URL)
From cluster inspection:
- URL `loan-matrix.kenac.co.zw` is currently routed by Istio VirtualService `mifos-ui-dev-vs` in namespace `mifos-ui-dev`.
- It routes to service `mifos-ui-dev` (port `80`) and pods:
1. `mifos-ui-dev-5b97977497-ddh6b`
2. `mifos-ui-dev-5b97977497-mcxsx`
3. `mifos-ui-dev-5b97977497-zbmv2`
- Image used: `ghcr.io/kenac-innovations/mifos-web-app:dev-ad5240e`.
- Fineract backend configured in pod env: `https://mifos-be.kenac.co.zw`.

## Current Codebase Findings
- Loan Matrix already has strong Fineract proxy/API patterns in `app/api/fineract/*`.
- There is no existing global `/api/fineract/charges` proxy route yet (only loan-level charge routes under `/api/fineract/loans/[id]/charges`).
- Prisma already uses enums in other modules (good precedent for your enum requirement).
- Sidebar/navigation can be extended in `app/(application)/components/sidebar-nav.tsx`.

## Proposed Design

### 1) Prisma Model + Enums
Create a new model, e.g. `ChargeProduct`, with enum fields (not IDs):
- `id` (cuid)
- `tenantId` (for multi-tenant isolation)
- `name`
- `amount` (Decimal)
- `currencyCode` (String)
- `type` (enum; see mapping section)
- `chargeAppliesTo` (enum)
- `chargeTimeType` (enum, required, no DB default; stores user-selected value)
- `fineractChargeTimeType` (enum, stores the effective value sent to Fineract after override mapping)
- `chargeCalculationType` (enum, default `FLAT`)
- `fineractChargeCalculationType` (enum, effective value sent to Fineract)
- `chargePaymentMode` (enum, default `REGULAR`)
- `active` (Boolean, default `true`)
- `fineractChargeId` (Int?, unique per tenant when present)
- `fineractAmount` (Decimal, effective amount sent to Fineract; supports placeholder/audit)
- `syncStatus` (enum: `PENDING | SYNCED | FAILED`)
- `syncError` (String?, last Fineract error if failed)
- `createdAt`, `updatedAt`

Suggested enums:
- `ChargeType` (depends on your intended meaning of "type"; see assumptions)
- `ChargeAppliesToEnum`: `LOAN | SAVINGS | CLIENT | SHARES`
- `ChargeTimeTypeEnum`: include Fineract template values (no default for UI selection)
- `ChargeCalculationTypeEnum`: include Fineract template values and default to `FLAT`
- `ChargePaymentModeEnum`: `REGULAR | ACCOUNT_TRANSFER` (default `REGULAR`)

### 2) Fineract Proxy Endpoints (New)
Add:
- `GET /api/fineract/charges/template` -> forwards to Fineract `/charges/template`
- `GET /api/fineract/charges` -> forwards to Fineract `/charges`
- `POST /api/fineract/charges` -> forwards to Fineract `/charges`

Reason: this matches existing Loan Matrix architecture and lets the UI consume template options exactly like Mifos.

### 2.1) Mifos-Style Template Loading (Mirror Exactly)
Loan Matrix create-charge form should load template data the same way Mifos does:
1. Call `GET /api/fineract/charges/template` on form init.
2. Bind option lists from template response:
   - `currencyOptions`
   - `chargeAppliesToOptions`
   - `chargeTimeTypeOptions`
   - `chargeCalculationTypeOptions`
   - `chargePaymentModeOptions`
   - specialized options like `loanChargeTimeTypeOptions` where relevant
3. On submit, call `POST /api/fineract/charges` with mapped numeric IDs from those selected options.

For loan charges specifically, prefer the loan-scoped option arrays from template payload (for example `loanChargeTimeTypeOptions`) so displayed choices match Mifos behavior for `chargeAppliesTo = Loan`.

### 3) Loan Matrix Charge Product API (New)
Add app-owned endpoints, e.g.:
- `GET /api/charge-products`
- `POST /api/charge-products`

`POST` flow:
1. Validate payload with Zod.
2. Save local `ChargeProduct` row first with `syncStatus = PENDING`.
3. Build Fineract payload (fixed defaults + mapped IDs from template/options).
4. Apply charge-time override before Fineract call:
   - if local `chargeTimeType = DISBURSEMENT`, set:
     - Fineract `chargeTimeType = SPECIFIED_DUE_DATE`
     - Fineract `chargeCalculationType = FLAT`
     - Fineract `amount = 1`
   - else use selected charge time type unchanged
5. Save effective outbound values to local audit columns:
   - `fineractChargeTimeType`
   - `fineractChargeCalculationType`
   - `fineractAmount`
6. Keep original local values (`chargeTimeType`, `chargeCalculationType`, `amount`) unchanged as business source of truth.
7. Call `/api/fineract/charges` to create Fineract charge.
8. Update local row: `fineractChargeId`, `syncStatus = SYNCED`, clear `syncError`.
9. If Fineract create fails: keep local row, set `syncStatus = FAILED`, store `syncError`.

This preserves your requested save order (local first, then Fineract) and gives visibility for retries.

### 4) UI (New Screen)
Create new screen under app area, suggested route:
- `/products/charges` (list)
- `/products/charges/new` (create form)

Form fields:
- Charge name
- Amount
- Currency (from Fineract `currencyOptions`)
- Type (from mapped Mifos/Fineract options)
- Charge time type (from the same template options used by Mifos; persisted as enum in Prisma)

Display fixed values/defaults in helper text so users see what is enforced:
- Calculation type: Flat
- Payment mode: Regular
- Active: true

Charge time handling:
- show same list as Mifos in dropdown
- no default selected value; user must choose
- persist selected value as enum code in Prisma (not Fineract numeric ID)
- at sync boundary only:
1. `DISBURSEMENT` is remapped to `SPECIFIED_DUE_DATE` for Fineract create
2. `DISBURSEMENT` also forces outbound Fineract `chargeCalculationType = FLAT` and `amount = 1`
3. all other options pass through as selected
- persist mapped outbound values in:
  - `fineractChargeTimeType`
  - `fineractChargeCalculationType`
  - `fineractAmount`
- keep original local details untouched for manual disbursement charge processing later

Loan charge time options expected from template (Fineract loan set):
1. Disbursement
2. Specified due date
3. Instalment fee
4. Overdue installment
5. Tranche disbursement

### 5) Enum Mapping (No ID Storage)
Use Fineract template options to map:
- incoming UI selection -> enum code in DB
- enum code -> numeric Fineract ID only at API call time

Examples:
- `chargeTimeType.disbursement` (user selection) -> `chargeTimeType.specifiedDueDate` (Fineract payload override)
- `amount = 250` locally + `DISBURSEMENT` selected -> send `amount = 1` to Fineract; keep local `amount = 250`
- `chargeTimeType.specifiedDueDate` <-> `SPECIFIED_DUE_DATE` (no override)
- `chargeCalculationType.flat` <-> `FLAT`
- `chargepaymentmode.regular` <-> `REGULAR`
- `chargeAppliesTo.loan` <-> `LOAN`

This satisfies “save enum, not ID” while still sending required IDs to Fineract.

## Rollout Phases
1. Schema: Prisma model + enums + migration.
2. Fineract proxies: `/api/fineract/charges*`.
3. Domain APIs: `/api/charge-products` with local-first sync flow.
4. UI pages + nav link.
5. Testing + hardening (error cases, duplicate names, retry path for failed sync).

## Test Plan
- API validation tests for required fields/enums.
- Integration test for `POST /api/charge-products` success path:
1. local row created
2. Fineract charge created
3. local row updated with `fineractChargeId`
- Integration test for charge-time override:
1. submit with `chargeTimeType = DISBURSEMENT`
2. verify Fineract payload uses `SPECIFIED_DUE_DATE`
3. verify Fineract payload uses `chargeCalculationType = FLAT` and `amount = 1`
4. verify local row keeps original values (`chargeTimeType`, `amount`, `chargeCalculationType`) and stores outbound mapped values in `fineractCharge*` columns
- Integration test for Fineract failure path:
1. local row remains
2. `syncStatus = FAILED`
3. `syncError` populated
- UI test: type dropdown shows template-derived options; fixed fields remain enforced.

## Out of Scope (Explicitly Deferred)
- Applying these charges at loan disbursement.
- Auto-charging/settlement logic.
- Any disbursement-time financial posting.

## Assumptions to Confirm Before Build
1. **Type meaning:** I am assuming your `type` field means the same category shown in Mifos charge creation (likely `chargeAppliesTo` and/or fee-vs-penalty behavior).  
2. **Amount behavior for non-Disbursement selections:** confirm whether Fineract placeholder amount should still be forced to `1`, or follow the entered form amount.
3. **Penalty behavior:** If not specified, I will default `penalty = false` (fee placeholder).

Once you confirm those 3 points, implementation can proceed with minimal risk.
