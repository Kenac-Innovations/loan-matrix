import assert from "node:assert/strict";
import test from "node:test";

test("prefers the nested Fineract validation error over the generic domain-rule wrapper", async () => {
  const { parseFineractErrorResponse } = await import("../fineract-error");

  const message = parseFineractErrorResponse({
    developerMessage:
      "Request was understood but caused a domain rule violation.",
    httpStatusCode: "403",
    defaultUserMessage: "Errors contain reason for domain rule violation.",
    userMessageGlobalisationCode: "validation.msg.domain.rule.violation",
    errors: [
      {
        developerMessage:
          "error msg cannot transfer client as loan transaction present on or after transfer date",
        defaultUserMessage:
          "error msg cannot transfer client as loan transaction present on or after transfer date",
        userMessageGlobalisationCode:
          "error.msg.cannot.transfer.client.as.loan.transaction.present.on.or.after.transfer.date",
        parameterName: "id",
        args: [{ value: "2026-06-20" }, { value: "2026-06-20" }],
      },
    ],
  });

  assert.equal(
    message,
    "error msg cannot transfer client as loan transaction present on or after transfer date"
  );
});
