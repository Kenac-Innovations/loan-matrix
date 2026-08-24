import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("uses the ZMW 500 policy value for missing income", async () => {
  const { buildCDEPayload } = await import("../cde-utils.ts");

  const payload = buildCDEPayload({
    id: "lead-1",
    monthlyIncome: null,
    grossMonthlyIncome: 0,
  });

  assert.equal(payload.applicant.grossMonthlyIncome, 500);
  assert.equal(payload.applicant.netMonthlyIncome, 500);
});

test("preserves supplied income values", async () => {
  const { resolveCdeIncomeValues } = await import("../cde-utils.ts");

  assert.deepEqual(
    resolveCdeIncomeValues(
      {
        monthlyIncome: 3200,
        grossMonthlyIncome: 3600,
      },
      { grossMonthlyIncome: 4100 }
    ),
    { grossMonthlyIncome: 4100, netMonthlyIncome: 3200 }
  );
});

test("applies the fallback for any lead missing either income value", async () => {
  const { resolveCdeIncomeValues } = await import("../cde-utils.ts");

  assert.deepEqual(
    resolveCdeIncomeValues({
      monthlyIncome: 1200,
      grossMonthlyIncome: null,
    }),
    { grossMonthlyIncome: 500, netMonthlyIncome: 1200 }
  );

  assert.deepEqual(
    resolveCdeIncomeValues({
      monthlyIncome: null,
      grossMonthlyIncome: 1400,
    }),
    { grossMonthlyIncome: 1400, netMonthlyIncome: 500 }
  );
});
