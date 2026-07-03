import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("Yango USSD disbursement details use LA reference and mobile number", async () => {
  const mod = await import("../yango-ussd-disbursement.ts");

  const details = mod.resolveYangoUssdDisbursementDetails({
    lead: {
      loanProductId: 12,
      loanProductName: "Yango Driver Loan",
      mobileNo: "260963003442",
      stateMetadata: {
        source: "USSD",
        referenceNumber: "LA6319698",
        loanMatrixLoanProductId: 12,
      },
    },
    application: {
      loanApplicationUssdId: 178323,
      referenceNumber: "LA6319698",
      messageId: "msg-1",
      userPhoneNumber: "260963003442",
      loanMatrixLoanProductId: 12,
      loanProductName: "Yango Driver Loan",
      loanProductDisplayName: "Yango Driver Loan",
      payoutMethod: "MOBILE_MONEY",
      mobileMoneyNumber: "260963003442",
      mobileMoneyProvider: "MTN",
    },
    paymentTypeId: 4,
  });

  assert.deepEqual(details, {
    externalId: "LA6319698",
    accountNumber: "260963003442",
    paymentTypeId: 4,
  });
});

test("non-Yango USSD disbursement details are ignored", async () => {
  const mod = await import("../yango-ussd-disbursement.ts");

  const details = mod.resolveYangoUssdDisbursementDetails({
    lead: {
      loanProductId: 5,
      loanProductName: "Nano Loan New",
      mobileNo: "260963003442",
      stateMetadata: {
        source: "USSD",
        referenceNumber: "LA6319698",
        loanMatrixLoanProductId: 5,
      },
    },
  });

  assert.equal(details, null);
});

test("Fineract disbursement paths include Yango external id payload support", () => {
  const fineractApi = readRepoFile("lib/fineract-api.ts");
  const stateMachine = readRepoFile("lib/team-state-machine-service.ts");
  const disburseRoute = readRepoFile(
    "app/api/fineract/loans/[id]/disburse/route.ts"
  );

  assert.match(fineractApi, /paymentDetails\?\.externalId/);
  assert.match(fineractApi, /paymentDetails\?\.transactionAmount/);
  assert.match(stateMachine, /resolveYangoUssdDisbursementDetailsForLead/);
  assert.match(stateMachine, /externalId:\s*yangoUssdDetails\?\.externalId/);
  assert.match(stateMachine, /transactionAmount:\s*yangoUssdDetails\s*\?\s*transactionAmount/);
  assert.match(disburseRoute, /augmentedPayload\.externalId\s*=\s*yangoUssdDetails\.externalId/);
  assert.match(disburseRoute, /augmentedPayload\.accountNumber\s*=\s*yangoUssdDetails\.accountNumber/);
  assert.match(disburseRoute, /augmentedPayload\.transactionAmount/);
});
