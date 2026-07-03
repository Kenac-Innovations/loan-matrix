import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("USSD application data enriches Yango payout status from payment references", () => {
  const source = readRepoFile("app/actions/ussd-leads-actions.ts");

  assert.match(source, /buildYangoPaymentStatusMap/);
  assert.match(source, /paymentStatusByReference\.get\(app\.referenceNumber\)\?\.status/);
});

test("USSD linked leads show API-derived payout status", () => {
  const actionsSource = readRepoFile("app/actions/leads-actions.ts");
  const tableSource = readRepoFile(
    "app/(application)/ussd-leads/components/ussd-linked-leads-table.tsx"
  );

  assert.match(actionsSource, /source === "USSD"/);
  assert.match(actionsSource, /referenceNumber/);
  assert.match(actionsSource, /buildYangoPaymentStatusMap/);
  assert.match(tableSource, /header: "Payout"/);
  assert.match(tableSource, /getPayoutStatusLabel/);
});
