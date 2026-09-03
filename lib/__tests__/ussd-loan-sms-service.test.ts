import assert from "node:assert/strict";
import test from "node:test";

async function getMessageBuilder() {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";
  const { buildUssdLoanApplicationSmsMessage } =
    await import("../ussd-loan-sms-service");

  return buildUssdLoanApplicationSmsMessage;
}

test("builds the Nano-style USSD submission acknowledgement", async () => {
  const buildUssdLoanApplicationSmsMessage = await getMessageBuilder();
  const message = buildUssdLoanApplicationSmsMessage({
    event: "submission",
    userFullName: "ELIAH NYIRENDA",
    principalAmount: 100,
    referenceNumber: "LA1606521",
  });

  assert.equal(
    message,
    "Dear ELIAH NYIRENDA, we have received your loan application of K100. Reference: LA1606521. Disbursement is in progress."
  );
});

test("builds a reference-bearing USSD rejection SMS", async () => {
  const buildUssdLoanApplicationSmsMessage = await getMessageBuilder();
  const message = buildUssdLoanApplicationSmsMessage({
    event: "rejection",
    userFullName: "ELIAH NYIRENDA",
    principalAmount: 100,
    referenceNumber: "LA1606521",
  });

  assert.equal(
    message,
    "Dear ELIAH NYIRENDA, we regret to inform you that your loan application of K100 has been rejected. Reference: LA1606521."
  );
});
