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

  const mod = await import("../ussd-admin-client");

  assert.equal(typeof mod.normalizeUssdPhoneNumber, "function");
  assert.equal(mod.normalizeUssdPhoneNumber("0977 123 456"), "260977123456");
  assert.equal(mod.normalizeUssdPhoneNumber("+260977123456"), "260977123456");

  const source = readRepoFile("lib/ussd-admin-client.ts");
  assert.match(source, /USSD_ADMIN_API_KEY/);
  assert.match(source, /X-USSD-Admin-Key/);
  assert.doesNotMatch(source, /USSD_LOAN_PRODUCT_SYNC_API_KEY/);
});

test("USSD admin client returns structured reset failures from USSD", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: false,
        status: "SMS_FAILED_PIN_CHANGED",
        message: "PIN was changed but the reset SMS was not accepted",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )) as typeof fetch;

  try {
    const mod = await import("../ussd-admin-client");
    const result = await mod.resetUssdPin({
      phoneNumber: "0977 123 456",
      actorUserId: 501,
      actorName: "Admin User",
      reason: "Client verified at branch",
    });

    assert.equal(result.success, false);
    assert.equal(result.status, "SMS_FAILED_PIN_CHANGED");
    assert.equal(
      result.message,
      "PIN was changed but the reset SMS was not accepted"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("USSD admin client normalizes string lookup user ids from USSD", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        userId: "42",
        fullName: "Mary Banda",
        nationalIdMask: "123456****",
        phoneNumber: "260977123456",
        accountNumber: "ACC-123",
        status: "ACTIVE",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )) as typeof fetch;

  try {
    const mod = await import("../ussd-admin-client");
    const result = await mod.lookupUssdUserByPhone("0977 123 456");

    assert.equal(result?.userId, 42);
    assert.equal(typeof result?.userId, "number");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
