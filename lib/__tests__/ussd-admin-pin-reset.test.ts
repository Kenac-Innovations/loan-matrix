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

test("USSD admin client returns structured forced PIN change notification failures from USSD", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: true,
        status: "FLAGGED_SMS_FAILED",
        message:
          "PIN change was required, but the notification SMS was not accepted",
        resetRequired: true,
        pinChanged: false,
        smsAccepted: false,
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
    const result = await mod.resetUssdPin({
      ussdServiceTenantId: "goodfellow",
      phoneNumber: "0977 123 456",
      actorUserId: 501,
      actorName: "Admin User",
      reason: "Client verified at branch",
    });

    assert.equal(result.success, true);
    assert.equal(result.status, "FLAGGED_SMS_FAILED");
    assert.equal(
      result.message,
      "PIN change was required, but the notification SMS was not accepted"
    );
    assert.equal(result.resetRequired, true);
    assert.equal(result.pinChanged, false);
    assert.equal(result.smsAccepted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("USSD admin client sends the configured service tenant id in headers", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const requests: Array<{ url: string; headers: Headers }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
    });

    return new Response(
      JSON.stringify({
        userId: "42",
        fullName: "Mary Banda",
        externalId: "9911",
        nationalIdMask: "123456****",
        phoneNumber: "260977123456",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  try {
    const mod = await import("../ussd-admin-client");
    await mod.lookupUssdUserByPhone({
      phoneNumber: "0977 123 456",
      ussdServiceTenantId: "goodfellow",
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.get("X-USSD-Tenant-Id"), "goodfellow");
    assert.match(requests[0].url, /phoneNumber=260977123456/);
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
        externalId: "9911",
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
    const result = await mod.lookupUssdUserByPhone({
      phoneNumber: "0977 123 456",
      ussdServiceTenantId: "goodfellow",
    });

    assert.equal(result?.userId, 42);
    assert.equal(typeof result?.userId, "number");
    assert.equal(result?.externalId, 9911);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Loan Matrix audit model records PIN change requests without storing PIN values", () => {
  const schema = readRepoFile("prisma/schema.prisma");

  assert.match(schema, /model UssdPinResetLog/);
  assert.match(schema, /ussdServiceTenantId\s+String\?/);
  assert.match(schema, /canResetUssdPin\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /ussdPinResetLogs\s+UssdPinResetLog\[\]/);
  assert.match(schema, /status\s+String\s+@default\("PENDING"\)/);
  assert.match(schema, /actorUserId\s+Int/);
  assert.match(schema, /reason\s+String\s+@db\.Text/);
  assert.doesNotMatch(schema, /newPin|temporaryPin|plainPin|pinValue/i);
});

test("USSD PIN reset API creates and updates a local audit log with USSD statuses", () => {
  const resetRoute = readRepoFile("app/api/ussd-pin-reset/reset/route.ts");
  const access = readRepoFile("lib/ussd-pin-reset-access.ts");

  assert.match(resetRoute, /requireUssdPinResetAccess/);
  assert.match(resetRoute, /prisma\.ussdPinResetLog\.create/);
  assert.match(resetRoute, /prisma\.ussdPinResetLog\.update/);
  assert.match(resetRoute, /ussdServiceTenantId/);
  assert.match(resetRoute, /requireUssdServiceTenantId/);
  assert.match(
    access,
    /USSD PIN reset is not enabled for this tenant/
  );
  assert.match(resetRoute, /resetUssdPin/);
  assert.match(resetRoute, /const finalStatus =\s+resetResult\.status \|\|/);
  assert.match(
    resetRoute,
    /const responseStatus = resetResult\.success \? 200 : 400/
  );
  assert.match(resetRoute, /{ status: responseStatus }/);
  assert.match(resetRoute, /Failed to require USSD PIN change/);
  assert.doesNotMatch(resetRoute, /\? "SUCCESS"/);
  assert.doesNotMatch(resetRoute, /newPin|temporaryPin|plainPin|pinValue/i);
});

test("USSD PIN reset screen requests a forced PIN change instead of describing a direct reset", () => {
  const page = readRepoFile("app/(application)/ussd-pin-reset/page.tsx");
  const component = readRepoFile(
    "app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx"
  );

  assert.match(page, /flag a client to change their USSD PIN/);
  assert.match(component, /Require PIN Change/);
  assert.match(component, /PIN change requested/);
  assert.match(component, /prompted to set a new PIN in USSD/);
  assert.match(component, /Staff-initiated USSD PIN change activity/);
  assert.doesNotMatch(component, /USSD reset SMS sent|Reset USSD PIN|PIN reset failed/);
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
