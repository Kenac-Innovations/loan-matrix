import test from "node:test";
import assert from "node:assert/strict";
import { stockCommand } from "../inventory/stock-command-policy";
test("command detection covers manual loan endpoints without intercepting repayments or reads", () => {
  for (const command of [
    "approve",
    "disburse",
    "undoapproval",
    "undodisbursal",
    "reject",
  ])
    assert.equal(
      stockCommand(`/loans/7?locale=en&command=${command}`, "POST")?.command,
      command,
    );
  assert.equal(stockCommand("/loans/7?command=approve", "GET"), null);
  assert.equal(
    stockCommand("/loans/7/transactions?command=repayment", "POST"),
    null,
  );
  assert.equal(stockCommand("/loans/7", "PUT")?.command, "update");
});
