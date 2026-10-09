# ARDA Fineract Stock Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ARDA-only stock disbursement, repayment, and monthly best-selling-item reports to the existing Reports page, backed by synchronized loan-level stock metadata in Fineract.

**Architecture:** Loan Matrix keeps its existing ARDA inventory records and copies each approved one-item stock selection into a single-row Fineract loan data table only when `Tenant.settings.features.ardaStockReports` is enabled. Both Loan Matrix disbursement entry points refresh that row before disbursement, while Fineract Table reports join it to native loan and transaction tables. Report definitions and the hidden stock-item option report are created through the Fineract Reports API; only the reusable custom parameter record is registered directly in the ARDA Fineract parameter catalog because Fineract has no API for creating parameter definitions.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Apache Fineract REST API and Table reports, PostgreSQL `psql`, Node test runner with `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-09-arda-fineract-stock-reports-design.md`

## Global Constraints

- Apply all data-table, parameter, report, permission, synchronization, and backfill behavior only when the Loan Matrix tenant slug and Fineract tenant ID equal `arda` case-insensitively and `Tenant.settings.features.ardaStockReports` is exactly `true`.
- Add `ardaStockReports` to the existing tenant feature settings with a global default of `false`; enable it only in the database row whose slug is `arda`.
- Do not add or change artifacts in Goodfellow, Omama, or any other tenant.
- Keep `ARDA Disbursements by Month` unchanged.
- Use Fineract as the source of disbursement, repayment, allocation, balance, user, and loan-status values.
- Store one approved stock selection per Fineract loan; never infer missing item names, quantities, units, or unit values.
- Show historical monetary values with `Not captured` item context when no stock row exists.
- Block Fineract disbursement when the final ARDA stock row cannot be synchronized.
- Preserve a successfully created and locally linked Fineract loan when the initial metadata synchronization fails; record and return the warning for later repair.
- Every provisioning and backfill command defaults to preview mode and requires `--apply` for writes.
- Use standard Fineract parameter IDs `1` (`startDate`), `2` (`endDate`), `5` (`officeId`), `10` (`currencyId`), and `25` (`loanProductId`); resolve the new `stockItemId` parameter ID from the ARDA catalog.
- Keep unrelated working-tree changes unmodified and unstaged.

## Review Focus

- A request whose Loan Matrix tenant is `arda` but whose resolved Fineract tenant is anything else, or whose database feature flag is missing/false, must fail before any Fineract read or write; Tasks 1 and 2 test this boundary.
- A stock selection changed after initial loan creation must overwrite the existing row immediately before disbursement; Tasks 2 and 3 test update and call order.
- A metadata outage after loan creation must leave the Fineract loan linked locally and return a visible warning, while the same outage before disbursement must block it; Task 3 tests both outcomes.
- A historical issue with zero or multiple stock lines must be skipped with a reason instead of collapsing or inventing item data; Task 6 tests these inputs.
- Re-running setup must update the same parameter, reports, permissions, and data table without duplicates; Task 5 tests the idempotent create/update paths.

---

## File Structure

- Modify `shared/types/tenant.ts` to define the database-backed `ardaStockReports` feature flag with a false default.
- Create `lib/tenant-arda-stock-reports.ts` for the combined slug-and-setting gate.
- Modify `lib/inventory/arda-stock-workflow-service.ts` to expose one normalized ARDA stock-details model already used by the inventory workflow.
- Create `lib/fineract-arda-stock-details.ts` for tenant-gated data-table registration and row upsert.
- Modify `app/api/leads/[id]/create-loan/route.ts` for the initial non-destructive synchronization.
- Create `lib/arda-stock-disbursement-guard.ts` to make sync-before-disbursement ordering directly testable.
- Modify `lib/team-state-machine-service.ts` for the blocking pre-disbursement synchronization.
- Modify `app/api/fineract/loans/[id]/disburse/route.ts` so direct loan-detail disbursements use the same guard.
- Create `lib/fineract-arda-stock-reports.ts` for immutable report names, SQL, parameter lists, and API payloads.
- Create `lib/fineract-arda-stock-report-setup.ts` for preview/apply orchestration, custom-parameter catalog SQL, report upsert, and role permission assignment.
- Create `scripts/setup-arda-stock-reports.ts` as the operational setup entry point.
- Create `lib/arda-stock-details-backfill.ts` for mapping existing local issues to the Fineract row shape.
- Create `scripts/backfill-arda-stock-details.ts` as the preview/apply backfill entry point.
- Create `scripts/verify-arda-stock-reports.ts` for ARDA report, value, export-shape, and cross-tenant checks.
- Create `docs/runbooks/arda-stock-reports.md` with setup, verification, backfill, and rollback commands.
- Add focused tests under `lib/__tests__` beside the existing ARDA and Fineract tests.

