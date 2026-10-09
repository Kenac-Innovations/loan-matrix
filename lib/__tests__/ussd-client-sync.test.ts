import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("updateUssdClientPhone sends normalized phone numbers to the external-id phone endpoint", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(
      JSON.stringify({
        success: true,
        status: "UPDATED",
        message: "Phone number updated",
        userId: "42",
        externalId: 9911,
        oldPhoneNumber: "260977123456",
        newPhoneNumber: "260966654321",
        primaryPhoneUpdated: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const mod = await import("../ussd-client-sync");
    const result = await mod.updateUssdClientPhone({
      ussdServiceTenantId: "goodfellow",
      externalId: 9911,
      currentPhoneNumber: "0977 123 456",
      newPhoneNumber: "0966 654 321",
    });

    assert.equal(result.success, true);
    assert.equal(result.status, "UPDATED");
    assert.equal(result.oldPhoneNumber, "260977123456");
    assert.equal(result.newPhoneNumber, "260966654321");
    assert.equal(result.primaryPhoneUpdated, true);

    assert.equal(
      capturedUrl,
      "http://localhost:8080/api/v1/admin/users/external/9911/phone"
    );
    assert.equal(capturedInit?.method, "PUT");
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers["X-USSD-Admin-Key"], "admin-reset-key");
    assert.equal(headers["X-USSD-Tenant-Id"], "goodfellow");

    const sentBody = JSON.parse(capturedInit?.body as string);
    assert.equal(sentBody.currentPhoneNumber, "260977123456");
    assert.equal(sentBody.newPhoneNumber, "260966654321");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateUssdClientPhone returns a structured NOT_FOUND result instead of throwing", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: false,
        status: "NOT_FOUND",
        message: "No USSD user was found for this client",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  try {
    const mod = await import("../ussd-client-sync");
    const result = await mod.updateUssdClientPhone({
      ussdServiceTenantId: "goodfellow",
      externalId: 9911,
      currentPhoneNumber: "0977123456",
      newPhoneNumber: "0966654321",
    });

    assert.equal(result.success, false);
    assert.equal(result.status, "NOT_FOUND");
    assert.ok(mod.USSD_PHONE_UPDATE_NON_BLOCKING_STATUSES.has(result.status));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateUssdClientPhone returns a structured PHONE_MISMATCH result that callers must treat as blocking", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: false,
        status: "PHONE_MISMATCH",
        message: "The phone number on record does not match what was provided",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  try {
    const mod = await import("../ussd-client-sync");
    const result = await mod.updateUssdClientPhone({
      ussdServiceTenantId: "goodfellow",
      externalId: 9911,
      currentPhoneNumber: "0900000000",
      newPhoneNumber: "0966654321",
    });

    assert.equal(result.success, false);
    assert.equal(result.status, "PHONE_MISMATCH");
    assert.equal(
      mod.USSD_PHONE_UPDATE_NON_BLOCKING_STATUSES.has(result.status),
      false
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateUssdClientPhone throws when USSD returns an error with no parseable body", async () => {
  process.env.USSD_BASE_URL = "http://localhost:8080/api/v1";
  process.env.USSD_ADMIN_API_KEY = "admin-reset-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("Service Unavailable", { status: 503 })) as typeof fetch;

  try {
    const mod = await import("../ussd-client-sync");
    await assert.rejects(
      mod.updateUssdClientPhone({
        ussdServiceTenantId: "goodfellow",
        externalId: 9911,
        currentPhoneNumber: "0977123456",
        newPhoneNumber: "0966654321",
      }),
      /USSD phone update failed \(503\)/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
