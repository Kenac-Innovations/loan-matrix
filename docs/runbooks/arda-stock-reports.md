# ARDA Fineract Stock Reports Runbook

These commands provision and verify the ARDA-only stock reports. Run them from the Loan Matrix repository root. Preview mode is the default. No setup or backfill write occurs unless `--apply` is present.

## Required environment

Loan Matrix:

- `DATABASE_URL` — Loan Matrix database containing the active `Tenant.slug = arda` row.

Fineract API:

- `FINERACT_BASE_URL`
- `FINERACT_USERNAME`
- `FINERACT_PASSWORD`
- `FINERACT_TENANT_ID=arda`

ARDA Fineract PostgreSQL database:

- `FINERACT_DB_HOST`
- `FINERACT_DB_PORT`
- `FINERACT_DB_USER`
- `FINERACT_DB_PASSWORD`
- `FINERACT_DB_NAME=fineract_tenant_arda`

The setup command refuses apply mode unless the Loan Matrix slug, Fineract tenant ID, and Fineract database name are all ARDA.

## Discover the ARDA report role IDs

List roles through the ARDA Fineract API:

```bash
curl --fail --silent --show-error \
  --user "$FINERACT_USERNAME:$FINERACT_PASSWORD" \
  --header "Fineract-Platform-TenantId: arda" \
  "$FINERACT_BASE_URL/fineract-provider/api/v1/roles"
```

Record the positive IDs of every ARDA role that should run these reports, normally the finance and reporting roles. Pass each ID separately as `--role-id=<id>`. The setup command never guesses a role and refuses apply mode with an empty role list.

## Preview and provision

Preview all planned artifacts without reading or writing Fineract:

```bash
pnpm exec tsx scripts/setup-arda-stock-reports.ts \
  --tenant=arda \
  --role-id=<ARDA_FINANCE_ROLE_ID> \
  --role-id=<ARDA_REPORT_ROLE_ID>
```

Apply after reviewing the preview:

```bash
pnpm exec tsx scripts/setup-arda-stock-reports.ts \
  --tenant=arda \
  --role-id=<ARDA_FINANCE_ROLE_ID> \
  --role-id=<ARDA_REPORT_ROLE_ID> \
  --apply
```

Run the same apply command a second time. It should update the same four report definitions, reuse one `stockItemId` parameter, preserve existing role permissions, and create no duplicate reports or parameters.

The expected artifacts are:

- tenant setting `features.ardaStockReports = true` on ARDA only;
- loan data table `arda_stock_details`;
- hidden selector report `ARDA Stock Item Options`;
- `ARDA Stock Disbursement Report`;
- `ARDA Stock Repayment Report`;
- `ARDA Stock Item Performance`;
- one `stockItemId` parameter and the generated read permission for each visible report.

## Backfill existing stock issues

Preview all eligible ARDA stock issues without a Fineract write:

```bash
pnpm exec tsx scripts/backfill-arda-stock-details.ts --tenant=arda
```

Narrow a preview when investigating:

```bash
pnpm exec tsx scripts/backfill-arda-stock-details.ts \
  --tenant=arda \
  --loan=<FINERACT_LOAN_ID> \
  --limit=100
```

Apply only after the preview counts and skip reasons are accepted:

```bash
pnpm exec tsx scripts/backfill-arda-stock-details.ts --tenant=arda --apply
```

The approved design found zero local ARDA stock issues at design time, so a source or eligible count of zero can be valid. Apply mode exits nonzero when any eligible loan fails, while continuing through the remaining loans. Re-running apply updates the existing loan row instead of adding a duplicate.

## Verify reports and tenant isolation

Choose a range containing the known USD 250 disbursement and USD 100 repayment, then run:

```bash
pnpm exec tsx scripts/verify-arda-stock-reports.ts \
  --tenant=arda \
  --control-tenant=goodfellow \
  --start=2026-01-01 \
  --end=2026-12-31
```

The verifier is read-only at the application level. Its database fixture runs inside one transaction and always rolls back. It checks:

- ARDA setting, reports, data table, filters, and generated permissions;
- absence of the ARDA flag, reports, and data table in Goodfellow;
- required columns in all three report results;
- the known monetary fallbacks;
- quantity, stock value, averages, and monthly rank using a rolled-back fixture.

In the ARDA Reports page, run each report for the same range. Export CSV and Excel and confirm each export has the same visible column count and row count as the page. The existing report UI supplies both exports; no ARDA-specific export path is introduced.

## Failure recovery

If setup fails before read-back verification, correct the reported API, catalog, permission, or environment issue and rerun the same apply command. Every artifact is addressed by its stable name or loan ID.

If backfill reports errors, rerun preview for each failed `--loan=<id>`, correct its local issue line or Fineract availability, and rerun apply. Do not invent stock metadata for a loan without one valid local issue line.

If verification says the control tenant contains an ARDA artifact, stop deployment and remove that artifact from the control Fineract tenant before proceeding.

## Rollback

First disable runtime synchronization by setting only the ARDA Loan Matrix row's `settings.features.ardaStockReports` value to `false`. Preserve every other settings key.

Then list Fineract reports with `GET /reports` using header `Fineract-Platform-TenantId: arda`, resolve the IDs for exactly these names, and delete each with `DELETE /reports/{id}`:

- `ARDA Stock Disbursement Report`
- `ARDA Stock Repayment Report`
- `ARDA Stock Item Performance`
- `ARDA Stock Item Options`

Do not delete or deregister `arda_stock_details` during normal rollback. It contains audit metadata and remains unless a separate data cleanup is explicitly approved. Do not modify Goodfellow or any other tenant during rollback.