## Task 1: Add The Database Tenant Gate And Normalize Stock Details

**Files:**
- Modify: `shared/types/tenant.ts`
- Create: `lib/tenant-arda-stock-reports.ts`
- Modify: `lib/inventory/arda-stock-workflow-service.ts`
- Modify: `lib/__tests__/arda-stock-loan.test.ts`
- Create: `lib/__tests__/tenant-arda-stock-reports.test.ts`

**Interfaces:**
- Produces: `isArdaStockReportsEnabled` plus `ArdaStockDetails` and `getArdaStockDetails(lead: WorkflowLead): ArdaStockDetails | null`.
- Consumers: Tasks 2, 3, and 6.

```ts
export function isArdaStockReportsEnabled(input: {
  tenantSlug?: string | null;
  tenantSettings?: unknown;
}): boolean;
```

```ts
export type ArdaStockDetails = {
  stockItemId: string;
  stockItemName: string;
  fineractOfficeId: number;
  fineractOfficeName?: string;
  quantity: string;
  unitOfMeasure: string;
  unitValue: string;
  totalStockValue: string;
  currencyCode: string;
  stockIssueReference: string;
};
```

- [ ] **Step 1: Write failing tenant-setting tests**

Create `lib/__tests__/tenant-arda-stock-reports.test.ts`. Assert that only slug `arda` plus `settings.features.ardaStockReports === true` returns true. Missing settings, missing feature, false, truthy non-boolean values, and Goodfellow with the flag set all return false. Assert `DEFAULT_FEATURES.ardaStockReports === false`.

- [ ] **Step 2: Run the tenant-setting test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/tenant-arda-stock-reports.test.ts`

Expected: FAIL because the setting and helper do not exist.

- [ ] **Step 3: Define the feature and gate**

Add `ardaStockReports: boolean` to `TenantFeatures` and set it to `false` in `DEFAULT_FEATURES`. Implement `isArdaStockReportsEnabled` with an exact boolean check and the existing `isArdaTenantSlug` helper.

- [ ] **Step 4: Write failing normalization tests**

Extend `lib/__tests__/arda-stock-loan.test.ts` with assertions that `getArdaStockDetails` returns the eight reporting fields plus the two local office fields above, recalculates `12.5 × 24.00` as `300.00`, uses the lead ID as the reference when no external reference exists, and returns `null` for a Goodfellow lead. Add rejection cases for blank units, non-positive quantity, non-positive unit value, and a saved total that differs from the recalculated total.

- [ ] **Step 5: Run the normalization test and verify the new cases fail**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-loan.test.ts`

Expected: FAIL because the helper and normalized fields are not exported.

- [ ] **Step 6: Export the normalized contract**

Add `unitOfMeasure` to `ArdaStockSelection`, export `WorkflowLead`, `ArdaStockDetails`, and `getArdaStockDetails`, rename `totalValue` in the returned reporting contract to `totalStockValue`, and retain `fineractOfficeId` and `fineractOfficeName` for the local inventory workflow. Reject a stored `totalValue` when it differs from `quantity × unitValue` after two-decimal normalization.

- [ ] **Step 7: Run the focused tests**

Run: `pnpm exec tsx --test lib/__tests__/tenant-arda-stock-reports.test.ts lib/__tests__/arda-stock-loan.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add shared/types/tenant.ts lib/tenant-arda-stock-reports.ts \
  lib/inventory/arda-stock-workflow-service.ts \
  lib/__tests__/tenant-arda-stock-reports.test.ts lib/__tests__/arda-stock-loan.test.ts
git commit -m "feat: gate ARDA stock reports by tenant setting"
```

## Task 2: Register And Upsert The Fineract Loan Data Table

**Files:**
- Create: `lib/fineract-arda-stock-details.ts`
- Create: `lib/__tests__/fineract-arda-stock-details.test.ts`

**Interfaces:**
- Consumes: `ArdaStockDetails` from Task 1 and the existing `fetchFineractAPI` service-auth path.
- Produces: the constants and functions below for Tasks 3, 5, and 6.

