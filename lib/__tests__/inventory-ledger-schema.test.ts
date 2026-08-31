import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");

test("defines a tenant and branch scoped inventory ledger for in-kind loan issues", () => {
  for (const model of [
    "InventoryItem",
    "InventoryBalance",
    "InventoryMovement",
    "StockLoanIssue",
    "StockLoanIssueLine",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  assert.match(schema, /enum InventoryMovementType \{/);
  assert.match(schema, /enum StockLoanIssueStatus \{/);
  assert.match(
    schema,
    /@@unique\(\[tenantId, fineractOfficeId, inventoryItemId, currencyCode\]\)/
  );
  assert.match(schema, /@@unique\(\[tenantId, idempotencyKey\]\)/);
  assert.match(schema, /quantityOnHand\s+Decimal/);
  assert.match(schema, /quantityReserved\s+Decimal/);
  assert.match(schema, /stockLoanIssueId\s+String\?/);
  assert.match(schema, /fineractLoanId\s+Int\?/);
});
