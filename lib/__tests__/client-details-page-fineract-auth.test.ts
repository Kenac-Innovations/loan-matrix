import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("uses the service account for client details page Fineract GET headers", async () => {
  const [{ getSearchAuthToken }, { getClientDetailsPageFineractHeaders }] =
    await Promise.all([
      import("../fineract-search-auth"),
      import("../client-details-page-fineract-auth"),
    ]);

  const headers = getClientDetailsPageFineractHeaders("tenant-a");

  assert.equal(headers.Authorization, `Basic ${getSearchAuthToken()}`);
  assert.equal(headers["Fineract-Platform-TenantId"], "tenant-a");
  assert.equal(headers.Accept, "application/json");
  assert.equal(headers["Content-Type"], "application/json");
});

test("allows overriding the accept header for non-JSON client detail assets", async () => {
  const { getClientDetailsPageFineractHeaders } = await import(
    "../client-details-page-fineract-auth"
  );

  const headers = getClientDetailsPageFineractHeaders(
    "tenant-a",
    "application/json, text/plain, */*"
  );

  assert.equal(headers.Accept, "application/json, text/plain, */*");
  assert.equal(headers["Fineract-Platform-TenantId"], "tenant-a");
});
