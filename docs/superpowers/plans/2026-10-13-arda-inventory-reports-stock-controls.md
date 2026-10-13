# ARDA Inventory Reports and Stock Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects that approach. Steps use checkbox syntax for tracking.

**Goal:** Add ARDA-only native stock reports and prevent Loan Matrix approvals/disbursements from exceeding available stock, then investigate missing stock metadata in ARDA's Fineract reports.

**Architecture:** Extend the existing inventory ledger with atomic reservation operations and a durable external-action coordinator. All Loan Matrix stock approval/disbursement paths use that coordinator; reports read the tenant's ledger and expose unresolved reconciliation work. Existing Fineract financial reports remain separate.

**Tech Stack:** Next.js, TypeScript, PostgreSQL, Prisma Decimal, existing UI components, node:test through tsx, existing ExcelJS export dependency.

**Spec:** `docs/superpowers/specs/2026-10-13-arda-inventory-reports-stock-controls-design.md`

## Global Constraints

- Database tenant settings must restrict the additions to ARDA after deployment to shared branches.
- Other tenants retain their existing workflows.
- Add hasInventoryReports and enforceStockAvailability to Tenant.settings.features, both defaulting to false.
- Hiding navigation is not an authorization check.
- Do not hold a database transaction open across a Fineract network call.
- Do not label repayment receipts minus stock issues as profit.
- Complete reports and stock controls first; investigate the missing Fineract stock details afterward.
- Preserve uncommitted local work. No production financial transactions may be created for testing.
- Loan Matrix enforcement cannot prevent actions performed directly in raw Mifos/Fineract.

## Review Focus

1. A client changes a reserved loan's quantity while another borrower requests the same stock: preserve consistent quantities and reject unavailable replacement requests (Task 2).
2. Fineract succeeds but the response or local finalization is lost: retain the stock hold, reconcile, and never repeat the disbursement blindly (Task 3).
3. A known stock product loses its selection metadata: block rather than silently bypass enforcement (Tasks 1 and 3).
4. Empty dates, inaccessible office IDs, mixed units/currencies and spreadsheet-like client names: validate access and produce correctly scoped, safe exports (Tasks 4 and 5).
5. An old loan has a principal amount but no historical stock evidence: do not misrepresent that amount as captured stock value or invent quantity/item identity (Task 7).

## Execution baseline and file boundaries

Before code changes, use the git-worktrees skill to isolate a branch named `codex/arda-inventory-reports-stock-controls` from the verified current integration base. Inspect dev and existing ARDA PRs; the root ARDA checkout is dirty and older than the Fineract report worktree. Do not blindly copy either tree or merge unrelated work. Carry the approved specification and this plan into the implementation branch.

Responsibilities:

- `shared/types/tenant.ts`, `lib/inventory/inventory-access.ts`: feature defaults, server tenant/access checks.
- `lib/inventory/stock-reservation-service.ts`: short atomic transactions for reserve, replace, release and consume; no network calls.
- `lib/inventory/stock-action-service.ts`: durable Fineract action coordination, replay and recovery.
- `lib/inventory/arda-stock-workflow-service.ts`: existing workflow adapter, delegating reservation mutations to the shared service.
- `lib/inventory/inventory-report-service.ts`, `inventory-report-types.ts`, `inventory-report-export.ts`: query semantics, report models and exports.
- `app/api/inventory/reports/route.ts`, `app/api/inventory/reports/export/route.ts`: authorized report entry points.
- `app/(application)/inventory/components/inventory-tabs.tsx`, `inventory-reports.tsx`: navigation and report UI.
- Existing Fineract synchronization files and ARDA scripts: follow-up diagnosis/backfill only after current work.

## Task 1: Tenant access and stock-product classification

**Files:** Modify `shared/types/tenant.ts`; create `lib/inventory/inventory-access.ts`, `lib/inventory/stock-product-policy.ts`, `lib/__tests__/inventory-access.test.ts`, `lib/__tests__/stock-product-policy.test.ts`, and `scripts/arda/configure-inventory-controls.ts`.

**Interfaces:** `isArdaInventoryFeatureEnabled(tenant: { id: string; slug: string; settings: unknown }, feature: 'hasInventoryReports' | 'enforceStockAvailability'): boolean`. `requireInventoryReportAccess(request: NextRequest): Promise<InventoryAccessContext>` resolves tenant, actor and allowed offices from authenticated server state. `InventoryAccessContext` holds `tenantId`, `tenantSlug`, `actorUserId`, `allowedOfficeIds: number[]`. Resolve stock-product identity from verified ARDA product IDs/external IDs and existing saved selection; no unrestricted name-prefix classification.

