import assert from "node:assert/strict";
import {
  baselineAfterClose,
  buildSessionContextFields,
  computeSessionBalance,
  isBalanceReliableForVariance,
  toCashierSummarySnapshot,
  type FineractCashierSummarySnapshot,
} from "./cashier-session-balance";

const d = (iso: string) => new Date(iso);

function snap(overrides: Partial<FineractCashierSummarySnapshot> = {}): FineractCashierSummarySnapshot {
  return {
    sumCashAllocation: 0,
    sumInwardCash: 0,
    sumOutwardCash: 0,
    sumCashSettlement: 0,
    netCash: 0,
    currency: "ZMK",
    capturedAt: "2026-10-07T06:00:00.000Z",
    ...overrides,
  };
}

function run() {
  // Coercion: Fineract may send numeric strings; missing sums become 0.
  assert.deepEqual(
    toCashierSummarySnapshot(
      { sumCashAllocation: "1000.50", sumInwardCash: "200", sumOutwardCash: null, netCash: "1200.5" },
      "ZMK",
      d("2026-10-07T06:00:00Z")
    ),
    snap({ sumCashAllocation: 1000.5, sumInwardCash: 200, netCash: 1200.5 })
  );

  // No netCash (e.g. queried with the wrong currency code) is not a usable summary.
  assert.equal(toCashierSummarySnapshot({ sumCashAllocation: 5 }, "ZMK", d("2026-10-07T06:00:00Z")), null);
  assert.equal(toCashierSummarySnapshot(null, "ZMK", d("2026-10-07T06:00:00Z")), null);

  // Fineract unavailable: fall back to the local float, flagged UNAVAILABLE.
  const unavailable = computeSessionBalance({
    baselineNetCash: 5000,
    opening: snap({ netCash: 6000 }),
    current: null,
    fallbackOpeningFloat: 1000,
  });
  assert.equal(unavailable.source, "UNAVAILABLE");
  assert.equal(unavailable.expectedBalance, 1000);
  assert.equal(isBalanceReliableForVariance(unavailable), false);

  // Baseline: yesterday's close left netCash 5000 in Fineract although the drawer was emptied.
  // Today 1000 allocated (6000 at start), 600 paid out, 250 received -> drawer should hold 650.
  const opening = snap({ sumCashAllocation: 9000, sumInwardCash: 3000, sumOutwardCash: 7000, netCash: 6000 });
  const current = snap({ sumCashAllocation: 9000, sumInwardCash: 3250, sumOutwardCash: 7600, netCash: 5650 });
  const withBaseline = computeSessionBalance({
    baselineNetCash: 5000,
    opening,
    current,
    fallbackOpeningFloat: 999,
  });
  assert.deepEqual(withBaseline, {
    openingFloat: 1000,
    allocations: 0,
    cashIn: 250,
    cashOut: 600,
    settlements: 0,
    netCash: -350,
    expectedBalance: 650,
    source: "FINERACT_BASELINE",
  });
  assert.equal(isBalanceReliableForVariance(withBaseline), true);

  // Mid-session allocation is part of expected and shows in the breakdown.
  const topUp = computeSessionBalance({
    baselineNetCash: 5000,
    opening,
    current: snap({ ...current, sumCashAllocation: 9500, netCash: 6150 }),
    fallbackOpeningFloat: 0,
  });
  assert.equal(topUp.allocations, 500);
  assert.equal(topUp.expectedBalance, 1150);

  // Baseline without opening snapshot: expected still correct, no breakdown.
  const noOpening = computeSessionBalance({
    baselineNetCash: 5000,
    opening: null,
    current,
    fallbackOpeningFloat: 1000,
  });
  assert.equal(noOpening.source, "FINERACT_BASELINE");
  assert.equal(noOpening.expectedBalance, 650);
  assert.equal(noOpening.openingFloat, 1000);
  assert.equal(noOpening.cashOut, 0);

  // Opening snapshot in another currency is ignored for the breakdown.
  const mismatch = computeSessionBalance({
    baselineNetCash: 5000,
    opening: snap({ ...opening, currency: "USD" }),
    current,
    fallbackOpeningFloat: 1000,
  });
  assert.equal(mismatch.cashOut, 0);
  assert.equal(mismatch.expectedBalance, 650);

  // No baseline yet (first close after rollout): absolute netCash, not reliable for variances.
  const noBaseline = computeSessionBalance({
    baselineNetCash: null,
    opening,
    current,
    fallbackOpeningFloat: 1000,
  });
  assert.equal(noBaseline.source, "NO_BASELINE");
  assert.equal(noBaseline.expectedBalance, 5650);
  assert.equal(noBaseline.cashOut, 600);
  assert.equal(isBalanceReliableForVariance(noBaseline), false);

  // Rounding to 2 dp.
  const rounded = computeSessionBalance({
    baselineNetCash: 0.1,
    opening: null,
    current: snap({ netCash: 0.3 }),
    fallbackOpeningFloat: 0,
  });
  assert.equal(rounded.expectedBalance, 0.2);

  // Baseline after close: closing netCash minus anything settled to Fineract.
  assert.equal(baselineAfterClose(snap({ netCash: 5650 })), 5650);
  assert.equal(baselineAfterClose(snap({ netCash: 5650 }), 600), 5050);

  // Context fields: business date is the Harare calendar day.
  assert.deepEqual(
    buildSessionContextFields({ teller: { officeId: 7 }, now: d("2026-10-06T22:30:00Z"), currency: "ZMK" }),
    { businessDate: d("2026-10-07T00:00:00.000Z"), officeId: 7, currency: "ZMK" }
  );
}

run();
