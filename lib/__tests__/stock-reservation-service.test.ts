import test from "node:test";
import assert from "node:assert/strict";
import { inventoryTestDb, stockFixture } from "./helpers/inventory-db";
import { createStockReservationService } from "../inventory/stock-reservation-service";
test(
  "reservation replay replacement release and resubmission preserve quantities",
  { skip: !process.env.INVENTORY_TEST_DATABASE_URL },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      const s = createStockReservationService(db);
      const first = await s.reserve(f.input);
      assert.equal(first.generation, 1);
      assert.equal((await s.reserve(f.input)).changed, false);
      await assert.rejects(
        s.reserve({
          ...f.input,
          selection: { ...f.input.selection, quantity: "6" },
        }),
        /stock|available/i,
      );
      assert.equal(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { id: f.balance.id },
          })
        ).quantityReserved.toString(),
        "4",
      );
      await s.release({ ...f.input, reason: "Rejected" });
      await s.release({ ...f.input, reason: "Retry" });
      assert.equal(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { id: f.balance.id },
          })
        ).quantityReserved.toString(),
        "0",
      );
      assert.equal((await s.reserve(f.input)).generation, 2);
      await db.inventoryItem.update({
        where: { id: f.item.id },
        data: { isActive: false },
      });
      await assert.rejects(s.reserve(f.input), /active|available/i);
    } finally {
      await db.$disconnect();
    }
  },
);
