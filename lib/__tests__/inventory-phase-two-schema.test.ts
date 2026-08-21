import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const schema = readFileSync("prisma/schema.prisma", "utf8");

test("ARDA inventory phase two schema supports branch names, currency, issues, and repayments", () => {
  assert.match(schema, /model InventoryItem[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model InventoryBalance[\s\S]*fineractOfficeName\s+String\?/);
  assert.match(schema, /model InventoryBalance[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model InventoryMovement[\s\S]*fineractOfficeName\s+String\?/);
  assert.match(schema, /model InventoryMovement[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model StockLoanIssue[\s\S]*leadId\s+String\?/);
  assert.match(schema, /model StockLoanIssue[\s\S]*borrowerName\s+String\?/);
  assert.match(schema, /model StockLoanIssue[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model StockLoanIssueLine[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model StockLoanRepayment/);
  assert.match(schema, /stockLoanRepayments\s+StockLoanRepayment\[\]/);
});
