import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("servicing status is read with the service account", async () => {
  const [{ getSearchAuthToken }, { getClientServicingStatusWithServiceAuth }] =
    await Promise.all([
      import("../fineract-search-auth"),
      import("../fineract-client-servicing-status-service"),
    ]);

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        clientId: 40,
        assigned: true,
        status: { code: "ACTIVE", name: "Active", version: 1, changedOn: "2026-09-18T14:04:05Z", changedBy: "mifos" },
        policies: { EDIT_CLIENT_DETAILS: true, ORIGINATE_NEW_LOAN: true },
        history: [{ statusCode: "ACTIVE", reason: "internal note" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const result = await getClientServicingStatusWithServiceAuth({
    baseUrl: "https://fineract.kenac.tech",
    tenantId: "goodfellow-training",
    clientId: 40,
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/fineract-provider\/api\/v1\/client-servicing-statuses\/clients\/40$/);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Basic ${getSearchAuthToken()}`);
  assert.equal(headers["Fineract-Platform-TenantId"], "goodfellow-training");

  assert.equal(result.policies.ORIGINATE_NEW_LOAN, true);
  assert.equal(result.status?.code, "ACTIVE");
  assert.equal(result.history.length, 1);
});

test("service-account servicing status errors keep the Fineract status", async () => {
  const { getClientServicingStatusWithServiceAuth } = await import(
    "../fineract-client-servicing-status-service"
  );

  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ defaultUserMessage: "Client with identifier 999 does not exist" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    getClientServicingStatusWithServiceAuth({
      baseUrl: "https://fineract.kenac.tech",
      tenantId: "goodfellow-training",
      clientId: 999,
      fetchImpl,
    }),
    (error: Error & { status?: number }) =>
      error.status === 404 && /does not exist/.test(error.message)
  );
});
