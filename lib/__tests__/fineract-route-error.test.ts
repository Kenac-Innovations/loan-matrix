import assert from "node:assert/strict";
import test from "node:test";

test("builds a shared route error payload with contextual fallback messaging", async () => {
  const { createFineractErrorResponsePayload } = await import(
    "../fineract-route-error"
  );

  const result = createFineractErrorResponsePayload(
    {
      status: 500,
      errorData: {
        timestamp: "2026-08-05T21:17:14.338Z",
        status: 500,
        error: "Internal Server Error",
        httpStatusCode: "500",
        defaultUserMessage: "Internal Server Error",
        developerMessage: "Internal Server Error",
        errors: [],
      },
    },
    {
      action: "update",
      resource: "address",
    }
  );

  assert.equal(result.status, 500);
  assert.equal(
    result.body.error,
    "We couldn't update the address. Please try again."
  );
  assert.equal(
    result.body.details?.defaultUserMessage,
    "We couldn't update the address. Please try again."
  );
});

test("preserves specific nested Fineract validation messages in shared route payloads", async () => {
  const { createFineractErrorResponsePayload } = await import(
    "../fineract-route-error"
  );

  const result = createFineractErrorResponsePayload(
    {
      status: 403,
      errorData: {
        developerMessage:
          "Request was understood but caused a domain rule violation.",
        httpStatusCode: "403",
        defaultUserMessage: "Errors contain reason for domain rule violation.",
        userMessageGlobalisationCode: "validation.msg.domain.rule.violation",
        errors: [
          {
            developerMessage: "Address line 1 must not exceed 100 characters.",
            defaultUserMessage: "Address line 1 must not exceed 100 characters.",
            userMessageGlobalisationCode: "validation.msg.address.line1.maxlength",
          },
        ],
      },
    },
    {
      action: "update",
      resource: "address",
    }
  );

  assert.equal(result.status, 403);
  assert.equal(
    result.body.error,
    "Address line 1 must not exceed 100 characters."
  );
  assert.equal(
    result.body.details?.errors?.[0]?.defaultUserMessage,
    "Address line 1 must not exceed 100 characters."
  );
});