```ts
export const ARDA_STOCK_DETAILS_TABLE = "arda_stock_details";
export type FineractRequester = (
  endpoint: string,
  options?: import("@/lib/api").FineractRequestInit,
) => Promise<unknown>;
export function buildArdaStockDetailsPayload(details: ArdaStockDetails): Record<string, string>;
export async function ensureArdaStockDetailsDatatable(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
  request: FineractRequester;
}): Promise<"created" | "exists">;
export async function upsertArdaStockDetails(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
  fineractLoanId: number;
  details: ArdaStockDetails;
  request: FineractRequester;
}): Promise<"created" | "updated">;
export async function syncArdaStockDetailsForCurrentTenant(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractLoanId: number;
  details: ArdaStockDetails;
}): Promise<"created" | "updated">;
```

- [ ] **Step 1: Write failing tenant, schema, and upsert tests**

Create `lib/__tests__/fineract-arda-stock-details.test.ts` using an injected request recorder. Assert that tenant mismatch and a missing/false database feature flag reject before the recorder is called; the registration payload is single-row on `m_loan` with only the eight approved reporting columns; an empty GET result causes POST; an existing row causes PUT to `/datatables/arda_stock_details/{loanId}`; repeated calls never POST a second row; and the payload recalculates and verifies the total.

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/fineract-arda-stock-details.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement tenant-gated registration and upsert**

Use POST `/datatables` for registration and ignore only an explicit `409` or already-exists response. For a loan row, GET `/datatables/arda_stock_details/{loanId}` with service authentication, POST when no row is returned, and PUT when a row exists. Every exported write function must call `isArdaStockReportsEnabled`, then compare the resolved Fineract tenant with the supplied application tenant before I/O. The current-tenant wrapper resolves `getFineractTenantId()` and passes a service-auth requester.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm exec tsx --test lib/__tests__/fineract-arda-stock-details.test.ts lib/__tests__/arda-stock-loan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fineract-arda-stock-details.ts \
  lib/__tests__/fineract-arda-stock-details.test.ts
git commit -m "feat: sync ARDA stock details to Fineract"
```

## Task 3: Synchronize At Loan Creation And Before Disbursement

**Files:**
- Modify: `app/api/leads/[id]/create-loan/route.ts`
- Create: `lib/arda-stock-disbursement-guard.ts`
- Modify: `lib/team-state-machine-service.ts`
- Modify: `app/api/fineract/loans/[id]/disburse/route.ts`
- Create: `lib/__tests__/arda-stock-sync-wiring.test.ts`

**Interfaces:**
- Consumes: `getArdaStockDetails` and `syncArdaStockDetailsForCurrentTenant`.
- Produces: `stockDetailSync: { status: "synced" | "failed" | "skipped"; message?: string }` in the create-loan response and `stateMetadata.ardaStockDetailSync` for audit and repair, plus the guard below.

```ts
export async function runArdaStockDisbursementGuard<T>(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractLoanId: number;
  details: ArdaStockDetails | null;
  sync?: typeof syncArdaStockDetailsForCurrentTenant;
  disburse: () => Promise<T>;
}): Promise<T>;
```

- [ ] **Step 1: Write failing lifecycle tests**

Create `lib/__tests__/arda-stock-sync-wiring.test.ts`. Assert from the create-loan route source that the local `prisma.lead.update` remains before the initial sync and that sync failures populate a warning rather than delete or unlink the loan. Unit-test `runArdaStockDisbursementGuard` with injected spies: successful ARDA sync precedes disbursement, failed sync prevents disbursement, changed details reach the sync call, and a non-ARDA or null-detail input calls disbursement without a Fineract metadata request. Assert both the state-machine disbursement and `app/api/fineract/loans/[id]/disburse/route.ts` invoke this guard around their Fineract disbursement callback.

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-sync-wiring.test.ts`

Expected: FAIL because neither lifecycle path calls the sync service.

- [ ] **Step 3: Add initial synchronization after durable loan linking**

Load the lead’s tenant slug and settings with the lead. After the existing local loan-link update, normalize the stock selection and call the current-tenant sync with those settings. Save a success or failure object under `stateMetadata.ardaStockDetailSync`, include the same result in the JSON response, and append a user-visible warning on failure. Disabled, non-ARDA, or non-stock loans return `skipped`. SMS and CDE remain best-effort and retain their existing order after this block.

- [ ] **Step 4: Add the blocking pre-disbursement refresh**

