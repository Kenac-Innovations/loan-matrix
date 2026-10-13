import test from "node:test";
import assert from "node:assert/strict";
import { inventoryTestDb, stockFixture } from "./helpers/inventory-db";
import { parseInventoryReportFilters } from "../inventory/inventory-report-types";
import { getInventoryReport } from "../inventory/inventory-report-service";
test("report input rejects invalid dates, reversed ranges and unbounded pages", () => {
  for (const p of [
    { startDate: "2026-02-30" },
    { startDate: "2026-10-12", endDate: "2026-10-01" },
    { pageSize: "201" },
    { currencyCode: "USD; DROP" },
  ])
    assert.throws(() =>
      parseInventoryReportFilters(
        new URLSearchParams(Object.entries(p).filter((entry): entry is [string,string] => typeof entry[1] === "string")),
      ),
    );
});
test(
  "availability and reservations remain scoped by tenant and office",
  { skip: !process.env.INVENTORY_TEST_DATABASE_URL },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      const other = await stockFixture(db);
      await db.inventoryBalance.update({
        where: { id: f.balance.id },
        data: { quantityOnHand: "10", quantityReserved: "3" },
      });
      const access = {
        tenantId: f.tenant.id,
        tenantSlug: "arda",
        actorUserId: "tester",
        allowedOfficeIds: [1],
      };
      const filters = parseInventoryReportFilters(
        new URLSearchParams({ kind: "availability", currencyCode: "USD" }),
      );
      const result = await getInventoryReport(db, access, filters);
      assert.equal(result.totalRows, 1);
      assert.equal(result.rows[0]["Available"], "7.000");
      assert.equal(result.positionBasis, "current");
      assert.equal(
        (
          await getInventoryReport(db, access, {
            ...filters,
            itemId: other.item.id,
          })
        ).totalRows,
        0,
      );
      await assert.rejects(
        getInventoryReport(db, access, { ...filters, officeId: 2 }),
        /office/i,
      );
      assert.equal(
        (
          await getInventoryReport(
            db,
            { ...access, allowedOfficeIds: [] },
            filters,
          )
        ).totalRows,
        0,
      );
    } finally {
      await db.$disconnect();
    }
  },
);
test(
  "performance counts issued loans and quantities, not reservations",
  { skip: !process.env.INVENTORY_TEST_DATABASE_URL },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      const issue = await db.stockLoanIssue.create({
        data: {
          tenantId: f.tenant.id,
          leadId: f.input.leadId,
          reference: "sale",
          status: "ISSUED",
          fineractOfficeId: 1,
          totalValue: 20,
          currencyCode: "USD",
        },
      });
      for (const [index, type, quantityDelta, valueDelta] of [
        [1, "RESERVATION", "2", "0"],
        [2, "ISSUE", "-2", "-20"],
        [3, "RETURN", "1", "10"],
      ] as const)
        await db.inventoryMovement.create({
          data: {
            tenantId: f.tenant.id,
            inventoryItemId: f.item.id,
            stockLoanIssueId: issue.id,
            fineractOfficeId: 1,
            currencyCode: "USD",
            type,
            quantityDelta,
            valueDelta,
            idempotencyKey: "perf-" + index,
            actorUserId: "tester",
            createdAt: new Date("2026-10-13T23:59:59Z"),
          },
        });
      const a = {
        tenantId: f.tenant.id,
        tenantSlug: "arda",
        actorUserId: "tester",
        allowedOfficeIds: [1],
      };
      const filters = parseInventoryReportFilters(
        new URLSearchParams({
          kind: "performance",
          startDate: "2026-10-13",
          endDate: "2026-10-13",
        }),
      );
      const r = await getInventoryReport(db, a, filters);
      assert.equal(r.totalRows, 1);
      assert.equal(r.rows[0]["Disbursements"], "1");
      assert.equal(r.rows[0]["Issued Quantity"], "2.000");
      assert.equal(r.rows[0]["Net Quantity"], "1.000");
      assert.equal(
        (
          await getInventoryReport(db, a, {
            ...filters,
            endDate: "2026-10-12",
            startDate: "2026-10-12",
          })
        ).totalRows,
        0,
      );
    } finally {
      await db.$disconnect();
    }
  },
);
test(
  "all report queries execute for empty and inconsistent stock records",
  { skip: !process.env.INVENTORY_TEST_DATABASE_URL },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      const a = {
        tenantId: f.tenant.id,
        tenantSlug: "arda",
        actorUserId: "tester",
        allowedOfficeIds: [1],
      };
      for (const kind of ["reservations", "movements", "exceptions"]) {
        const r = await getInventoryReport(
          db,
          a,
          parseInventoryReportFilters(new URLSearchParams({ kind })),
        );
        assert.equal(r.totalRows, kind === "exceptions" ? 1 : 0);
        if (kind === "exceptions")
          assert.match(String(r.rows[0]["Details"]), /On hand: 5/);
      }
    } finally {
      await db.$disconnect();
    }
  },
);
test('pending stock actions remain visible before a reservation exists', { skip: !process.env.INVENTORY_TEST_DATABASE_URL }, async () => {
 const db = inventoryTestDb();
 try {
  const f = await stockFixture(db);
  const op = await db.stockActionOperation.create({data: {
   tenantId: f.tenant.id, leadId: f.input.leadId, loanId: 1,
   command: 'update', operationKey: crypto.randomUUID(), generation: 0,
   status: 'UNCERTAIN', requestSnapshot: {selection: f.input.selection, payload: {}}
  }});
  const a = {tenantId:f.tenant.id, tenantSlug:'arda', actorUserId:'tester', allowedOfficeIds:[1]};
  const filters = parseInventoryReportFilters(new URLSearchParams({kind:'exceptions'}));
  const r = await getInventoryReport(db,a,filters);
  assert.ok(r.rows.some(row => row.Reference === op.id));
  const denied = await getInventoryReport(db,{...a,allowedOfficeIds:[]},filters);
  assert.equal(denied.totalRows,0);
 } finally { await db.$disconnect(); }
});
