import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("buildLeadDataFromUssdApplication keeps the linked Fineract client metadata", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../ussd-lead-conversion.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.buildLeadDataFromUssdApplication, "function");

  const buildLeadDataFromUssdApplication = mod
    .buildLeadDataFromUssdApplication as (
    application: Record<string, unknown>,
    currentUserId: string,
    fineractClient?: Record<string, unknown> | null
  ) => Record<string, unknown>;

  const leadData = buildLeadDataFromUssdApplication(
    {
      tenantId: "tenant-1",
      loanApplicationUssdId: 177953,
      messageId: "ff944789-c313-4684-9813-a4f00316da09",
      referenceNumber: "LA8853963",
      userPhoneNumber: "260963003442",
      loanMatrixClientId: 58902,
      userFullName: "KUDZAI JUSTICE MACHEYO",
      userNationalId: "48147220J12",
      principalAmount: 200,
      loanTermMonths: 30,
      payoutMethod: "MOBILE_MONEY",
      bankName: null,
      bankAccountNumber: null,
      branchName: "Lusaka Branch",
    },
    "user-1",
    {
      id: 58902,
      accountNo: "00058902",
      externalId: "48147220J12",
      firstname: "KUDZAI",
      lastname: "MACHEYO",
      mobileNo: "260963003442",
      officeId: 12,
      officeName: "Lusaka Branch",
      active: true,
      clientType: { id: 7, name: "Yango Driver" },
      clientClassification: { id: 4, name: "Retail" },
    }
  );

  assert.equal(leadData.externalId, "48147220J12");
  assert.equal(leadData.fineractClientId, 58902);
  assert.equal(leadData.fineractAccountNo, "00058902");
  assert.equal(leadData.clientCreatedInFineract, true);
  assert.equal(leadData.firstname, "KUDZAI");
  assert.equal(leadData.lastname, "MACHEYO");
  assert.equal(leadData.officeId, 12);
  assert.equal(leadData.officeName, "Lusaka Branch");
  assert.equal(leadData.clientTypeId, 7);
  assert.equal(leadData.clientTypeName, "Yango Driver");
  assert.equal(leadData.clientClassificationId, 4);
  assert.equal(leadData.clientClassificationName, "Retail");
  assert.deepEqual(leadData.stateMetadata, {
    source: "USSD",
    applicationId: 177953,
    messageId: "ff944789-c313-4684-9813-a4f00316da09",
    referenceNumber: "LA8853963",
    payoutMethod: "MOBILE_MONEY",
    loanMatrixClientId: 58902,
    userNationalId: "48147220J12",
  });
});

test("resolveUssdLoanExternalId prefers the lead id over USSD-only identifiers", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../ussd-lead-conversion.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.resolveUssdLoanExternalId, "function");

  const resolveUssdLoanExternalId = mod.resolveUssdLoanExternalId as (
    input: Record<string, unknown>
  ) => string | null;

  assert.equal(
    resolveUssdLoanExternalId({
      leadId: "cmqv3vbhd0ahc9x01ymd84htr",
      applicationRecordId: "cmqv3uaex09oe8z01uowydyap",
      referenceNumber: "LA8853963",
      messageId: "ff944789-c313-4684-9813-a4f00316da09",
    }),
    "cmqv3vbhd0ahc9x01ymd84htr"
  );

  assert.equal(
    resolveUssdLoanExternalId({
      applicationRecordId: "cmqv3uaex09oe8z01uowydyap",
      referenceNumber: "LA8853963",
      messageId: "ff944789-c313-4684-9813-a4f00316da09",
    }),
    "cmqv3uaex09oe8z01uowydyap"
  );
});

test("USSD submit route keeps the lead-linked external id stable", () => {
  const source = readRepoFile("app/api/ussd-leads/[id]/submit/route.ts");

  assert.match(source, /resolveUssdLoanExternalId/);
  assert.doesNotMatch(source, /externalId:\s*String\(loanId\)/);
});

test("USSD lead and lead-details flows share the same Fineract base URL helper", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../fineract-base-url.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.getFineractBaseUrl, "function");

  const completeDetailsSource = readRepoFile(
    "app/api/leads/[id]/complete-details/route.ts"
  );
  const apiSource = readRepoFile("lib/api.ts");
  const serviceSource = readRepoFile("lib/fineract-api.ts");

  assert.match(completeDetailsSource, /getFineractBaseUrl/);
  assert.match(apiSource, /getFineractBaseUrl/);
  assert.match(serviceSource, /getFineractBaseUrl/);

  assert.doesNotMatch(completeDetailsSource, /mifos-be\.kenac\.co\.zw/);
  assert.doesNotMatch(serviceSource, /mifos-be\.kenac\.co\.zw/);
});

test("buildUssdLoanPayloadFromTemplate uses the live product template instead of hardcoded generic terms", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../ussd-lead-conversion.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.buildUssdLoanPayloadFromTemplate, "function");

  const buildUssdLoanPayloadFromTemplate = mod
    .buildUssdLoanPayloadFromTemplate as (
    application: Record<string, unknown>,
    template: Record<string, unknown>,
    options: Record<string, unknown>
  ) => Record<string, unknown>;

  const payload = buildUssdLoanPayloadFromTemplate(
    {
      loanMatrixClientId: 58902,
      loanMatrixLoanProductId: 12,
      principalAmount: 200,
    },
    {
      numberOfRepayments: 1,
      repaymentEvery: 30,
      repaymentFrequencyType: { id: 0 },
      loanTermFrequencyType: { id: 0 },
      interestRatePerPeriod: 401.5,
      interestRateFrequencyType: { id: 3 },
      interestType: { id: 0 },
      amortizationType: { id: 1 },
      interestCalculationPeriodType: { id: 0 },
      transactionProcessingStrategyCode: "creocore-strategy",
      allowPartialPeriodInterestCalculation: false,
      isEqualAmortization: false,
    },
    {
      externalId: "cmqv3vbhd0ahc9x01ymd84htr",
      dateStr: "2026-06-27",
    }
  );

  assert.equal(payload.clientId, 58902);
  assert.equal(payload.productId, 12);
  assert.equal(payload.principal, 200);
  assert.equal(payload.loanTermFrequency, 30);
  assert.equal(payload.loanTermFrequencyType, 0);
  assert.equal(payload.numberOfRepayments, 1);
  assert.equal(payload.repaymentEvery, 30);
  assert.equal(payload.repaymentFrequencyType, 0);
  assert.equal(payload.interestRatePerPeriod, 401.5);
  assert.equal(payload.interestRateFrequencyType, 3);
  assert.equal(payload.interestType, 0);
  assert.equal(payload.amortizationType, 1);
  assert.equal(payload.interestCalculationPeriodType, 0);
  assert.equal(payload.transactionProcessingStrategyCode, "creocore-strategy");
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      payload,
      "allowPartialPeriodInterestCalculation"
    ),
    false
  );
  assert.equal(payload.externalId, "cmqv3vbhd0ahc9x01ymd84htr");
  assert.equal(payload.submittedOnDate, "2026-06-27");
  assert.equal(payload.expectedDisbursementDate, "2026-06-27");
});

test("USSD to-lead route assigns the tenant initial pipeline stage", () => {
  const source = readRepoFile("app/api/ussd-leads/[id]/to-lead/route.ts");

  assert.match(source, /pipelineStage\.findFirst/);
  assert.match(source, /isInitialState:\s*true/);
  assert.match(source, /currentStageId:/);
});
