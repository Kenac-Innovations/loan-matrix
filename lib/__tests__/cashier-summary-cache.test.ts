import assert from "node:assert/strict";
import test from "node:test";

import {
  CASHIER_SUMMARY_TTL_MS,
  cashierSummaryScope,
  clearCashierSummaryCache,
  getOrLoadCashierSummary,
  invalidateCashierSummary,
} from "../cashier-summary-cache";

const parts = { scope: "goodfellow:abc", tellerId: 1, cashierId: 7, currencyCode: "USD" };

function counter<T>(value: T) {
  let calls = 0;
  return {
    load: async () => {
      calls += 1;
      return value;
    },
    get calls() {
      return calls;
    },
  };
}

test("concurrent identical requests share one Fineract call", async () => {
  clearCashierSummaryCache();
  const c = counter({ netCash: 10 });
  const results = await Promise.all([1, 2, 3, 4].map(() => getOrLoadCashierSummary(parts, c.load)));
  assert.equal(c.calls, 1);
  assert.deepEqual(results, [{ netCash: 10 }, { netCash: 10 }, { netCash: 10 }, { netCash: 10 }]);
});

test("a settled result is reused within the TTL and reloaded after it", async () => {
  clearCashierSummaryCache();
  let clock = 1_000;
  const now = () => clock;
  const c = counter({ netCash: 10 });
  await getOrLoadCashierSummary(parts, c.load, now);
  clock += CASHIER_SUMMARY_TTL_MS - 1;
  await getOrLoadCashierSummary(parts, c.load, now);
  assert.equal(c.calls, 1);
  clock += 2;
  await getOrLoadCashierSummary(parts, c.load, now);
  assert.equal(c.calls, 2);
});

test("different scope, cashier, currency or page are cached separately", async () => {
  clearCashierSummaryCache();
  const c = counter({});
  await getOrLoadCashierSummary(parts, c.load);
  await getOrLoadCashierSummary({ ...parts, scope: "goodfellow:other-user" }, c.load);
  await getOrLoadCashierSummary({ ...parts, cashierId: 8 }, c.load);
  await getOrLoadCashierSummary({ ...parts, currencyCode: "ZMW" }, c.load);
  await getOrLoadCashierSummary({ ...parts, offset: 500, limit: 500 }, c.load);
  assert.equal(c.calls, 5);
});

test("scope separates tenants and credentials without embedding the credential", () => {
  const a = cashierSummaryScope("goodfellow", "token-a");
  assert.equal(a, cashierSummaryScope("goodfellow", "token-a"));
  assert.notEqual(a, cashierSummaryScope("goodfellow", "token-b"));
  assert.notEqual(a, cashierSummaryScope("omama", "token-a"));
  assert.ok(!a.includes("token-a"));
  assert.ok(!cashierSummaryScope("a|b", "x").includes("|"));
});

test("failures are not cached", async () => {
  clearCashierSummaryCache();
  let calls = 0;
  const failing = async () => {
    calls += 1;
    throw new Error("boom");
  };
  await assert.rejects(getOrLoadCashierSummary(parts, failing));
  await assert.rejects(getOrLoadCashierSummary(parts, failing));
  assert.equal(calls, 2);
});

test("invalidating a cashier forces the next read to reload", async () => {
  clearCashierSummaryCache();
  const c = counter({});
  await getOrLoadCashierSummary(parts, c.load);
  await getOrLoadCashierSummary({ ...parts, cashierId: 8 }, c.load);
  invalidateCashierSummary(1, 7);
  await getOrLoadCashierSummary(parts, c.load);
  await getOrLoadCashierSummary({ ...parts, cashierId: 8 }, c.load);
  assert.equal(c.calls, 3);
});

test("invalidating a teller drops all its cashiers but not other tellers", async () => {
  clearCashierSummaryCache();
  const c = counter({});
  await getOrLoadCashierSummary(parts, c.load);
  await getOrLoadCashierSummary({ ...parts, cashierId: 8 }, c.load);
  await getOrLoadCashierSummary({ ...parts, tellerId: 2 }, c.load);
  invalidateCashierSummary(1);
  await getOrLoadCashierSummary(parts, c.load);
  await getOrLoadCashierSummary({ ...parts, cashierId: 8 }, c.load);
  await getOrLoadCashierSummary({ ...parts, tellerId: 2 }, c.load);
  assert.equal(c.calls, 5);
});

test("an in-flight request invalidated mid-way is not reused afterwards", async () => {
  clearCashierSummaryCache();
  let resolveFirst!: (v: unknown) => void;
  let calls = 0;
  const load = () => {
    calls += 1;
    return calls === 1 ? new Promise((r) => (resolveFirst = r)) : Promise.resolve("fresh");
  };
  const first = getOrLoadCashierSummary(parts, load);
  invalidateCashierSummary(1, 7);
  const second = await getOrLoadCashierSummary(parts, load);
  resolveFirst("stale");
  await first;
  assert.equal(second, "fresh");
  assert.equal(await getOrLoadCashierSummary(parts, load), "fresh");
  assert.equal(calls, 2);
});
