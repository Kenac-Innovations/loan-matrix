import assert from "node:assert/strict";
import test from "node:test";
import { getArdaDocumentVariant } from "../arda-contract-variant";

test("selects the ARDA agreement only for ARDA stock products", () => {
  assert.equal(
    getArdaDocumentVariant("arda", {
      externalId: "ARDA-STOCK-INPUT-LOAN",
      name: "ARDA Stock Input Loan",
    }),
    "ARDA_STOCK_INPUT",
  );
  assert.equal(
    getArdaDocumentVariant("omama", {
      externalId: "ARDA-STOCK-INPUT-LOAN",
      name: "ARDA Stock Input Loan",
    }),
    "DEFAULT",
  );
  assert.equal(
    getArdaDocumentVariant("arda", { name: "Cash Loan" }),
    "DEFAULT",
  );
});
