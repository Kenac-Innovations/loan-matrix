import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readMigration(name: string): string {
  const migrationPath = path.join(repoRoot, "prisma/migrations", name, "migration.sql");
  assert.equal(existsSync(migrationPath), true, `${name} migration should exist`);
  return readFileSync(migrationPath, "utf8");
}

test("payment confirmation access is controlled by UserLogin.canConfirmPayments", () => {
  const schema = readRepoFile("prisma/schema.prisma");
  const permissionMigration = readMigration(
    "20260704160000_add_user_login_payment_confirmation_access"
  );
  const accessSource = readRepoFile("lib/payment-confirmation-access.ts");
  const pageSource = readRepoFile("app/(application)/leads/payment-confirmation/page.tsx");
  const roleRouteSource = readRepoFile("app/api/auth/user-roles/route.ts");
  const roleGuardSource = readRepoFile("components/role-guard.tsx");
  const desktopSidebarSource = readRepoFile(
    "app/(application)/components/sidebar-nav.tsx"
  );
  const mobileSidebarSource = readRepoFile(
    "app/(application)/components/mobile-sidebar.tsx"
  );

  assert.match(schema, /canConfirmPayments\s+Boolean\s+@default\(false\)/);
  assert.match(
    permissionMigration,
    /ALTER TABLE "UserLogin"\s+ADD COLUMN IF NOT EXISTS "canConfirmPayments" BOOLEAN NOT NULL DEFAULT false/
  );
  assert.match(accessSource, /canConfirmPayments: true/);
  assert.doesNotMatch(accessSource, /features\.leadConfig/);
  assert.match(pageSource, /requirePaymentConfirmationPageAccess/);
  assert.match(roleRouteSource, /canConfirmPayments/);
  assert.match(roleGuardSource, /canConfirmPayments/);
  assert.match(desktopSidebarSource, /canConfirmPayments/);
  assert.match(mobileSidebarSource, /canConfirmPayments/);
  assert.doesNotMatch(
    desktopSidebarSource,
    /Payment Confirmation[\s\S]{0,120}isEnabled\("leadConfig"\)/
  );
});

test("user management exposes and persists payment confirmation permission", () => {
  const actionsSource = readRepoFile("app/actions/user-management-actions.ts");
  const userTypesSource = readRepoFile("shared/types/user-management.ts");
  const userFormSource = readRepoFile(
    "app/(application)/organization/users/components/user-form.tsx"
  );
  const usersPageSource = readRepoFile(
    "app/(application)/organization/users/components/users-page-client.tsx"
  );
  const userDetailTabsSource = readRepoFile(
    "app/(application)/organization/users/components/user-detail-tabs.tsx"
  );
  const userLoginServiceSource = readRepoFile("lib/user-login-service.ts");

  assert.match(actionsSource, /canConfirmPayments: z\.boolean\(\)\.default\(false\)/);
  assert.match(actionsSource, /canConfirmPayments:\s+localLogin\?\.canConfirmPayments \?\? false/);
  assert.match(userTypesSource, /canConfirmPayments: boolean/);
  assert.match(userFormSource, /canConfirmPayments/);
  assert.match(userFormSource, /Can confirm payments/);
  assert.match(usersPageSource, /canConfirmPayments/);
  assert.match(userDetailTabsSource, /Can Confirm Payments/);
  assert.match(userLoginServiceSource, /canConfirmPayments\?: boolean/);
  assert.match(userLoginServiceSource, /updateData\.canConfirmPayments/);
});

