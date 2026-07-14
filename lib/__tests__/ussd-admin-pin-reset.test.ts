import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("USSD admin client uses the dedicated admin key and never the loan-product sync key", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const mod = await import("../ussd-admin-client.ts");

  assert.equal(typeof mod.normalizeUssdPhoneNumber, "function");
  assert.equal(mod.normalizeUssdPhoneNumber("0977 123 456"), "260977123456");
  assert.equal(mod.normalizeUssdPhoneNumber("+260977123456"), "260977123456");

  const source = readRepoFile("lib/ussd-admin-client.ts");
  assert.match(source, /USSD_ADMIN_API_KEY/);
  assert.match(source, /X-USSD-Admin-Key/);
  assert.doesNotMatch(source, /USSD_LOAN_PRODUCT_SYNC_API_KEY/);
});

test("Loan Matrix audit model records reset attempts without storing PIN values", () => {
  const schema = readRepoFile("prisma/schema.prisma");

  assert.match(schema, /model UssdPinResetLog/);
  assert.match(schema, /canResetUssdPin\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /ussdPinResetLogs\s+UssdPinResetLog\[\]/);
  assert.match(schema, /status\s+String\s+@default\("PENDING"\)/);
  assert.match(schema, /actorUserId\s+Int/);
  assert.match(schema, /reason\s+String\s+@db\.Text/);
  assert.doesNotMatch(schema, /newPin|temporaryPin|plainPin|pinValue/i);
});

test("USSD PIN reset API creates and updates a local audit log", () => {
  const resetRoute = readRepoFile("app/api/ussd-pin-reset/reset/route.ts");

  assert.match(resetRoute, /requireUssdPinResetAccess/);
  assert.match(resetRoute, /prisma\.ussdPinResetLog\.create/);
  assert.match(resetRoute, /prisma\.ussdPinResetLog\.update/);
  assert.match(resetRoute, /resetUssdPin/);
  assert.doesNotMatch(resetRoute, /newPin|temporaryPin|plainPin|pinValue/i);
});

test("USSD PIN reset permission is wired into users and navigation", () => {
  const actions = readRepoFile("app/actions/user-management-actions.ts");
  const userForm = readRepoFile(
    "app/(application)/organization/users/components/user-form.tsx"
  );
  const layout = readRepoFile("app/(application)/layout.tsx");
  const sidebar = readRepoFile("app/(application)/components/sidebar-nav.tsx");
  const mobileSidebar = readRepoFile(
    "app/(application)/components/mobile-sidebar.tsx"
  );

  assert.match(actions, /canResetUssdPin/);
  assert.match(userForm, /canResetUssdPin/);
  assert.match(layout, /canResetUssdPin/);
  assert.match(sidebar, /USSD PIN Reset/);
  assert.match(mobileSidebar, /USSD PIN Reset/);
});
