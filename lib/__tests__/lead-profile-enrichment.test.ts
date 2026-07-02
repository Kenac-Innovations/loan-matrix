import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("deriveLeadProfileUpdates fills missing employment and income details from fallbacks", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-profile-enrichment.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.deriveLeadProfileUpdates, "function");

  const deriveLeadProfileUpdates = mod.deriveLeadProfileUpdates as (
    lead: Record<string, unknown>,
    fallbacks: Record<string, unknown>
  ) => { mergedLead: Record<string, unknown>; updateData: Record<string, unknown> };

  const result = deriveLeadProfileUpdates(
    {
      id: "lead-1",
      stateMetadata: { source: "USSD" },
      employmentStatus: null,
      employerName: null,
      monthlyIncome: 0,
      grossMonthlyIncome: null,
      monthlyIncomeRange: null,
      annualIncome: null,
    },
    {
      employmentProfile: {
        employmentStatus: "FULL_TIME",
        employerName: "Yango Zambia",
        occupation: "Driver",
        industry: "Transport",
      },
      priorLead: {
        monthlyIncome: 5200,
        grossMonthlyIncome: 6100,
        monthlyIncomeRange: "5000-7000",
        annualIncome: 62400,
      },
    }
  );

  assert.equal(result.updateData.employmentStatus, "FULL_TIME");
  assert.equal(result.updateData.employerName, "Yango Zambia");
  assert.equal(result.updateData.monthlyIncome, 5200);
  assert.equal(result.updateData.grossMonthlyIncome, 6100);
  assert.equal(result.updateData.monthlyIncomeRange, "5000-7000");
  assert.equal(result.updateData.annualIncome, 62400);
  assert.deepEqual(result.updateData.stateMetadata, {
    source: "USSD",
    occupation: "Driver",
    industry: "Transport",
  });
});

test("deriveLeadProfileUpdates does not overwrite existing lead values", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-profile-enrichment.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.deriveLeadProfileUpdates, "function");

  const deriveLeadProfileUpdates = mod.deriveLeadProfileUpdates as (
    lead: Record<string, unknown>,
    fallbacks: Record<string, unknown>
  ) => { mergedLead: Record<string, unknown>; updateData: Record<string, unknown> };

  const result = deriveLeadProfileUpdates(
    {
      id: "lead-2",
      stateMetadata: { source: "USSD", occupation: "Existing Occupation" },
      employmentStatus: "SELF_EMPLOYED",
      employerName: "Existing Employer",
      monthlyIncome: 9000,
      grossMonthlyIncome: 12000,
      monthlyIncomeRange: "8000+",
      annualIncome: 108000,
    },
    {
      employmentProfile: {
        employmentStatus: "FULL_TIME",
        employerName: "Yango Zambia",
        occupation: "Driver",
        industry: "Transport",
      },
      priorLead: {
        monthlyIncome: 5200,
        grossMonthlyIncome: 6100,
        monthlyIncomeRange: "5000-7000",
        annualIncome: 62400,
      },
    }
  );

  assert.deepEqual(result.updateData, {
    stateMetadata: {
      source: "USSD",
      occupation: "Existing Occupation",
      industry: "Transport",
    },
  });
  assert.equal(result.mergedLead.employmentStatus, "SELF_EMPLOYED");
  assert.equal(result.mergedLead.monthlyIncome, 9000);
});