Implement `runArdaStockDisbursementGuard` as the wrapper around each existing Fineract disbursement callback. In `TeamStateMachineService.triggerFineractAction`, pass the already-loaded tenant settings, normalize the final selection, and invoke the wrapper immediately where `fineract.disburseLoan` currently runs. In the direct disbursement route, retain the tenant-scoped linked lead and tenant settings after the access check, normalize it, and wrap the existing `fetchFineractAPI(...command=disburse)` call. Allow sync errors to propagate into each path’s existing failure response so the external disbursement does not run. Do not add calls to approve, reject, payout, or non-ARDA paths.

- [ ] **Step 5: Run lifecycle and regression tests**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-sync-wiring.test.ts lib/__tests__/manual-create-loan-linking.test.ts lib/__tests__/team-state-machine-auto-disbursement.test.ts lib/__tests__/arda-stock-loan.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'app/api/leads/[id]/create-loan/route.ts' \
  'app/api/fineract/loans/[id]/disburse/route.ts' \
  lib/arda-stock-disbursement-guard.ts lib/team-state-machine-service.ts \
  lib/__tests__/arda-stock-sync-wiring.test.ts
git commit -m "feat: require ARDA stock metadata before disbursement"
```

## Task 4: Define The Three Fineract Reports

**Files:**
- Create: `lib/fineract-arda-stock-reports.ts`
- Create: `lib/__tests__/fineract-arda-stock-reports.test.ts`

**Interfaces:**
- Produces: `ARDA_STOCK_REPORT_NAMES`, `ARDA_STOCK_ITEM_OPTIONS_REPORT`, and `buildArdaStockReportDefinitions(stockItemParameterId: number): FineractReportDefinition[]` for Task 5.

- [ ] **Step 1: Write failing definition tests**

Create `lib/__tests__/fineract-arda-stock-reports.test.ts` and assert four definitions: one hidden stock-item option report and the three visible reports named exactly `ARDA Stock Disbursement Report`, `ARDA Stock Repayment Report`, and `ARDA Stock Item Performance`. Assert standard parameter IDs and the supplied stock-item ID, current-user plus selected-office hierarchy conditions, inclusive dates, currency/product/item filters, unreversed transaction predicates, `Not captured` fallback, repayment allocation columns, and conditional monthly `DENSE_RANK`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/fineract-arda-stock-reports.test.ts`

Expected: FAIL because the report module does not exist.

- [ ] **Step 3: Implement the option and disbursement definitions**

The hidden option report returns distinct `stock_item_id` and `stock_item_name` for loans under `${currentUserHierarchy}`. The disbursement SQL uses `m_loan_transaction.transaction_type_enum = 1`, excludes reversals, joins `arda_stock_details` by `loan_id`, returns one row per transaction, uses the data-table total with transaction amount fallback, and includes repaid/outstanding values from `m_loan`.

- [ ] **Step 4: Implement repayment and monthly performance definitions**

The repayment SQL uses transaction type `2`, excludes reversals, joins payment type and `m_appuser`, and returns amount plus principal, interest, fee, penalty, and post-transaction balance. The performance SQL aggregates disbursements by `date_trunc('month', transaction_date)`, item, and unit; counts transactions; sums quantity and value; calculates both averages; and assigns no rank to `Not captured` rows.

- [ ] **Step 5: Run the definition tests**

Run: `pnpm exec tsx --test lib/__tests__/fineract-arda-stock-reports.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/fineract-arda-stock-reports.ts \
  lib/__tests__/fineract-arda-stock-reports.test.ts
git commit -m "feat: define ARDA Fineract stock reports"
```

## Task 5: Provision Reports, Parameter, And Permissions Idempotently

**Files:**
- Create: `lib/fineract-arda-stock-report-setup.ts`
- Create: `scripts/setup-arda-stock-reports.ts`
- Create: `lib/__tests__/arda-stock-report-setup.test.ts`

**Interfaces:**
- Consumes: data-table registration from Task 2 and report definitions from Task 4.
- Produces: `setupArdaStockReports(options: ArdaStockReportSetupOptions): Promise<ArdaStockReportSetupResult>` and a CLI accepting `--tenant=arda`, repeatable `--role-id=<positive integer>`, and optional `--apply`.

- [ ] **Step 1: Write failing preview, isolation, and idempotency tests**

