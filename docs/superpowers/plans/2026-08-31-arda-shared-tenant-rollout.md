# ARDA Shared Tenant Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ARDA from a dedicated Loan Matrix deployment to an isolated `arda` tenant in the shared production Loan Matrix application, backed by its own Fineract tenant database and preserving `ardaloanmatrix.kenac.tech`.

**Architecture:** The existing shared production Loan Matrix deployment serves the ARDA hostname. Hostname resolution selects the Loan Matrix tenant with slug `arda`; all Fineract calls for that tenant use Fineract tenant identifier `arda`, registered against database `fineract_tenant_arda`. ARDA-only configuration and controlled ARDA test records are provisioned from an approved manifest. Omama operational data is never copied or used as a fallback.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, Apache Fineract REST API, Fineract tenant registry, Kubernetes, Istio, Argo CD, Helm values.

**Spec:** `docs/superpowers/specs/2026-08-31-arda-shared-tenant-design.md`

## Global Constraints

- Keep the shared production Loan Matrix application as the only production runtime after acceptance testing.
- Preserve `ardaloanmatrix.kenac.tech`.
- Do not copy Omama operational clients, loans, repayments, journals, cashiers, tellers, users, credentials, or documents.
- Treat `arda` as an explicit Fineract tenant. It must never resolve to `omama`, `goodfellow`, or an environment fallback.
- Use the Fineract API for creating ARDA product, office, payment-type, client, and loan test data. Do not seed Fineract operational tables directly.
- Make database and GitOps provisioning idempotent. Every write command must support a dry-run mode or an equivalent preflight.
- Do not remove the dedicated ARDA deployment until the shared tenant passes all acceptance checks.
- Keep unrelated local modifications untouched.

## Current State And Target State

| Area | Current state | Target state |
| --- | --- | --- |
| Public hostname | `ardaloanmatrix.kenac.tech` can point at a separate ARDA deployment | The hostname reaches shared `loan-matrix-prod` |
| Loan Matrix tenancy | ARDA behaviour is mixed into Omama settings and data | Active `Tenant(slug = "arda")` with ARDA-only records |
| Fineract tenancy | ARDA testing has used Omama Fineract data | Registered Fineract tenant `arda` backed by `fineract_tenant_arda` |
| Contract selection | ARDA stock contract currently checks the Omama tenant | ARDA stock contract and mandate are served only for tenant `arda` |
| Failure handling | An unresolved tenant can fall back to Goodfellow Fineract | ARDA resolution fails clearly and never crosses tenants |

## Files And Assets

### Loan Matrix repository

- Modify: `lib/fineract-tenant-service.ts`
- Modify: `lib/tenant-service.ts`
- Modify: `app/api/leads/[id]/contract-data/route.ts`
- Modify: `app/(application)/leads/new/components/loan-contracts.tsx`
- Modify: `scripts/setup-arda-seed-products.ts`
- Create: `lib/arda-source-selection.ts`
- Create: `lib/arda-contract-variant.ts`
- Create: `scripts/arda/audit-source.ts`
- Create: `scripts/arda/provision-loan-matrix-tenant.ts`
- Create: `scripts/arda/provision-fineract-catalogue.ts`
- Create: `scripts/arda/verify-arda-tenant.ts`
- Create: `lib/__tests__/fineract-tenant-resolution.test.ts`
- Create: `lib/__tests__/arda-source-selection.test.ts`
- Create: `lib/__tests__/arda-contract-variant.test.ts`
- Modify: `lib/__tests__/arda-hostname.test.ts`
- Modify: `lib/__tests__/arda-stock-loan.test.ts`

### GitOps repository

- Modify: `/Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/environments/prod/values.yaml`
- Inspect before removal: `/Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/environments/arda/values.yaml`
- Inspect before removal: the Argo CD Application or ApplicationSet source that creates the dedicated ARDA application.

### Production data stores

- Loan Matrix database: `loan_matrix_prod` on `10.10.198.40:6432`
- Fineract tenant registry: `fineract_tenants` on `10.10.198.40:6432`
- New Fineract database: `fineract_tenant_arda`

## Rollout Checkpoints

1. Tenant-resolution guard passes automated tests.
2. ARDA source manifest is reviewed and approved before any copy occurs.
3. Fineract tenant database is created, migrated, registered, and independently reachable.
4. ARDA catalogue and controlled test records are created through Fineract API.
5. Loan Matrix tenant configuration is created and contract selection is isolated.
6. Shared production route is added and acceptance tests pass.
7. Dedicated deployment is retired in a separate, reversible change.

