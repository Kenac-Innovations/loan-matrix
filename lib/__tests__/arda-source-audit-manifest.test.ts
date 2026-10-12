import assert from "node:assert/strict";
import test from "node:test";
import { buildArdaSourceAuditManifest } from "../arda-source-audit-manifest";

test("creates a reviewable manifest without treating tagged test data as copyable", () => {
  const manifest = buildArdaSourceAuditManifest({
    generatedAt: "2026-08-31T00:00:00.000Z",
    inventory: [
      { id: "inventory-1", externalId: "ARDA-INV-MAIZE-10KG", name: "Maize seed" },
      { id: "inventory-2", externalId: "TEST-001", name: "ARDA test stock", tags: ["ARDA_TEST"] },
    ],
    loanProducts: [
      { id: 10, externalId: "ARDA-STOCK-MAIZE-SEED-6M", name: "ARDA Maize" },
      { id: 11, externalId: "OMAMA-CASH", name: "Normal Cash Loan" },
    ],
    contractTemplates: [
      { id: "template-1", externalId: "arda-stock-input", name: "ARDA agreement" },
      { id: "template-2", externalId: "full-loan", name: "Omama full loan" },
    ],
  });

  assert.equal(manifest.summary.copyAllowed, 3);
  assert.equal(manifest.summary.reviewRequired, 1);
  assert.equal(manifest.summary.excluded, 2);
  assert.equal(manifest.safety.sourceWriteOperations, 0);
  assert.equal(manifest.records.inventory[1].classification.kind, "review");
});
