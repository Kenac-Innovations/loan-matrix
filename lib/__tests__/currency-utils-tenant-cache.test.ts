import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

const currenciesByTenant: Record<string, string> = {
  goodfellow: "ZMK",
  rulethu: "USD",
};

function setup() {
  let tenant = "goodfellow";
  let fetches = 0;
  let clock = 0;
  return {
    setTenant: (t: string) => {
      tenant = t;
    },
    advance: (ms: number) => {
      clock += ms;
    },
    get fetches() {
      return fetches;
    },
    deps: {
      getTenantKey: async () => tenant,
      fetchCurrencies: async () => {
        fetches += 1;
        return { selectedCurrencyOptions: [{ code: currenciesByTenant[tenant] }] };
      },
      now: () => clock,
    },
  };
}

test("one tenant's cached currency never leaks into another tenant's request", async () => {
  const { createOrgCurrencyResolver } = await import("../currency-utils");
  const env = setup();
  const resolve = createOrgCurrencyResolver(env.deps);

  env.setTenant("goodfellow");
  assert.deepEqual(
    { code: (await resolve())?.code, raw: (await resolve())?.rawCode },
    { code: "ZMW", raw: "ZMK" }
  );

  env.setTenant("rulethu");
  const rulethu = await resolve();
  assert.equal(rulethu?.code, "USD");
  assert.equal(rulethu?.rawCode, "USD");
});

test("each tenant is cached separately and refetched after the TTL", async () => {
  const { createOrgCurrencyResolver } = await import("../currency-utils");
  const env = setup();
  const resolve = createOrgCurrencyResolver(env.deps);

  env.setTenant("goodfellow");
  await resolve();
  env.setTenant("rulethu");
  await resolve();
  env.setTenant("goodfellow");
  await resolve();
  assert.equal(env.fetches, 2);

  env.advance(5 * 60 * 1000 + 1);
  await resolve();
  assert.equal(env.fetches, 3);
});

test("returns null when Fineract cannot be reached", async () => {
  const { createOrgCurrencyResolver } = await import("../currency-utils");
  const resolve = createOrgCurrencyResolver({
    getTenantKey: async () => "rulethu",
    fetchCurrencies: async () => {
      throw new Error("down");
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await resolve(), null);
  } finally {
    console.error = originalError;
  }
});

test("invalidate drops only the current tenant's cached currency", async () => {
  const { createOrgCurrencyResolver } = await import("../currency-utils");
  const env = setup();
  const resolve = createOrgCurrencyResolver(env.deps);

  env.setTenant("goodfellow");
  await resolve();
  env.setTenant("rulethu");
  await resolve();
  assert.equal(env.fetches, 2);

  await resolve.invalidate();
  await resolve();
  assert.equal(env.fetches, 3);

  env.setTenant("goodfellow");
  await resolve();
  assert.equal(env.fetches, 3);
});