test("payment confirmation loading states use skeletons instead of spinner-only loaders", () => {
  const clientSource = readRepoFile(
    "app/(application)/leads/payment-confirmation/components/payment-confirmation-client.tsx"
  );

  assert.match(clientSource, /PaymentConfirmationTableSkeleton/);
  assert.match(clientSource, /CsvUploadDropzone/);
  assert.match(clientSource, /Upload/);
  assert.doesNotMatch(clientSource, /Loader2 className="mx-auto h-5 w-5 animate-spin/);
});

test("payment confirmation lookup is launched from reference column modal", () => {
  const clientSource = readRepoFile(
    "app/(application)/leads/payment-confirmation/components/payment-confirmation-client.tsx"
  );

  assert.match(clientSource, /referenceColumnDialogOpen/);
  assert.match(clientSource, /Select payment reference column/);
  assert.match(clientSource, /handleOpenReferenceColumnDialog/);
  assert.match(clientSource, /DialogContent/);
  assert.match(clientSource, /columnMapping: \{ referenceColumn: mapping\.referenceColumn \}/);
  assert.doesNotMatch(clientSource, /Object\.keys\(FIELD_LABELS\)/);
  assert.doesNotMatch(clientSource, /fineractLoanId: mapping\.loanIdColumn/);
});

test("payment confirmation CSV upload card collapses after lookup", () => {
  const clientSource = readRepoFile(
    "app/(application)/leads/payment-confirmation/components/payment-confirmation-client.tsx"
  );

  assert.match(clientSource, /csvUploadAccordionValue/);
  assert.match(
    clientSource,
    /useState<[\s\S]{0,40}string\[\][\s\S]{0,40}>\(\["csv-upload"\]\)/
  );
  assert.match(clientSource, /setCsvUploadAccordionValue\(\["csv-upload"\]\)/);
  assert.match(clientSource, /setCsvUploadAccordionValue\(\[\]\)/);
  assert.match(clientSource, /value="csv-upload"/);
  assert.match(clientSource, /AccordionContent/);
  assert.doesNotMatch(clientSource, /csvPreviewAccordionValue/);
  assert.doesNotMatch(
    clientSource,
    /compact=\{Boolean\(lookup\)\}/
  );
});

test("payment confirmation tables use payment service display fields and action modals", () => {
  const clientSource = readRepoFile(
    "app/(application)/leads/payment-confirmation/components/payment-confirmation-client.tsx"
  );
  const confirmedRouteSource = readRepoFile(
    "app/api/leads/payment-confirmation/confirmed/route.ts"
  );
  const unconfirmedRouteSource = readRepoFile(
    "app/api/leads/payment-confirmation/unconfirmed/route.ts"
  );

  for (const label of [
    "Phone",
    "Amount",
    "Payment Ref Number",
    "Loan Ref",
    "Status",
  ]) {
    assert.match(clientSource, new RegExp(label));
  }

  assert.match(clientSource, /formatPaymentAmount/);
  assert.match(clientSource, /confirmDialogOpen/);
  assert.match(clientSource, /rejectDialogOpen/);
  assert.match(clientSource, /Progress/);
  assert.match(clientSource, /not reversible from this page/i);
  assert.match(confirmedRouteSource, /phoneNumber/);
  assert.match(confirmedRouteSource, /paymentInternalReference/);
  assert.match(confirmedRouteSource, /paymentUserReference/);
  assert.match(unconfirmedRouteSource, /phoneNumber/);
  assert.match(unconfirmedRouteSource, /paymentInternalReference/);
  assert.match(unconfirmedRouteSource, /paymentUserReference/);
});

test("payment confirmation reject resolves loans by Fineract externalId report", () => {
  const rejectRouteSource = readRepoFile(
    "app/api/leads/payment-confirmation/reject/route.ts"
  );
  const clientSource = readRepoFile(
    "app/(application)/leads/payment-confirmation/components/payment-confirmation-client.tsx"
  );

  assert.match(rejectRouteSource, /PAYMENT_CONFIRMATION_LOAN_LOOKUP_REPORT/);
  assert.match(rejectRouteSource, /runreports/);
  assert.match(rejectRouteSource, /R_loanExternalId/);
  assert.match(rejectRouteSource, /paymentUserReference/);
  assert.match(clientSource, /loanExternalId/);
});
