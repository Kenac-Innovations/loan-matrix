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

test("masks technical document storage failures with a safe upload message", async () => {
  const { parseFineractErrorResponse } = await import("../fineract-error");

  const message = parseFineractErrorResponse({
    developerMessage: "Request was understood but caused a domain rule violation.",
    httpStatusCode: "403",
    defaultUserMessage: "Errors contain reason for domain rule violation.",
    userMessageGlobalisationCode: "validation.msg.domain.rule.violation",
    errors: [
      {
        developerMessage:
          "Error while manipulating file payslip.pdf due to a ContentRepository issue Storage backend has reached its minimum free drive threshold.",
        defaultUserMessage:
          "Error while manipulating file payslip.pdf due to a ContentRepository issue Storage backend has reached its minimum free drive threshold.",
        userMessageGlobalisationCode: "error.msg.document.save",
      },
    ],
  });

  assert.equal(
    message,
    "Document upload is temporarily unavailable. Please try again later or contact support."
  );
});

test("maps datatable not-found responses to a user-friendly empty-data message", async () => {
  const { parseFineractErrorResponse } = await import("../fineract-error");

  const message = parseFineractErrorResponse({
    developerMessage: "The requested resource is not available.",
    httpStatusCode: "404",
    defaultUserMessage: "The requested resource is not available.",
    userMessageGlobalisationCode: "error.msg.resource.not.found",
    errors: [
      {
        developerMessage: "Data not found for datatable: ",
        defaultUserMessage: "Data not found for datatable: ",
        userMessageGlobalisationCode: "error.msg.datatable.data.not.found",
      },
    ],
  });

  assert.equal(message, "No information is available for this section yet.");
});