Using injected Loan Matrix, API, and catalog clients, assert preview returns the planned ARDA tenant-setting merge, table, selector, parameter, three reports, and role updates without writes; `--apply` rejects any tenant other than `arda`, a database name other than `fineract_tenant_arda`, or an empty role list; the settings merge preserves unrelated keys and changes no other tenant row; create mode POSTs each missing report; update mode PUTs each matching name without duplicates; the same parameter ID is reused; and permission updates preserve existing role permissions.

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-report-setup.test.ts`

Expected: FAIL because the setup module does not exist.

- [ ] **Step 3: Implement guarded catalog registration**

Use the repository’s existing `psql` execution pattern and `FINERACT_DB_HOST`, `FINERACT_DB_PORT`, `FINERACT_DB_USER`, `FINERACT_DB_PASSWORD`, and `FINERACT_DB_NAME`. Upsert one `stretchy_parameter` row with variable `stockItemId`, label `Stock Item`, display type `select`, `selectAll = Y`, and parameter name equal to the hidden option report. Query and return its ID. Validate the expected `stretchy_parameter` columns before mutation and run the SQL in a transaction.

- [ ] **Step 4: Implement API setup and role grants**

On apply: update only the `Tenant.slug = arda` row by merging `features.ardaStockReports = true` into its existing JSON; register the data table; create or update the hidden option report through `/reports`; resolve the parameter ID; create or update the three visible reports through `/reports`; fetch the generated report-read permissions; and merge them into each explicit ARDA role using the Fineract role-permission API. Read back the Loan Matrix tenant setting, `/datatables?apptable=m_loan`, `/reports`, FullParameterList for every report, and each role permission set; fail if any artifact or permission is absent.

- [ ] **Step 5: Run setup tests and a dry run**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-report-setup.test.ts lib/__tests__/fineract-arda-stock-reports.test.ts`

Then run: `pnpm exec tsx scripts/setup-arda-stock-reports.ts --tenant=arda --role-id=<ARDA_FINANCE_ROLE_ID>`

Expected: tests PASS; the CLI prints the exact planned actions and performs no writes.

- [ ] **Step 6: Commit**

```bash
git add lib/fineract-arda-stock-report-setup.ts scripts/setup-arda-stock-reports.ts \
  lib/__tests__/arda-stock-report-setup.test.ts
git commit -m "feat: provision ARDA stock reports"
```

## Task 6: Backfill Eligible Existing ARDA Stock Issues

**Files:**
- Create: `lib/arda-stock-details-backfill.ts`
- Create: `scripts/backfill-arda-stock-details.ts`
- Create: `lib/__tests__/arda-stock-details-backfill.test.ts`

**Interfaces:**
- Consumes: `ArdaStockDetails` and `upsertArdaStockDetails`.
- Produces: `toArdaStockDetailsFromIssue(issue: BackfillStockIssue): { status: "eligible"; details: ArdaStockDetails } | { status: "skipped"; reason: string }` and CLI flags `--tenant=arda`, `--loan=<id>`, `--limit=<n>`, and `--apply`.

- [ ] **Step 1: Write failing mapping and mode tests**

Assert that one issue line maps inventory item ID/name/unit, quantity, unit value, total, currency, and issue reference; zero-line, multi-line, missing-loan-ID, invalid-value, and non-ARDA records return explicit skip reasons; preview never calls the requester; apply calls it once per eligible loan; and repeated apply reports updates rather than duplicates.

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-details-backfill.test.ts`

Expected: FAIL because the backfill module does not exist.

- [ ] **Step 3: Implement the mapper and backfill command**

Load only the `Tenant.slug = arda` record, require `features.ardaStockReports = true`, and load its `StockLoanIssue` rows with included lines and inventory items. Preview prints source, eligible, skipped-by-reason, create/update estimate, and error counts. Apply uses an explicit ARDA Fineract requester, continues after per-loan errors, prints no credentials or personal client data, and exits non-zero when any eligible row fails.

- [ ] **Step 4: Run tests and preview production eligibility**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-details-backfill.test.ts lib/__tests__/fineract-arda-stock-details.test.ts`

Then run: `pnpm exec tsx scripts/backfill-arda-stock-details.ts --tenant=arda`

Expected: tests PASS; preview reports the current source count without writes. Based on the approved design evidence, the current eligible count may be zero.

- [ ] **Step 5: Commit**

```bash
git add lib/arda-stock-details-backfill.ts scripts/backfill-arda-stock-details.ts \
  lib/__tests__/arda-stock-details-backfill.test.ts
git commit -m "feat: backfill ARDA Fineract stock details"
```

## Task 7: Verify Values, Exports, Isolation, And Rollback

**Files:**
- Create: `scripts/verify-arda-stock-reports.ts`
- Create: `docs/runbooks/arda-stock-reports.md`
- Create: `lib/__tests__/arda-stock-report-verification.test.ts`

