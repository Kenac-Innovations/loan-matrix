import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

function formatExpectedTomorrowDate(baseDate = new Date()) {
  const tomorrow = new Date(baseDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Harare",
  }).formatToParts(tomorrow);

  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  return `${day} ${month} ${year}`;
}

test("client transfer commands use the service account headers", async () => {
  const [{ getSearchAuthToken }, { transferClientToOfficeWithServiceAuth }] =
    await Promise.all([
      import("../fineract-search-auth"),
      import("../fineract-client-transfer-service"),
    ]);

  const calls: Array<{
    url: string;
    init?: RequestInit;
  }> = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      init,
    });

    return new Response(JSON.stringify({ clientId: 58902, resourceId: 58902 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  await transferClientToOfficeWithServiceAuth({
    baseUrl: "https://fineract.kenac.tech",
    tenantId: "goodfellow",
    clientId: 58902,
    destinationOfficeId: 10,
    fetchImpl,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\?command=proposeTransfer$/);
  assert.match(calls[1].url, /\?command=acceptTransfer$/);

  const proposeBody = JSON.parse(String(calls[0].init?.body ?? "{}"));
  const acceptBody = JSON.parse(String(calls[1].init?.body ?? "{}"));

  assert.equal(proposeBody.destinationOfficeId, 10);
  assert.equal(proposeBody.dateFormat, "dd MMMM yyyy");
  assert.equal(proposeBody.locale, "en");
  assert.equal(proposeBody.transferDate, formatExpectedTomorrowDate());
  assert.ok(typeof proposeBody.note === "string");

  assert.deepEqual(Object.keys(acceptBody).sort(), ["note"]);

  for (const call of calls) {
    const headers = call.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${getSearchAuthToken()}`);
    assert.equal(headers["Fineract-Platform-TenantId"], "goodfellow");
    assert.equal(headers["Content-Type"], "application/json");
  }
});

test("client transfer rejects the proposal if accept fails after propose succeeds", async () => {
  const [{ getSearchAuthToken }, { transferClientToOfficeWithServiceAuth }] =
    await Promise.all([
      import("../fineract-search-auth"),
      import("../fineract-client-transfer-service"),
    ]);

  const calls: Array<{
    url: string;
    init?: RequestInit;
  }> = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.includes("acceptTransfer")) {
      return new Response(JSON.stringify({ error: "accept failed" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  await assert.rejects(() =>
    transferClientToOfficeWithServiceAuth({
      baseUrl: "https://fineract.kenac.tech",
      tenantId: "goodfellow",
      clientId: 58902,
      destinationOfficeId: 10,
      fetchImpl,
    })
  );

  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\?command=proposeTransfer$/);
  assert.match(calls[1].url, /\?command=acceptTransfer$/);
  assert.match(calls[2].url, /\?command=rejectTransfer$/);

  const rejectBody = JSON.parse(String(calls[2].init?.body ?? "{}"));
  assert.deepEqual(Object.keys(rejectBody).sort(), ["note"]);

  for (const call of calls) {
    const headers = call.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${getSearchAuthToken()}`);
  }
});

test("FineractAPIService transferClientToOffice ignores session auth for transfer commands", async () => {
  const [
    { getSearchAuthToken },
    { FineractAPIService },
  ] = await Promise.all([
    import("../fineract-search-auth"),
    import("../fineract-api"),
  ]);

  const originalFetch = globalThis.fetch;
  const calls: Array<{
    url: string;
    init?: RequestInit;
  }> = [];

  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ clientId: 58902, resourceId: 58902 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    const service = new FineractAPIService(
      {
        baseUrl: "https://fineract.kenac.tech",
        tenantId: "goodfellow",
        username: "mifos",
        password: "password",
      },
      "session-token-should-not-be-used"
    );

    await service.transferClientToOffice(58902, 10);

    assert.equal(calls.length, 2);
    for (const call of calls) {
      const headers = call.init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, `Basic ${getSearchAuthToken()}`);
      assert.notEqual(headers.Authorization, "Basic session-token-should-not-be-used");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