---

## Task 1: Prevent Cross-Tenant Fineract Fallback

**Files:**
- Modify: `lib/fineract-tenant-service.ts`
- Modify: `lib/tenant-service.ts`
- Create: `lib/__tests__/fineract-tenant-resolution.test.ts`
- Modify: `lib/__tests__/arda-hostname.test.ts`

**Interfaces:**

```ts
export class FineractTenantResolutionError extends Error {
  readonly tenantSlug: string;
}

export function resolveFineractTenantId(input: {
  requestedSlug: string;
  resolvedTenantSlug?: string | null;
  fallbackTenantId?: string;
}): string;
```

Rules for `resolveFineractTenantId`:

- A resolved active tenant returns its mapped Fineract identifier or its slug.
- `requestedSlug === "arda"` and no resolved active ARDA tenant throws `FineractTenantResolutionError`.
- The standard environment fallback remains available only for non-ARDA legacy requests with no hostname tenant context.
- Error text must state that ARDA is not configured; it must never disclose connection credentials.

- [ ] **Step 1: Write failing tenant-resolution tests**

Create `lib/__tests__/fineract-tenant-resolution.test.ts` with tests for:

```ts
test("uses arda only when the active application tenant is arda", () => {
  assert.equal(
    resolveFineractTenantId({ requestedSlug: "arda", resolvedTenantSlug: "arda" }),
    "arda",
  );
});

test("does not fall back when the ARDA host has no active ARDA tenant", () => {
  assert.throws(
    () => resolveFineractTenantId({
      requestedSlug: "arda",
      resolvedTenantSlug: null,
      fallbackTenantId: "goodfellow",
    }),
    FineractTenantResolutionError,
  );
});

test("keeps the legacy fallback for a request without a tenant hostname", () => {
  assert.equal(
    resolveFineractTenantId({
      requestedSlug: "",
      resolvedTenantSlug: null,
      fallbackTenantId: "goodfellow",
    }),
    "goodfellow",
  );
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
pnpm exec tsx --test lib/__tests__/fineract-tenant-resolution.test.ts
```

Expected: module or exports are missing.

- [ ] **Step 3: Add request-slug resolution without a database lookup fallback**

In `lib/tenant-service.ts`, add an exported request helper that returns the requested slug from `origin`, `referer`, `x-forwarded-host`, or `host`. It must use the existing `extractTenantSlug` function and return an empty string only when no host source exists. Do not use `FINERACT_TENANT_ID` in this helper.

- [ ] **Step 4: Implement the pure Fineract tenant resolver**

In `lib/fineract-tenant-service.ts`:

- Export `FineractTenantResolutionError` and `resolveFineractTenantId`.
- Resolve the hostname slug first, then the active Loan Matrix tenant.
- Call `getTenantFromHeaders()` once.
- For ARDA, require `tenant?.slug === "arda"`; otherwise throw.
- Retain the legacy Goodfellow fallback only where the request did not identify a specific tenant host.
- Preserve existing explicit `TENANT_TO_FINERACT_MAPPING` support.

- [ ] **Step 5: Add hostname regression coverage**

Update `lib/__tests__/arda-hostname.test.ts` to verify:

- `ardaloanmatrix.kenac.tech` returns `arda`.
- `arda.localhost:3000` returns `arda`.
- The hostname mapping is not dependent on the dedicated deployment configuration.

- [ ] **Step 6: Run focused tests**

```bash
pnpm exec tsx --test \
  lib/__tests__/fineract-tenant-resolution.test.ts \
  lib/__tests__/arda-hostname.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit the guard independently**

```bash
git add lib/fineract-tenant-service.ts lib/tenant-service.ts \
  lib/__tests__/fineract-tenant-resolution.test.ts lib/__tests__/arda-hostname.test.ts