**Interfaces:**
- Consumes: all artifacts from Tasks 1–6.
- Produces: a read-only verifier accepting `--tenant=arda`, `--control-tenant=goodfellow`, `--start=YYYY-MM-DD`, and `--end=YYYY-MM-DD`.

- [ ] **Step 1: Write failing verifier tests**

Test result-column validation for all three reports, count/value/rank comparison against known fixtures, the ARDA database feature flag, and artifact isolation. The control tenant must fail verification if its flag is true or any ARDA report name or `arda_stock_details` appears; ARDA must fail if its flag is not true or any expected artifact, parameter, column, or permission is absent.

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec tsx --test lib/__tests__/arda-stock-report-verification.test.ts`

Expected: FAIL because the verifier does not exist.

- [ ] **Step 3: Implement read-only API and transactional SQL verification**

Use the Fineract API to list artifacts, inspect parameters, and run all three reports for the requested range. Confirm the known demonstration loan’s disbursement and repayment monetary fallbacks. In one direct ARDA database transaction, insert a temporary `arda_stock_details` fixture linked to an eligible test loan, execute the exact report SQL with fixed parameters, assert quantity/value/averages/rank, and roll back before the connection closes. Query Goodfellow read-only and assert no ARDA artifacts exist.

- [ ] **Step 4: Document operations and rollback**

In `docs/runbooks/arda-stock-reports.md`, record exact preview/apply/verify/backfill commands, required environment variables, role-ID discovery, expected counts, failure recovery, and rollback. Rollback first sets the ARDA row’s `features.ardaStockReports` to `false`, then removes only the three visible reports and hidden option report from Fineract tenant `arda`; it retains `arda_stock_details` unless separately approved.

- [ ] **Step 5: Run the complete automated validation**

```bash
pnpm exec tsx --test \
  lib/__tests__/arda-stock-loan.test.ts \
  lib/__tests__/tenant-arda-stock-reports.test.ts \
  lib/__tests__/fineract-arda-stock-details.test.ts \
  lib/__tests__/arda-stock-sync-wiring.test.ts \
  lib/__tests__/fineract-arda-stock-reports.test.ts \
  lib/__tests__/arda-stock-report-setup.test.ts \
  lib/__tests__/arda-stock-details-backfill.test.ts \
  lib/__tests__/arda-stock-report-verification.test.ts \
  lib/__tests__/manual-create-loan-linking.test.ts \
  lib/__tests__/team-state-machine-auto-disbursement.test.ts
pnpm exec eslint \
  lib/inventory/arda-stock-workflow-service.ts \
  lib/tenant-arda-stock-reports.ts \
  shared/types/tenant.ts \
  lib/fineract-arda-stock-details.ts \
  lib/fineract-arda-stock-reports.ts \
  lib/fineract-arda-stock-report-setup.ts \
  lib/arda-stock-details-backfill.ts \
  'app/api/leads/[id]/create-loan/route.ts' \
  'app/api/fineract/loans/[id]/disburse/route.ts' \
  lib/team-state-machine-service.ts \
  scripts/setup-arda-stock-reports.ts \
  scripts/backfill-arda-stock-details.ts \
  scripts/verify-arda-stock-reports.ts
pnpm exec tsc --noEmit
```

Expected: all focused tests pass; lint has no errors in touched files; TypeScript exits zero.

- [ ] **Step 6: Run operational verification after setup apply**

Run the setup command twice with the chosen ARDA finance/report role IDs, apply the eligible backfill once, and run `scripts/verify-arda-stock-reports.ts`. Expected: the second setup reports updates/no changes without duplicates; report values and columns pass; Goodfellow has no ARDA artifacts; CSV and Excel exports from the existing Reports page contain the displayed columns and row counts.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-arda-stock-reports.ts docs/runbooks/arda-stock-reports.md \
  lib/__tests__/arda-stock-report-verification.test.ts
git commit -m "test: verify ARDA stock reports and isolation"
```

## Final Review And Delivery

- [ ] Review the complete branch diff against the approved specification.
- [ ] Confirm only ARDA-gated runtime behavior and ARDA-targeted setup scripts were added.
- [ ] Confirm existing Goodfellow report definitions and report parameters have no diff.
- [ ] Confirm only the ARDA Loan Matrix tenant row has `settings.features.ardaStockReports = true`; every other tenant is false or missing.
- [ ] Confirm no credentials, database passwords, customer details, or generated exports are committed.
- [ ] Push the feature branch and update the pull request into `dev` with Tafadzwa and Gaku requested as approvers.
