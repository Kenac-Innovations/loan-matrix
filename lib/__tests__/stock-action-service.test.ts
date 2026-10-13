import test from "node:test";
import assert from "node:assert/strict";
import { inventoryTestDb, stockFixture } from "./helpers/inventory-db";
import {
  createStockActionService,
  StockActionPendingError,
} from "../inventory/stock-action-service";
import { createStockReservationService } from "../inventory/stock-reservation-service";
const skip = !process.env.INVENTORY_TEST_DATABASE_URL;
test(
  "shortages block external approval; other tenants retain their action",
  { skip },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      const service = createStockActionService(db);
      let calls = 0;
      const input = {
        tenant: {
          id: f.tenant.id,
          slug: "arda",
          settings: { features: { enforceStockAvailability: true } },
        },
        leadId: f.input.leadId,
        loanId: 1,
        command: "approve" as const,
        actorUserId: "tester",
        selection: { ...f.input.selection, quantity: "6" },
        payload: {},
        execute: async () => {
          calls++;
          return { resourceId: 1 };
        },
        reconcile: async () => null,
      };
      await assert.rejects(service.run(input), /stock|available/i);
      assert.equal(calls, 0);
      await service.run({
        ...input,
        tenant: { ...input.tenant, slug: "goodfellow" },
      });
      assert.equal(calls, 1);
    } finally {
      await db.$disconnect();
    }
  },
);
test(
  "concurrent disbursement and retries issue once; timeout preserves reservation",
  { skip },
  async () => {
    const db = inventoryTestDb();
    try {
      const f = await stockFixture(db);
      await createStockReservationService(db).reserve(f.input);
      const service = createStockActionService(db);
      let calls = 0;
      const input = {
        tenant: {
          id: f.tenant.id,
          slug: "arda",
          settings: { features: { enforceStockAvailability: true } },
        },
        leadId: f.input.leadId,
        loanId: 1,
        command: "disburse" as const,
        actorUserId: "tester",
        selection: f.input.selection,
        payload: {},
        execute: async () => {
          calls++;
          throw new Error("network timeout");
        },
        reconcile: async () => null,
      };
      await assert.rejects(service.run(input), StockActionPendingError);
      assert.equal(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { id: f.balance.id },
          })
        ).quantityReserved.toString(),
        "4",
      );
      await assert.rejects(service.run(input), StockActionPendingError);
      assert.equal(calls, 1);
      const recovered = {
        ...input,
        reconcile: async () => ({ resourceId: 1, transactionId: 9 }),
      };
      await service.run(recovered);
      await service.run(recovered);
      assert.equal(calls, 1);
      const balance = await db.inventoryBalance.findUniqueOrThrow({
        where: { id: f.balance.id },
      });
      assert.equal(balance.quantityOnHand.toString(), "1");
      assert.equal(balance.quantityReserved.toString(), "0");
      assert.equal(
        await db.inventoryMovement.count({
          where: { tenantId: f.tenant.id, type: "ISSUE" },
        }),
        1,
      );
    } finally {
      await db.$disconnect();
    }
  },
);
test('simultaneous duplicate requests execute the payout only once', { skip }, async () => {
  const db = inventoryTestDb();
  let release!: () => void;
  try {
    const f = await stockFixture(db);
    await createStockReservationService(db).reserve(f.input);
    const service = createStockActionService(db);
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    const input = {
      tenant: { id: f.tenant.id, slug: 'arda', settings: { features: { enforceStockAvailability: true } } },
      leadId: f.input.leadId, loanId: 1, command: 'disburse' as const,
      actorUserId: 'tester', selection: f.input.selection, payload: {},
      execute: async () => { calls++; entered(); await blocked; return { transactionId: 42 }; },
      reconcile: async () => null,
    };
    const first = service.run(input);
    await started;
    await assert.rejects(service.run(input), StockActionPendingError);
    release();
    await first;
    await service.run(input);
    assert.equal(calls, 1);
    assert.equal(await db.inventoryMovement.count({where: {tenantId: f.tenant.id, type: 'ISSUE'}}), 1);
  } finally { release?.(); await db.$disconnect(); }
});
test('late timeout cannot downgrade a concurrently reconciled payout', { skip }, async () => {
 const db = inventoryTestDb();
 let fail!: () => void;
 try {
  const f = await stockFixture(db);
  await createStockReservationService(db).reserve(f.input);
  const service = createStockActionService(db);
  let entered!: () => void;
  const started = new Promise<void>(resolve => {entered=resolve;});
  const blocked = new Promise<void>((_,reject) => {fail=()=>reject(new Error('late timeout'));});
  const input = {
   tenant:{id:f.tenant.id,slug:'arda',settings:{features:{enforceStockAvailability:true}}},
   leadId:f.input.leadId,loanId:1,command:'disburse' as const,actorUserId:'tester',selection:f.input.selection,payload:{},
   execute:async()=>{entered();await blocked;return {transactionId:42};},reconcile:async()=>({transactionId:42})
  };
  const first = service.run(input).then(value=>({value}),error=>({error}));
  await started;
  await service.run(input);
  fail();
  const outcome=await first;
  assert.ok('value' in outcome);
  assert.equal((await db.stockActionOperation.findFirstOrThrow({where:{tenantId:f.tenant.id}})).status,'FINALIZED');
  assert.equal(await db.inventoryMovement.count({where:{tenantId:f.tenant.id,type:'ISSUE'}}),1);
 }finally{fail?.();await db.$disconnect();}
});
test('preparation rejects a stale stock selection after terms changed', {skip},async()=>{
 const db=inventoryTestDb();
 try{
  const f=await stockFixture(db);
  await db.lead.update({where:{id:f.input.leadId},data:{stateMetadata:{loanTerms:{stockLoanSelection:{...f.input.selection,quantity:'2'}}}}});
  let calls=0;
  await assert.rejects(createStockActionService(db).run({tenant:{id:f.tenant.id,slug:'arda',settings:{features:{enforceStockAvailability:true}}},leadId:f.input.leadId,loanId:1,command:'approve',actorUserId:'tester',selection:f.input.selection,payload:{},execute:async()=>{calls++;return {};},reconcile:async()=>null}),/changed/);
  assert.equal(calls,0);
 }finally{await db.$disconnect();}
});