git commit -m "fix: prevent ARDA Fineract tenant fallback"
```

---

## Task 2: Define And Validate The ARDA-Only Copy Boundary

**Files:**
- Create: `lib/arda-source-selection.ts`
- Create: `lib/__tests__/arda-source-selection.test.ts`
- Create: `scripts/arda/audit-source.ts`

**Interfaces:**

```ts
export const ARDA_PRODUCT_EXTERNAL_IDS: readonly string[];
export function isArdaSourceProduct(input: {
  externalId?: string | null;
  name?: string | null;
}): boolean;
export function isArdaControlledTestRecord(input: {
  externalId?: string | null;
  name?: string | null;
  tags?: string[];
}): boolean;
```

The approved product external IDs are:

```ts
export const ARDA_PRODUCT_EXTERNAL_IDS = [
  "ARDA-STOCK-INPUT-LOAN",
  "ARDA-STOCK-MAIZE-SEED-6M",
  "ARDA-STOCK-GROUNDNUT-SEED-1M",
] as const;
```

The selection policy is intentionally allow-list based. A record is eligible only if it has an approved ARDA external identifier, an `ARDA-` code, or an explicit `ARDA_TEST` tag. Name-only matches are displayed as review candidates, never copied automatically.

- [ ] **Step 1: Write failing selection tests**

Create tests that prove:

- Approved ARDA product external IDs are selected.
- `ARDA-` coded inventory is selected.
- An Omama client or loan with a generic name is not selected.
- A generic record containing “arda” in free text is not automatically selected.
- An `ARDA_TEST` tagged record is a review candidate, not an automatic copy result.

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
pnpm exec tsx --test lib/__tests__/arda-source-selection.test.ts
```

- [ ] **Step 3: Implement deterministic allow-list selection**

Create `lib/arda-source-selection.ts`. Normalize casing and whitespace. Return a structured result with `automatic`, `review`, or `excluded` classification so the audit script can report decisions without guessing.

- [ ] **Step 4: Build a read-only source audit script**

Create `scripts/arda/audit-source.ts` with these flags:

```text
--source-loan-matrix-url=<connection string>
--source-fineract-base-url=<url>
--source-fineract-tenant=omama
--out=<absolute json file>
```

The script must:

- Read source Loan Matrix rows only from the Omama tenant ID.
- Read Fineract catalogue through REST APIs using `Fineract-Platform-TenantId: omama`.
- Produce a JSON manifest with source identifiers, classification, record counts, and a `copyAllowed` boolean.
- List every review candidate separately from approved copy records.
- Never issue POST, PUT, PATCH, DELETE, or direct source database write operations.
- Exit non-zero if any operational Omama record is marked `copyAllowed` without a stable ARDA identifier.

- [ ] **Step 5: Run focused tests and a local dry run**

```bash
pnpm exec tsx --test lib/__tests__/arda-source-selection.test.ts
pnpm exec tsx scripts/arda/audit-source.ts --help
```

Expected: tests pass and help lists a read-only workflow.

- [ ] **Step 6: Produce the production review manifest**

Use a secure temporary output location, not a committed artifact:

```bash
mkdir -p /tmp/arda-rollout
pnpm exec tsx scripts/arda/audit-source.ts \
  --source-loan-matrix-url="$DATABASE_URL" \
  --source-fineract-base-url="$FINERACT_BASE_URL" \
  --source-fineract-tenant=omama \
  --out=/tmp/arda-rollout/source-manifest.json
```

Review the manifest before continuing. Approval must explicitly include each `review` record. Do not continue if the manifest contains live Omama borrowers, loans, journals, repayment records, or user accounts.

- [ ] **Step 7: Commit source selection tooling**

```bash
git add lib/arda-source-selection.ts lib/__tests__/arda-source-selection.test.ts scripts/arda/audit-source.ts
git commit -m "feat: add ARDA source selection audit"
```

---

## Task 3: Create And Register Fineract Tenant `arda`

**Systems:**
- PostgreSQL server `10.10.198.40:6432`
- Registry database `fineract_tenants`
- Destination database `fineract_tenant_arda`
- Shared Fineract production service

**Safety rule:** Do not clone the Omama database. Create an empty Fineract tenant database from the deployed Fineract schema baseline, then register it.

- [ ] **Step 1: Capture the actual registry schema before writing migration SQL**

Run read-only inspection against `fineract_tenants`:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'tenant_server_connection';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tenant_server_connection'
ORDER BY ordinal_position;