- [ ] Write tests asserting missing features are false, Goodfellow remains false even if a flag is accidentally true, ARDA with the correct feature is true, and a mismatched tenant/session or inaccessible office is denied.
- [ ] Write classification tests: a configured stock product with absent selection requires stock; an ordinary cash product does not; a saved valid stock selection on an older generic product remains recognized. Unknown/conflicting stock identity returns an actionable error.
- [ ] Run `pnpm exec tsx --test lib/__tests__/inventory-access.test.ts lib/__tests__/stock-product-policy.test.ts`; confirm tests fail for missing behavior.
- [ ] Implement the interfaces and defaults. Follow the existing authenticated tenant and office permission machinery after verifying it on the integration base. Preserve hasInventoryFinance and ardaStockReports independently.
- [ ] Implement an ARDA-only settings script with dry-run default, explicit apply mode, tenant identity verification and JSON merge preserving all unrelated keys. It also records the verified ARDA stock-product IDs in tenant settings; refuse ambiguous product mappings.
- [ ] Rerun the tests; confirm PASS. Commit only this task's files.

## Task 2: Atomic stock reservations

**Files:** Modify `prisma/schema.prisma`, create a generated migration under `prisma/migrations/`, create `lib/inventory/stock-reservation-service.ts`; adapt `lib/inventory/arda-stock-workflow-service.ts`, `inventory-ledger-service.ts`, `inventory-issue-service.ts`; create `lib/__tests__/stock-reservation-service.test.ts` and `stock-reservation-concurrency.integration.test.ts`.

**Interfaces:** `StockSelection = { inventoryItemId: string; fineractOfficeId: number; currencyCode: string; quantity: string; unitValue: string }`. `reserveStock(input: { tenantId: string; leadId: string; selection: StockSelection; actorUserId: string }): Promise<ReservationResult>`, `releaseStock(input: { tenantId: string; leadId: string; actorUserId: string; reason: string }): Promise<ReservationResult>`, `consumeStock(input: { tenantId: string; leadId: string; operationId: string; actorUserId: string }): Promise<ReservationResult>`. `ReservationResult = { issueId: string; generation: number; status: 'RESERVED' | 'CANCELLED' | 'ISSUED'; changed: boolean }`.

- [ ] Write lifecycle tests: reserve 4 of 5, reject a further 2; replay reserves once; replace with unavailable quantity preserves the old hold; release reads persisted lines; resubmit after release increments generation; inactive item and invalid decimals are rejected.
- [ ] Add a PostgreSQL integration fixture using a dedicated disposable test database. Two synchronized requests for 4 of 5 must yield one reservation, one insufficient-stock result and reserved quantity 4. Never point this fixture at `.env.live-debug`.
- [ ] Run the tests and confirm the existing read/update pattern fails the concurrency case or the new interface is absent.
- [ ] Add a reservation generation field and generation-aware movement keys. Serialize per-lead changes and lock all affected balance rows in deterministic order; replacement involving two balances must not deadlock. Create missing balance rows safely where receiving stock requires them. Protect inactive item checks against concurrent deactivation.
- [ ] Route every participating ARDA balance writer through the same concurrency mechanism. Preserve existing disabled-tenant behavior. Enforce nonnegative on-hand/reserved and reserved <= on-hand without inventing historical receipts. Keep failed data validation atomic.
- [ ] Rerun lifecycle and real-database concurrency tests, Prisma validation and existing inventory tests; confirm PASS. Commit the service and backwards-compatible migration.

## Task 3: Approval/disbursement coordinator and route coverage

**Files:** Create `lib/inventory/stock-action-service.ts`, `lib/__tests__/stock-action-service.test.ts`, `lib/__tests__/stock-action-routes.test.ts`, `scripts/arda/reconcile-stock-actions.ts`; modify `prisma/schema.prisma` and its migration, `lib/team-state-machine-service.ts`, `lib/inventory/arda-stock-workflow-service.ts`, `lib/arda-stock-disbursement-guard.ts`, `app/api/fineract/loans/[id]/action/route.ts`, `app/api/fineract/loans/[id]/disburse/route.ts`, `app/api/fineract/loans/[id]/undodisbursal/route.ts`, and the existing pending-approval loan-terms route. Audit generic proxies and automatic actions for additional command entry points and record any added paths in this task.

**Interfaces:** `runStockControlledAction<T>(input: { tenant: TenantContext; leadId: string; loanId: number; command: 'approve' | 'disburse'; operationKey: string; actorUserId: string; execute: () => Promise<T>; reconcile: () => Promise<'confirmed' | 'not-executed' | 'unknown'> }): Promise<T | StockActionPending>`. `StockActionPending = { status: 'PENDING_RECONCILIATION'; operationId: string }`. TenantContext is the verified existing server tenant type; Task 1's policy determines applicability. The caller supplies Fineract action and outcome adapters; the coordinator owns stock lifecycle and operation persistence.

