import assert from "node:assert/strict";
import test from "node:test";
import { buildArdaCataloguePlan } from "../arda-catalogue-plan";

test("defines the three ARDA stock-credit products with their agreed repayment periods", () => {
  const plan = buildArdaCataloguePlan();

  assert.deepEqual(
    plan.products.map((product) => [product.externalId, product.repayments, product.interestRatePerPeriod]),
    [
      ["ARDA-STOCK-INPUT-LOAN", 3, 2],
      ["ARDA-STOCK-MAIZE-SEED-6M", 6, 2],
      ["ARDA-STOCK-GROUNDNUT-SEED-1M", 1, 2],
    ],
  );
});

test("starts ARDA with an inventory catalogue but no copied stock", () => {
  const plan = buildArdaCataloguePlan();

  assert.deepEqual(
    plan.inventoryItems.map((item) => item.sku),
    ["ARDA-MAIZE-SEED-10KG", "ARDA-GROUNDNUT-SEED-10KG"],
  );
  assert.equal(plan.initialReceipts.length, 0);
});