SELECT *
FROM tenant_server_connection
WHERE tenant_identifier = 'omama';
```

Save the output in `/tmp/arda-rollout/fineract-registry-preflight.txt`. The implementation must use the actual production column names, constraints, and required connection fields. Do not assume a MySQL schema or use an unverified INSERT.

- [ ] **Step 2: Inspect the production Fineract image migration mechanism**

Use the deployed image from `/Users/dazzmurenga/Documents/kenac-gitops/projects/fineract/environments/prod/values.yaml` and inspect how an existing Fineract tenant database was initialized. Record the exact non-interactive migration command in `/tmp/arda-rollout/fineract-migration-command.txt`.

Acceptance criterion: the command uses the same image/version and migration path as the current production Fineract pods.

- [ ] **Step 3: Create the destination database only if missing**

Run an idempotent database existence check, then create:

```sql
SELECT 1 FROM pg_database WHERE datname = 'fineract_tenant_arda';
```

If no row exists, create `fineract_tenant_arda` with the same owner, encoding, collation, and connection policy as the existing Omama tenant database. Record the owner and settings from PostgreSQL first. Do not create schemas in `fineract_tenants`.

- [ ] **Step 4: Initialize the Fineract schema**

Run the exact migration command recorded in Step 2 against `fineract_tenant_arda`. Verify the baseline tables exist:

```sql
SELECT to_regclass('public.m_office') AS office_table,
       to_regclass('public.m_loan_product') AS loan_product_table,
       to_regclass('public.m_client') AS client_table;
```

Expected: all three values are non-null.

- [ ] **Step 5: Register Fineract tenant identifier `arda`**

Create a one-purpose, transaction-wrapped provisioning SQL file in `/tmp/arda-rollout/register-arda-fineract-tenant.sql` from the inspected schema. It must:

- Lock or otherwise prevent concurrent duplicate creation for `tenant_identifier = 'arda'`.
- Insert a row only when `arda` is absent.
- Copy only connection metadata shape from Omama's registry row.
- Set the identifier to `arda` and database/schema target to `fineract_tenant_arda`.
- Contain no password literal in source control or shell history.
- End with read-back assertions for the registered `arda` row.

Apply only after reviewing the generated SQL.

- [ ] **Step 6: Verify Fineract resolves ARDA independently**

Use the Fineract REST API with `Fineract-Platform-TenantId: arda`:

```bash
curl --fail-with-body \
  -u "$FINERACT_USERNAME:$FINERACT_PASSWORD" \
  -H 'Fineract-Platform-TenantId: arda' \
  "$FINERACT_BASE_URL/fineract-provider/api/v1/offices"
```

Expected: HTTP 200 and an empty or baseline office list. If it fails, stop. Do not route the ARDA hostname or create Loan Matrix ARDA data.

- [ ] **Step 7: Record rollback procedure**

Before proceeding, write the exact inverse registry command into `/tmp/arda-rollout/rollback-fineract-arda.txt`. It may delete only the `tenant_identifier = 'arda'` registry row after the destination database has been confirmed unused. It must never touch `omama`.

---

## Task 4: Create ARDA Catalogue And Controlled Test Records Through Fineract APIs

**Files:**
- Modify: `scripts/setup-arda-seed-products.ts`
- Create: `scripts/arda/provision-fineract-catalogue.ts`
- Create: `scripts/arda/verify-arda-tenant.ts`

**Interfaces:**

```ts
type ProvisionMode = "dry-run" | "apply";

type ArdaFineractProvisionOptions = {
  targetTenantId: "arda";
  sourceManifestPath: string;
  mode: ProvisionMode;
};
```

The provisioner must use Fineract endpoints rather than database inserts for all business data:

- offices
- payment types
- loan products
- controlled test clients
- controlled test loans, only when the reviewed manifest includes them

- [ ] **Step 1: Write a dry-run contract test for the script input**

Add a test alongside the script or a small pure configuration module proving that:

- target tenant must be exactly `arda`;
- `--apply` is rejected without a manifest path;
- source tenant must be `omama` for this one-time controlled copy;
- default mode is `dry-run`;
- an unapproved manifest record cannot become a create request.

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm exec tsx --test lib/__tests__/arda-fineract-provisioning.test.ts
```

- [ ] **Step 3: Generalize ARDA seed product definitions**

Refactor `scripts/setup-arda-seed-products.ts` so product definitions are exported rather than bound to `omama`. Keep the existing identifiers:

- `ARDA-STOCK-INPUT-LOAN`
- `ARDA-STOCK-MAIZE-SEED-6M`
- `ARDA-STOCK-GROUNDNUT-SEED-1M`

Use environment or command-line target tenant input and remove hardcoded `LOCAL_TENANT_SLUG = "omama"` from reusable product creation code.

- [ ] **Step 4: Implement idempotent Fineract API provisioning**

Create `scripts/arda/provision-fineract-catalogue.ts` with:

- `--mode=dry-run|apply`, defaulting to `dry-run`.
- `--target-tenant=arda`, required and validated.
- `--manifest=<path>`, required for apply.
- A GET-before-POST strategy keyed by external ID or exact product code/name.
- Structured output listing `would-create`, `created`, `already-exists`, `skipped`, and `failed` records.
- No direct database connection to `fineract_tenant_arda` for application data.

Create only these categories from the approved manifest:

- ARDA offices required for test workflow.
- ARDA payment type for in-kind stock disbursement.
- ARDA product catalogue.
- ARDA-labelled controlled test clients and test workflow loans, when explicitly approved.

- [ ] **Step 5: Dry run and review**

```bash
pnpm exec tsx scripts/arda/provision-fineract-catalogue.ts \
  --mode=dry-run \
  --target-tenant=arda \
  --manifest=/tmp/arda-rollout/source-manifest.json
```

Expected: every intended mutation is listed without changing Fineract.

- [ ] **Step 6: Apply and verify**

```bash
pnpm exec tsx scripts/arda/provision-fineract-catalogue.ts \
  --mode=apply \
  --target-tenant=arda \
  --manifest=/tmp/arda-rollout/source-manifest.json

pnpm exec tsx scripts/arda/verify-arda-tenant.ts --tenant=arda
```

`verify-arda-tenant.ts` must confirm, through Fineract API:

- ARDA products exist.
- No Omama-named products were accidentally copied.
- Controlled test record counts equal the approved manifest count.
- The Fineract response tenant is `arda` for every request.

- [ ] **Step 7: Run focused tests and commit**

```bash
pnpm exec tsx --test lib/__tests__/arda-fineract-provisioning.test.ts
git add scripts/setup-arda-seed-products.ts scripts/arda lib/__tests__/arda-fineract-provisioning.test.ts
git commit -m "feat: provision ARDA Fineract catalogue safely"
```

---

## Task 5: Provision The Loan Matrix ARDA Tenant And ARDA-Only Workflow

**Files:**
- Create: `scripts/arda/provision-loan-matrix-tenant.ts`
- Modify: `lib/tenant-service.ts`
- Modify: `lib/arda-tenant.ts` only if shared ARDA defaults require it
- Modify: `lib/inventory/arda-stock-workflow-service.ts` only if tenant creation requires an exported default
- Create: `lib/arda/tenant-defaults.ts`
- Create: `lib/__tests__/arda-tenant-provisioning.test.ts`

**Interfaces:**

```ts
export const ARDA_TENANT_DEFAULTS: {
  name: "ARDA";
  slug: "arda";
  domain: "ardaloanmatrix.kenac.tech";
  pipeline: readonly ArdaPipelineStageDefinition[];
  features: Record<string, boolean>;
};
```

The ARDA pipeline must use a coherent sequence that supports inventory reservation and issue events. The final stage before the disbursement action must be an approval stage. The rejection route must be available from pending/approval stages. Stage action flags must match existing ARDA stock workflow triggers rather than Omama’s configured pipeline.

- [ ] **Step 1: Write failing tenant-provisioning tests**

Create tests proving the default configuration:

- uses name `ARDA`, slug `arda`, and domain `ardaloanmatrix.kenac.tech`;
- contains no Omama display name, logo URL, address, email, contract template, or pipeline name;
- creates only the ARDA inventory feature set;
- is safe to apply twice without duplicating stage or inventory records.

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
pnpm exec tsx --test lib/__tests__/arda-tenant-provisioning.test.ts
```

- [ ] **Step 3: Define checked-in ARDA defaults**

Create `lib/arda/tenant-defaults.ts`. Keep values limited to ARDA-owned configuration:

- ARDA organization name and hostname.
- ARDA pipeline stages and stage transitions.
- ARDA inventory feature flags.
- ARDA contract/mandate settings and document identifiers.
- ARDA stock products identified by Fineract external ID.

Do not embed Omama source configuration or personal/business contact details.

- [ ] **Step 4: Implement the idempotent Loan Matrix provisioner**

Create `scripts/arda/provision-loan-matrix-tenant.ts` with `--mode=dry-run|apply`, defaulting to `dry-run`.

On apply, it must:

- Upsert the active `Tenant` record with slug `arda`.
- Create missing ARDA pipeline stages and transitions by stable stage keys.
- Create ARDA inventory records only from approved manifest data.
- Add ARDA contract and mandate configuration references.
- Create no Omama tenant-scoped data and alter no existing tenant.
- Print before/after counts scoped to the ARDA tenant ID.

The script must use a database transaction for related Loan Matrix tenant settings. If any required record cannot be created, roll back the transaction.

- [ ] **Step 5: Dry run and review write scope**

```bash
pnpm exec tsx scripts/arda/provision-loan-matrix-tenant.ts \
  --mode=dry-run \
  --manifest=/tmp/arda-rollout/source-manifest.json