- [ ] Write tests proving the external callback is never invoked for missing/insufficient stock, manual and workflow routes both enforce checks, other tenants call their existing action once, and changed terms cannot bypass reservation replacement.
- [ ] Write failure tests: external success/local failure leaves a durable recoverable operation; timeout keeps the hold; retry reconciles before invoking; concurrent requests cannot both execute; confirmed failure retains/releases only the appropriate generation; unknown outcome returns a pending status to the user.
- [ ] Run these tests; confirm FAIL before implementation.
- [ ] Add an operation record with tenant, loan, command, reservation generation, stable request key, selection/request snapshot, outcome/reference and timestamps. Use states PREPARED, CONFIRMED, FAILED, UNCERTAIN and FINALIZED, with uniqueness preventing duplicate logical execution and a per-loan active-operation guard. Persist before the external call; never replay a stored PREPARED operation after a crash without checking external state.
- [ ] Implement the coordinator. Confirm Fineract outcomes using loan status plus matching transaction/action context, not any arbitrary disbursement. Commit successful stock finalization and durable outcome together; pending results must not be presented as completed approvals/disbursements.
- [ ] Wire all audited Loan Matrix entry points, cancellation/backward paths, and changed-term edits. Preserve existing Fineract stock metadata synchronization. Record financial undo/physical stock discrepancies for reconciliation; do not create stock returns from financial undo alone.
- [ ] Implement an ARDA-only reconciliation script: read pending operations, query external outcome, finalize confirmed operations, retain holds for unknown ones, and report unresolved cases. Default dry-run; successful repeated runs have no extra movements.
- [ ] Run targeted tests plus existing workflow/disbursement tests; confirm PASS. Commit.

## Task 4: Native inventory reports and exports

**Files:** Create `lib/inventory/inventory-report-types.ts`, `inventory-report-service.ts`, `inventory-report-export.ts`, `app/api/inventory/reports/route.ts`, `app/api/inventory/reports/export/route.ts`, `lib/__tests__/inventory-reports.test.ts`, and `inventory-report-export.test.ts`.

**Interfaces:** `InventoryReportKind = 'availability' | 'reservations' | 'movements' | 'performance' | 'exceptions'`. `InventoryReportFilters = { kind: InventoryReportKind; startDate?: string; endDate?: string; officeId?: number; itemId?: string; currencyCode: string; status?: string; page: number; pageSize: number }`. `getInventoryReport(db, access: InventoryAccessContext, filters: InventoryReportFilters): Promise<InventoryReportResult>` returns `columns`, `rows`, `totalRows`, `totals`, `generatedAt` and `positionBasis: 'current' | 'activity'`. Columns declare text/date/decimal/integer types; money and quantities travel as decimal strings. `exportInventoryReport(result, format: 'csv' | 'xlsx'): Promise<Uint8Array>` formats a bounded report result.

- [ ] Write fixtures with two tenants, branches, currencies, bag/kg units, receipts, reservations, releases, issues and returns. Assert current availability 10 minus 3 = 7; reservation/release movements do not alter on-hand totals; reservations/cancellations do not count as disbursements; distinct fulfilled loans determine counts; returns and unit-scoped rankings are correct.
- [ ] Write tests for inclusive date boundaries, invalid/reversed ranges, inaccessible offices, item IDs belonging to another tenant, pagination, current-position labels and reconciliation of pending operations. Activity dates use UTC start-inclusive/end-exclusive boundaries consistently; show the timezone in report metadata.
- [ ] Write export tests: exported filters match table filters, all requested rows are included up to a documented 50,000-row cap, larger exports return an explicit narrow-filters error, text beginning with formula markers remains text, and decimals retain precision. Limit page size to 200.
- [ ] Run `pnpm exec tsx --test lib/__tests__/inventory-reports.test.ts lib/__tests__/inventory-report-export.test.ts`; confirm FAIL.
- [ ] Implement scoped aggregate queries and exception calculations using Task 1 access. Include only supported ledger facts; expose unavailable historical data as such. Apply current-position semantics to availability and reservations; apply date filters to activity reports and dated exception events.
- [ ] Implement API validation, authorization and typed errors; implement CSV/Excel exports with the existing ExcelJS package. Do not run unbounded history loads per page.
- [ ] Rerun tests; confirm PASS. Commit.

## Task 5: Reports tab and actionable stock feedback

**Files:** Create `app/(application)/inventory/components/inventory-tabs.tsx`, `inventory-reports.tsx`, `app/(application)/inventory/reports/page.tsx`; modify Inventory Stock Control and Financials pages and existing lead stock-selection/approval components identified by searching for `stockLoanSelection`. Create `lib/__tests__/inventory-report-view-model.test.ts` for meaningful formatting/filter behavior, using existing UI test infrastructure where available.

