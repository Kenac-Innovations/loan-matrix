import test from 'node:test';import assert from 'node:assert/strict';
import { inventoryTestDb, stockFixture } from './helpers/inventory-db';
import { createStockActionService, StockActionPendingError } from '../inventory/stock-action-service';
import { createStockReservationService } from '../inventory/stock-reservation-service';
const skip=!process.env.INVENTORY_TEST_DATABASE_URL;
test('shortages block external approval; other tenants retain their action',{skip},async()=>{
 const db=inventoryTestDb();try{const f=await stockFixture(db);const service=createStockActionService(db);let calls=0;
 const input={tenant:{id:f.tenant.id,slug:'arda',settings:{features:{enforceStockAvailability:true}}},leadId:f.input.leadId,loanId:1,command:'approve' as const,actorUserId:'tester',selection:{...f.input.selection,quantity:'6'},payload:{},execute:async()=>{calls++;return {resourceId:1}},reconcile:async()=>null};
 await assert.rejects(service.run(input),/stock|available/i);assert.equal(calls,0);
 await service.run({...input,tenant:{...input.tenant,slug:'goodfellow'}});assert.equal(calls,1);
 }finally{await db.$disconnect()}
});
test('concurrent disbursement and retries issue once; timeout preserves reservation',{skip},async()=>{
 const db=inventoryTestDb();try{const f=await stockFixture(db);await createStockReservationService(db).reserve(f.input);
 const service=createStockActionService(db);let calls=0;
 const input={tenant:{id:f.tenant.id,slug:'arda',settings:{features:{enforceStockAvailability:true}}},leadId:f.input.leadId,loanId:1,command:'disburse' as const,actorUserId:'tester',selection:f.input.selection,payload:{},execute:async()=>{calls++;throw new Error('network timeout')},reconcile:async()=>null};
 await assert.rejects(service.run(input),StockActionPendingError);
 assert.equal((await db.inventoryBalance.findUniqueOrThrow({where:{id:f.balance.id}})).quantityReserved.toString(),'4');
 await assert.rejects(service.run(input),StockActionPendingError);assert.equal(calls,1);
 const recovered={...input,reconcile:async()=>({resourceId:1,transactionId:9})};
 await service.run(recovered);await service.run(recovered);
 assert.equal(calls,1);
 const balance=await db.inventoryBalance.findUniqueOrThrow({where:{id:f.balance.id}});
 assert.equal(balance.quantityOnHand.toString(),'1');assert.equal(balance.quantityReserved.toString(),'0');
 assert.equal(await db.inventoryMovement.count({where:{tenantId:f.tenant.id,type:'ISSUE'}}),1);
 }finally{await db.$disconnect()}
});
