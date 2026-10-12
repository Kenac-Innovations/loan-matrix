import assert from "node:assert/strict";
import {
  buildSessionReconciliationReport,
  toCsv,
  type ReportSessionInput,
  type OpenVarianceInput,
} from "./cash-session-reconciliation-report";

function run() {
  // Test: Overdue detection (ACTIVE/PENDING_CLOSURE with businessDate < today)
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date("2026-10-07T08:00:00Z"),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-06",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    assert.equal(result.rows[0].isOverdueUnclosed, true, "ACTIVE with past businessDate should be overdue");
  }

  // Test: isClosed detection (CLOSED and CLOSED_VERIFIED)
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: 1300,
        managerCountedAmount: null,
        declaredAmount: 1300,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: "user1",
        closureInitiatedAt: new Date(),
        closedBy: "user2",
        closedAt: new Date(),
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        id: "s2",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED_VERIFIED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: 1300,
        managerCountedAmount: null,
        declaredAmount: 1300,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: "user1",
        closureInitiatedAt: new Date(),
        closedBy: "user2",
        closedAt: new Date(),
        verifiedBy: "user3",
        verifiedAt: new Date(),
      },
      {
        id: "s3",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date(),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    assert.equal(result.rows[0].isClosed, true);
    assert.equal(result.rows[0].closedState, "CLOSED");
    assert.equal(result.rows[1].isClosed, true);
    assert.equal(result.rows[1].closedState, "CLOSED_VERIFIED");
  }

  // Test: Grouping by branch (including currency separation)
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: 1300,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
        variance: {
          type: "SHORTAGE",
          amount: 50,
          currency: "ZMW",
          status: "RESOLVED",
          resolutionType: "WRITTEN_OFF",
        },
      },
      {
        id: "s2",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date(),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-08",
        currency: "USD",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    assert.equal(result.byBranch.length, 2, "Should have 2 branch groups (separate by currency)");
    const zmwGroup = result.byBranch.find((g) => g.currency === "ZMW");
    assert.ok(zmwGroup, "Should have ZMW group");
    assert.equal(zmwGroup.sessions, 1);
    assert.equal(zmwGroup.closed, 1);
    assert.equal(zmwGroup.shortageTotal, 50);
  }

  // Test: Ageing bucket boundaries
  {
    const openVariances: OpenVarianceInput[] = [
      {
        id: "v1",
        businessDate: "2026-10-08",
        type: "SHORTAGE",
        amount: 100,
        currency: "ZMW",
        officeId: 1,
        officeName: "Branch 1",
        cashierName: "Cashier A",
        status: "OPEN",
      },
      {
        id: "v2",
        businessDate: "2026-10-01",
        type: "SHORTAGE",
        amount: 50,
        currency: "ZMW",
        officeId: 1,
        officeName: "Branch 1",
        cashierName: "Cashier A",
        status: "OPEN",
      },
      {
        id: "v3",
        businessDate: "2026-09-30",
        type: "SHORTAGE",
        amount: 25,
        currency: "ZMW",
        officeId: 1,
        officeName: "Branch 1",
        cashierName: "Cashier A",
        status: "OPEN",
      },
      {
        id: "v4",
        businessDate: "2026-09-07",
        type: "SHORTAGE",
        amount: 10,
        currency: "ZMW",
        officeId: 1,
        officeName: "Branch 1",
        cashierName: "Cashier A",
        status: "OPEN",
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions: [],
      openVariances,
      today: "2026-10-08",
    });

    const buckets = result.ageing.reduce(
      (acc, b) => {
        acc[b.bucket] = b.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Day 0 = 0-7
    // Day 7 = 0-7
    // Day 8 = 8-30
    // Day 31 = 31+
    assert.equal(buckets["0-7"], 2, "0-7 bucket should have 2 variances (0 and 7 days)");
    assert.equal(buckets["8-30"], 1, "8-30 bucket should have 1 variance (8 days)");
    assert.equal(buckets["31+"], 1, "31+ bucket should have 1 variance (31 days)");
  }

  // Test: Multi-currency separation in groups
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: 1300,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        id: "s2",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 500,
        allocatedBalance: 500,
        cashIn: 200,
        cashOut: 100,
        netCash: 100,
        expectedBalance: 600,
        countedCashAmount: 600,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "USD",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    assert.equal(result.totals.length, 2, "Should have 2 total groups (by currency)");
    const zmwTotal = result.totals.find((t) => t.currency === "ZMW");
    const usdTotal = result.totals.find((t) => t.currency === "USD");
    assert.ok(zmwTotal, "Should have ZMW total");
    assert.ok(usdTotal, "Should have USD total");
    assert.equal(zmwTotal.sessions, 1);
    assert.equal(usdTotal.sessions, 1);
  }

  // Test: Rounding to 2 decimal places
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000.456,
        allocatedBalance: 1000.456,
        cashIn: 500.789,
        cashOut: 200.123,
        netCash: 300.666,
        expectedBalance: 1300.999,
        countedCashAmount: 1300.999,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    assert.equal(result.rows[0].openingFloat, 1000.46);
    assert.equal(result.rows[0].cashIn, 500.79);
    assert.equal(result.rows[0].cashOut, 200.12);
    assert.equal(result.rows[0].expectedBalance, 1301);
  }

  // Test: CSV escaping - comma and quotes
  {
    const rows = [
      {
        sessionId: 's1',
        businessDate: '2026-10-08',
        officeId: 1,
        officeName: 'Branch, One',
        tellerId: 't1',
        tellerName: 'Teller "A"',
        cashierId: 'c1',
        cashierName: 'Cashier A',
        status: 'CLOSED',
        isClosed: true,
        closedState: "CLOSED" as const,
        isOverdueUnclosed: false,
        currency: 'ZMW',
        openingFloat: 1000,
        cashIn: 500,
        cashOut: 200,
        expectedBalance: 1300,
        declaredAmount: null,
        countedAmount: 1300,
        difference: 0,
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        variance: null,
      },
    ];

    const csv = toCsv(rows);
    assert.ok(csv.includes('"Branch, One"'), "Field with comma should be quoted");
    assert.ok(csv.includes('"Teller ""A"""'), "Field with quotes should be escaped");
  }

  // Test: CSV formula injection prevention
  {
    const rows = [
      {
        sessionId: '=1+1',
        businessDate: '2026-10-08',
        officeId: 1,
        officeName: '+formula',
        tellerId: 't1',
        tellerName: '-formula',
        cashierId: 'c1',
        cashierName: '@formula',
        status: 'CLOSED',
        isClosed: true,
        closedState: "CLOSED" as const,
        isOverdueUnclosed: false,
        currency: 'ZMW',
        openingFloat: 1000,
        cashIn: 500,
        cashOut: 200,
        expectedBalance: 1300,
        declaredAmount: null,
        countedAmount: 1300,
        difference: 0,
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        variance: null,
      },
    ];

    const csv = toCsv(rows);
    const lines = csv.split("\n");
    const dataLine = lines[1];
    assert.ok(dataLine.includes("'=1+1"), "Should prefix = with single quote");
    assert.ok(dataLine.includes("'+formula"), "Should prefix + with single quote");
    assert.ok(dataLine.includes("'-formula"), "Should prefix - with single quote");
    assert.ok(dataLine.includes("'@formula"), "Should prefix @ with single quote");
  }

  // Test: CSV negative numbers should not be neutralized
  {
    const rows = [
      {
        sessionId: 's1',
        businessDate: '2026-10-08',
        officeId: 1,
        officeName: 'Branch',
        tellerId: 't1',
        tellerName: 'Teller A',
        cashierId: 'c1',
        cashierName: 'Cashier A',
        status: 'CLOSED',
        isClosed: true,
        closedState: "CLOSED" as const,
        isOverdueUnclosed: false,
        currency: 'ZMW',
        openingFloat: -1000,
        cashIn: 500,
        cashOut: -200,
        expectedBalance: 1300,
        declaredAmount: null,
        countedAmount: 1300,
        difference: -50,
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        variance: null,
      },
    ];

    const csv = toCsv(rows);
    const lines = csv.split("\n");
    const dataLine = lines[1];
    // Negative numbers should not be quoted or prefixed
    assert.ok(dataLine.includes("-1000"), "Negative number should not be prefixed");
    assert.ok(dataLine.includes("-200"), "Negative number should not be prefixed");
    assert.ok(dataLine.includes("-50"), "Negative number should not be prefixed");
    // Verify they are NOT quoted
    assert.ok(!dataLine.includes('"-'), "Negative numbers should not be quoted");
  }

  // Test: CSV string with carriage return should be quoted
  {
    const rows = [
      {
        sessionId: 's1',
        businessDate: '2026-10-08',
        officeId: 1,
        officeName: 'Branch\rWith\rCR',
        tellerId: 't1',
        tellerName: 'Teller A',
        cashierId: 'c1',
        cashierName: 'Cashier A',
        status: 'CLOSED',
        isClosed: true,
        closedState: "CLOSED" as const,
        isOverdueUnclosed: false,
        currency: 'ZMW',
        openingFloat: 1000,
        cashIn: 500,
        cashOut: 200,
        expectedBalance: 1300,
        declaredAmount: null,
        countedAmount: 1300,
        difference: 0,
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        variance: null,
      },
    ];

    const csv = toCsv(rows);
    assert.ok(csv.includes('"Branch\rWith\rCR"'), "Field with carriage return should be quoted");
  }

  // Test: ACTIVE row with null closedState
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date("2026-10-08T08:00:00Z"),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    assert.equal(result.rows[0].isClosed, false, "ACTIVE should have isClosed = false");
    assert.equal(result.rows[0].closedState, null, "ACTIVE should have closedState = null");
  }

  // Test: Sorting rows by businessDate desc, officeName, tellerName, cashierName
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "t2",
        tellerName: "Teller B",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date(),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-07",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        id: "s2",
        tenantId: "t1",
        tellerId: "t1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date(),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        id: "s3",
        tenantId: "t1",
        tellerId: "t1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c2",
        cashierName: "Cashier B",
        sessionStatus: "ACTIVE",
        sessionStartTime: new Date(),
        sessionEndTime: null,
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: null,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: null,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    // s2 and s3 have 2026-10-08; s2 has Teller A (earlier), s3 has Cashier B (later)
    // s1 has 2026-10-07 (earlier)
    // Order: s2, s3, s1
    assert.equal(result.rows[0].sessionId, "s2");
    assert.equal(result.rows[1].sessionId, "s3");
    assert.equal(result.rows[2].sessionId, "s1");
  }

  // Test: Variance with status OPEN/UNDER_REVIEW contributes to openVarianceTotal
  {
    const sessions: ReportSessionInput[] = [
      {
        id: "s1",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: 1300,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
        variance: {
          type: "SHORTAGE",
          amount: 100,
          currency: "ZMW",
          status: "OPEN",
          resolutionType: null,
        },
      },
      {
        id: "s2",
        tenantId: "t1",
        tellerId: "teller1",
        tellerName: "Teller A",
        officeId: 1,
        officeName: "Branch 1",
        cashierId: "c1",
        cashierName: "Cashier A",
        sessionStatus: "CLOSED",
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        openingFloat: 1000,
        allocatedBalance: 1000,
        cashIn: 500,
        cashOut: 200,
        netCash: 300,
        expectedBalance: 1300,
        countedCashAmount: 1300,
        managerCountedAmount: null,
        declaredAmount: null,
        difference: 0,
        businessDate: "2026-10-08",
        currency: "ZMW",
        closureInitiatedBy: null,
        closureInitiatedAt: null,
        closedBy: null,
        closedAt: null,
        verifiedBy: null,
        verifiedAt: null,
        variance: {
          type: "SHORTAGE",
          amount: 50,
          currency: "ZMW",
          status: "RESOLVED",
          resolutionType: "WRITTEN_OFF",
        },
      },
    ];

    const result = buildSessionReconciliationReport({
      sessions,
      openVariances: [],
      today: "2026-10-08",
    });

    const total = result.totals[0];
    assert.equal(total.shortageTotal, 150, "Total should include both variances");
    assert.equal(total.openVarianceTotal, 100, "Only OPEN variance should be in openVarianceTotal");
  }

  console.log("All tests passed!");
}

run();
