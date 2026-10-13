import test from "node:test";
import assert from "node:assert/strict";
import { inventoryTestDb, stockFixture } from "./helpers/inventory-db";
import { createStockReservationService } from "../inventory/stock-reservation-service";
const enabled = Boolean(process.env.INVENTORY_TEST_DATABASE_URL);
test(
  "competing borrowers cannot reserve the same last units",
  { skip: !enabled },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      const service = createStockReservationService(db);
      const r = await Promise.allSettled([
        service.reserve(f.input),
        service.reserve({ ...f.input, leadId: f.leads[1].id }),
      ]);
      assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
      assert.match(
        String(
          (r.find((x) => x.status === "rejected") as PromiseRejectedResult)
            .reason,
        ),
        /available|stock/i,
      );
      assert.equal(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { id: f.balance.id },
          })
        ).quantityReserved.toString(),
        "4",
      );
    } finally {
      await db.$disconnect();
    }
  },
);