```

Expected: output contains only `Tenant(slug=arda)` and ARDA-scoped entities.

- [ ] **Step 6: Apply and query tenant isolation**

```bash
pnpm exec tsx scripts/arda/provision-loan-matrix-tenant.ts \
  --mode=apply \
  --manifest=/tmp/arda-rollout/source-manifest.json
```

Verify directly against Loan Matrix database:

```sql
SELECT id, name, slug, domain, is_active
FROM "Tenant"
WHERE slug IN ('arda', 'omama');

SELECT t.slug, COUNT(*) AS pipeline_stage_count
FROM "PipelineStage" ps
JOIN "Tenant" t ON t.id = ps."tenantId"
WHERE t.slug IN ('arda', 'omama')
GROUP BY t.slug;
```

Expected: ARDA has its own stage records and Omama counts/rows do not change.

- [ ] **Step 7: Run focused tests and commit**

```bash
pnpm exec tsx --test lib/__tests__/arda-tenant-provisioning.test.ts
git add lib/arda/tenant-defaults.ts scripts/arda/provision-loan-matrix-tenant.ts \
  lib/__tests__/arda-tenant-provisioning.test.ts
git commit -m "feat: provision isolated ARDA Loan Matrix tenant"
```

---

## Task 6: Isolate ARDA Contracts And Mandates

**Files:**
- Create: `lib/arda-contract-variant.ts`
- Create: `lib/__tests__/arda-contract-variant.test.ts`
- Modify: `app/api/leads/[id]/contract-data/route.ts`
- Modify: `app/(application)/leads/new/components/loan-contracts.tsx`
- Modify: `lib/__tests__/arda-stock-loan.test.ts`

**Interfaces:**

```ts
export type ContractDocumentVariant = "DEFAULT" | "ARDA_STOCK_INPUT";

export function getContractDocumentVariant(input: {
  tenantSlug?: string | null;
  loanProductExternalId?: string | null;
  loanProductName?: string | null;
}): ContractDocumentVariant;
```

Rules:

- Return `ARDA_STOCK_INPUT` only where tenant slug is exactly `arda` and the selected product is an ARDA stock product.
- Return `DEFAULT` for every Omama product, including legacy Omama records that happen to have an ARDA-like display name.
- The ARDA contract and mandate must contain only ARDA branding, ARDA programme wording, item/quantity/unit/value details, and the applicant details supplied for that tenant.

- [ ] **Step 1: Write failing contract selection tests**

Test at least:

```ts
assert.equal(getContractDocumentVariant({
  tenantSlug: "arda",
  loanProductExternalId: "ARDA-STOCK-MAIZE-SEED-6M",
}), "ARDA_STOCK_INPUT");

assert.equal(getContractDocumentVariant({
  tenantSlug: "omama",
  loanProductExternalId: "ARDA-STOCK-MAIZE-SEED-6M",
}), "DEFAULT");
```

Add content assertions that the ARDA contract and mandate components do not contain `Omama`, `Omama Finance`, Omama addresses, or Omama email domains.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm exec tsx --test \
  lib/__tests__/arda-contract-variant.test.ts \
  lib/__tests__/arda-stock-loan.test.ts
```

- [ ] **Step 3: Implement pure contract selection**

Create `lib/arda-contract-variant.ts` and move the selection decision out of the route. Use `isArdaTenantSlug` and `isArdaStockInputLoanProduct`/existing product external ID helpers.

- [ ] **Step 4: Replace the current Omama condition in the contract data route**

In `app/api/leads/[id]/contract-data/route.ts`, replace the ARDA selection condition that currently calls `isOmamaTenantSlug(tenant.slug)`. Use `getContractDocumentVariant` so only the ARDA tenant can obtain the ARDA variant.

- [ ] **Step 5: Align client contract rendering**

In `app/(application)/leads/new/components/loan-contracts.tsx`:

- Preserve server-controlled `documentVariant` as the source of truth.
- Ensure `ARDA_STOCK_INPUT` renders both `arda-stock-loan-contract` and `arda-stock-loan-mandate`.
- Remove comments or fallback text that say ARDA is an Omama feature.
- Do not render default tenant HTML before ARDA contract data is resolved.

- [ ] **Step 6: Run focused tests**

```bash
pnpm exec tsx --test \
  lib/__tests__/arda-contract-variant.test.ts \
  lib/__tests__/arda-stock-loan.test.ts
```

Expected: ARDA contract selection passes and Omama never receives ARDA documents.

- [ ] **Step 7: Commit contract isolation**

```bash
git add lib/arda-contract-variant.ts lib/__tests__/arda-contract-variant.test.ts \
  app/api/leads/[id]/contract-data/route.ts \
  app/(application)/leads/new/components/loan-contracts.tsx \
  lib/__tests__/arda-stock-loan.test.ts
git commit -m "fix: isolate ARDA stock contract and mandate"
```

---

## Task 7: Route ARDA Hostname To Shared Production Loan Matrix

**Repository:** `/Users/dazzmurenga/Documents/kenac-gitops`

**File:** `projects/loan-matrix/environments/prod/values.yaml`

- [ ] **Step 1: Record the current dedicated deployment source**

Before changing routing, locate the exact Argo CD source for the dedicated ARDA application:

```bash
git -C /Users/dazzmurenga/Documents/kenac-gitops grep -n -i 'loan-matrix-arda\|ardaloanmatrix' -- .
argocd app get loan-matrix-arda
```

Save the application source path, namespace, sync policy, and Helm values reference to `/tmp/arda-rollout/dedicated-arda-preflight.txt`.

- [ ] **Step 2: Add the public host to the shared production route**

Edit only `/Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/environments/prod/values.yaml`.

Add exactly this entry to both arrays:

```yaml
- "ardaloanmatrix.kenac.tech"
```

Required arrays:

- `istio.gateway.hosts`
- `istio.virtualService.hosts`

Do not modify:

- `env.nextAuthUrl`
- `env.fineractTenantId`
- other production host entries
- analytics allowed hosts unless ARDA analytics is separately approved

- [ ] **Step 3: Validate the rendered Helm output before commit**

Use the repository’s normal chart render command, or:

```bash
helm template loan-matrix-prod \
  /Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/helm-chart \
  -f /Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/environments/prod/values.yaml \
  >/tmp/arda-rollout/loan-matrix-prod-rendered.yaml
rg -n 'ardaloanmatrix\.kenac\.tech' /tmp/arda-rollout/loan-matrix-prod-rendered.yaml
```

Expected: hostname appears once in the Gateway and once in the VirtualService, with the shared production service as destination.

- [ ] **Step 4: Commit and open a GitOps review**

```bash
git -C /Users/dazzmurenga/Documents/kenac-gitops add projects/loan-matrix/environments/prod/values.yaml
git -C /Users/dazzmurenga/Documents/kenac-gitops commit -m "feat: route ARDA hostname to shared Loan Matrix"
git -C /Users/dazzmurenga/Documents/kenac-gitops push origin prod
```

Create a review/merge request according to the repository’s production GitOps process. Do not sync Argo until review approval is present.

- [ ] **Step 5: Sync only the shared production application**

After approval:

```bash
argocd app sync loan-matrix-prod
argocd app wait loan-matrix-prod --health --sync --timeout 600
```

Expected: shared production app is healthy. No dedicated ARDA app action occurs in this task.

---

## Task 8: Validate Shared ARDA Tenant End To End

**Files:**
- Create: `scripts/arda/verify-arda-tenant.ts`
- Modify: `package.json` only if an `arda:verify` script is required by existing script conventions

- [ ] **Step 1: Validate hostname and Login Matrix tenant resolution**

```bash
curl --fail-with-body -I https://ardaloanmatrix.kenac.tech/
```

Expected: response is served by shared production Loan Matrix and has no reference to the dedicated ARDA service/namespace.

Use the application as an ARDA user and confirm sidebar organization name is `ARDA`.

- [ ] **Step 2: Validate no Fineract cross-tenant fallback**

Temporarily run a controlled staging-equivalent request with the ARDA hostname while the ARDA tenant lookup is intentionally absent or disabled in an isolated test environment. Expected result is a visible tenant connection/configuration error, never Goodfellow or Omama data. Restore the configuration immediately.

- [ ] **Step 3: Validate ARDA catalogue and inventory**

Confirm through the ARDA host:

- ARDA products appear and Omama products do not.
- ARDA inventory items/balances match the approved manifest.
- A product value selected during lead creation produces the expected Fineract loan value.
- Moving a lead into approval reserves the selected inventory quantity.
- Rejecting a reserved lead releases the quantity.
- Disbursing issues the quantity and reduces stock on hand.
- A repayment updates ARDA inventory finance values without restoring stock quantity.

- [ ] **Step 4: Validate contracts and mandate**

Create a test ARDA stock lead and open each document:

- Loan contract contains ARDA heading and agricultural-input credit terms.
- Mandate contains ARDA wording and stock item/quantity/unit/value.
- Neither contains `Omama`, Omama branding, Omama address, or Omama email.
- The equivalent Omama lead continues to show its existing Omama contract/mandate.

- [ ] **Step 5: Validate application isolation at database level**

Run read-only count checks:

```sql
SELECT t.slug, COUNT(*) AS lead_count
FROM "Lead" l
JOIN "Tenant" t ON t.id = l."tenantId"
WHERE t.slug IN ('arda', 'omama')
GROUP BY t.slug;

SELECT t.slug, COUNT(*) AS inventory_item_count
FROM "InventoryItem" i
JOIN "Tenant" t ON t.id = i."tenantId"
WHERE t.slug IN ('arda', 'omama')
GROUP BY t.slug;
```

Compare ARDA counts to the approved manifest. Confirm Omama counts did not change from preflight.

- [ ] **Step 6: Run automated verification and full application checks**

```bash
pnpm exec tsx scripts/arda/verify-arda-tenant.ts --tenant=arda
pnpm exec tsx --test lib/__tests__/*.test.ts
pnpm lint
pnpm build
```

If the repository’s test command differs, use the documented package script and record the actual command and output. Do not mark rollout complete while a test, lint, build, Fineract tenant check, or contract isolation check fails.

---

## Task 9: Retire The Dedicated ARDA Deployment After Acceptance

**Repository:** `/Users/dazzmurenga/Documents/kenac-gitops`

**Preconditions:**

- Task 8 acceptance checks passed and results are recorded.
- The shared ARDA route has been stable for an agreed observation period.
- The dedicated Argo application source and namespace were identified in Task 7.

- [ ] **Step 1: Create a separate removal change**

Remove only the dedicated ARDA Argo Application/ApplicationSet entry identified in Task 7. If `projects/loan-matrix/environments/arda/values.yaml` has no remaining references, remove it in the same dedicated cleanup change.

Do not remove the ARDA hostname from the shared production values file.

- [ ] **Step 2: Validate the planned deletion**

```bash
git -C /Users/dazzmurenga/Documents/kenac-gitops diff --check
git -C /Users/dazzmurenga/Documents/kenac-gitops diff -- \
  projects/loan-matrix/environments/arda/values.yaml \
  projects/loan-matrix/argocd/applications
```

Expected: only dedicated ARDA deployment resources are deleted; `loan-matrix-prod` remains unchanged except for the previously approved shared hostname.

- [ ] **Step 3: Merge and confirm retirement**

After production GitOps review approval, merge/sync the removal change. Confirm:

```bash
argocd app get loan-matrix-prod
argocd app get loan-matrix-arda
kubectl get namespaces | rg 'loan-matrix-arda|arda'
```

Expected: shared production application remains healthy; dedicated application is deleted or absent; no orphan ARDA workload remains.

- [ ] **Step 4: Keep the rollback window**

Keep the dedicated deployment Git commit reachable until the agreed rollback window closes. Rollback is performed by reverting only the dedicated deletion commit or shared hostname commit as appropriate. Do not delete the Fineract `arda` tenant database during a routing rollback.

## Final Acceptance Checklist

- [ ] `ardaloanmatrix.kenac.tech` reaches shared `loan-matrix-prod`.
- [ ] Loan Matrix resolves ARDA to `Tenant.slug = arda`.
- [ ] Fineract calls from ARDA use `Fineract-Platform-TenantId: arda`.
- [ ] Missing ARDA tenant configuration fails safely and cannot reveal Goodfellow or Omama data.
- [ ] `fineract_tenant_arda` is registered and independently reachable.
- [ ] Only approved ARDA catalogue/configuration/test records were created.
- [ ] ARDA documents contain no Omama details.
- [ ] Omama operational data, settings, and tenant records are unchanged.
- [ ] Dedicated ARDA deployment removal occurs only in a separate GitOps change after validation.
