import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("adds Inventory to desktop and mobile navigation", () => {
  const sidebar = readRepoFile("app/(application)/components/sidebar-nav.tsx");
  const mobileSidebar = readRepoFile("app/(application)/components/mobile-sidebar.tsx");

  assert.match(sidebar, /label="Inventory"/);
  assert.match(sidebar, /href="\/inventory"/);
  assert.match(mobileSidebar, />\s*Inventory\s*</);
  assert.match(mobileSidebar, /href="\/inventory"/);
});

test("adds inventory APIs for catalogue, balances, movements, and stock receiving", () => {
  for (const route of [
    "app/api/inventory/items/route.ts",
    "app/api/inventory/balances/route.ts",
    "app/api/inventory/movements/route.ts",
    "app/api/inventory/receipts/route.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), route)), `${route} should exist`);
  }

  const receiptsRoute = readRepoFile("app/api/inventory/receipts/route.ts");
  assert.match(receiptsRoute, /receiveInventory/);
  assert.match(receiptsRoute, /idempotencyKey/);
});

test("adds an inventory page for item creation and stock receiving", () => {
  const page = readRepoFile("app/(application)/inventory/page.tsx");

  assert.match(page, /Inventory Control/);
  assert.match(page, /Create Stock Item/);
  assert.match(page, /Receive Stock/);
  assert.match(page, /Movement History/);
  assert.doesNotMatch(page, /Disburse Stock/);
  assert.doesNotMatch(page, /Record Repayment/);
});
