import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryTestDb,stockFixture} from './helpers/inventory-db';
import {createStockReservationService} from '../inventory/stock-reservation-service';
import {withStockLeadEdit} from '../inventory/stock-lead-edit';
const skip=!process.env.INVENTORY_TEST_DATABASE_URL;
test('stock terms edits replace holds atomically and reject pending payout changes',{skip},async()=>{
 const db=inventoryTestDb();
 try{
  const f=await stockFixture(db);
  await db.tenant.update({where:{id:f.tenant.id},data:{slug:'arda'}});
  await db.lead.update({where:{id:f.input.leadId},data:{stateMetadata:{loanTerms:{stockLoanSelection:f.input.selection}}}});
  await createStockReservationService(db).reserve(f.input);
  const user={id:'tester',tenantId:f.tenant.id};
  const change=async(quantity:string)=>{
   const data={stateMetadata:{loanTerms:{stockLoanSelection:{...f.input.selection,quantity}}}};
   return withStockLeadEdit(db,f.input.leadId,user,data,tx=>tx.lead.update({where:{id:f.input.leadId},data}));
  };
  await assert.rejects(change('6'),/Insufficient/);
  assert.equal((await db.inventoryBalance.findUniqueOrThrow({where:{id:f.balance.id}})).quantityReserved.toString(),'4');
  await change('3');
  assert.equal((await db.inventoryBalance.findUniqueOrThrow({where:{id:f.balance.id}})).quantityReserved.toString(),'3');
  await db.stockActionOperation.create({data:{tenantId:f.tenant.id,leadId:f.input.leadId,loanId:1,command:'disburse',operationKey:'pending',generation:2,status:'PREPARED',requestSnapshot:{}}});
  await assert.rejects(change('2'),/pending/);
 }finally{
  // The fixture's unique slug must not retain the production tenant name.
  await db.tenant.updateMany({where:{slug:'arda'},data:{slug:'test-complete-'+crypto.randomUUID()}});
  await db.$disconnect();
 }
});