**Interfaces:** The UI consumes Task 4's typed response. InventoryTabs renders Reports only when Task 1's feature is enabled and Financials only when hasInventoryFinance is enabled. Stock selectors consume the existing balances endpoint, with server-enforced availability remaining authoritative.

- [ ] Add view-model tests for report-specific filters, currency/unit totals, stale-response suppression and pending action messages. Run them and confirm FAIL for missing behavior.
- [ ] Implement report chooser, filters, pagination, CSV/Excel actions, current-position notice and loading/empty/error states. Make narrow layouts horizontally scrollable without losing headings. Enforce access on the page route as well as the API.
- [ ] Show branch availability and requested quantity at stock selection and approval, disable clearly unavailable choices, and surface server shortage or pending-reconciliation messages verbatim after safe error normalization. No successful-disbursement toast for an unresolved outcome.
- [ ] Visually verify ARDA desktop/mobile views and a second tenant with both flags disabled; verify direct URL/API denial and exports. Test keyboard labels/focus using existing components. Rerun tests; commit.

## Task 6: Integrated verification and ARDA activation preparation

**Files:** Update the task tests and add `docs/arda-inventory-controls-operations.md` with activation, recovery and rollback procedures.

- [ ] Run Prisma schema validation/generation, changed-file lint, TypeScript checks, inventory/workflow regression tests and the disposable-database concurrency suite. Run the existing project build with required environment supplied securely; distinguish baseline failures from introduced failures.
- [ ] Exercise a full test lifecycle: receipt -> draft -> reserve -> approve -> disburse -> report; cancellation/resubmission; changed selection; timeout/reconcile. Verify competing requests with different leads and duplicate requests for one loan.
- [ ] Audit current ARDA balances, reservations and stock-product mappings read-only; list inconsistencies and incomplete metadata. Do not enable enforcement where unresolved mappings would misclassify existing loans; present the exact blocker if one exists.
- [ ] Prepare a PR against dev following the user's established review convention, with Tafadzwa and Gaku resolved to actual repository usernames. Include the tested tenant defaults and migration/recovery details. Do not merge automatically.
- [ ] Document that live UI behavior changes only after deployment. Prepare the exact ARDA-only settings update; apply it only once the matching deployment and prerequisites are verified. Existing settings on other tenants remain untouched. Record whether activation is complete or awaiting deployment.
- [ ] Record meaningful finance improvements discovered during implementation without implementing unrelated procurement, batch or costing systems.

## Task 7: Investigate and repair missing ARDA stock details next

**Files:** Inspect existing `lib/fineract-arda-stock-details.ts`, `lib/arda-stock-disbursement-guard.ts`, `scripts/backfill-arda-stock-details.ts`, `scripts/verify-arda-stock-reports.ts`; change only the necessary ARDA-scoped adapter/script or live ARDA report through Fineract API. Add `lib/__tests__/arda-stock-details-repair.test.ts` if code changes are needed.

- [ ] After Task 6's implementation verification, locate the screenshot row by ARDA loan/transaction ID. Read the original lead selection, inventory item, issue lines and Fineract datatable without changing records. Inspect actual loan status and enum mapping. Identify precisely which authoritative records exist.
- [ ] Compare the deployed synchronization path and feature settings with source; distinguish missing deployment, missing datatable row, incorrect mapping, and absent historical evidence. Inspect the existing Stock Value SQL fallback so a loan principal is not mistaken for recorded inventory value.
- [ ] If repair code is needed, add tests proving repeatable updates, denial of non-ARDA writes, refusal of ambiguous source mappings and preservation of already-correct values. Run tests to demonstrate failure before the repair.
- [ ] Prepare a before/after preview and backfill only verifiable fields via ARDA's Fineract API. Update ARDA report SQL via the API only where mapping/fallback labeling is the confirmed problem; preserve report IDs and parameter association IDs. Never infer item or quantity from amount or client name alone.
- [ ] Verify repaired rows through the live Fineract report API and read back any changes. Confirm unrelated tenant settings/definitions were not changed. If source evidence is absent, report the exact missing records needed rather than fabricating data.
- [ ] Deliver code/PR/deployment status and live metadata-repair status separately, with outstanding blockers explicit.

## Self-review result

The plan covers the approved reports, tenant defaults and server authorization, concurrent reservations, manual-route bypasses, changed terms and cancellation, uncertain external outcomes, exports, stock feedback, raw-Mifos boundary, and the ordered metadata follow-up. Tests are attached to the service that owns each failure mode. Pending deployment is distinct from completed implementation; historical stock facts are never invented.
