import { PrismaClient } from '../../../app/generated/prisma';
export function inventoryTestDb() {
 const url=process.env.INVENTORY_TEST_DATABASE_URL;
 if(!url) throw new Error('INVENTORY_TEST_DATABASE_URL is required for integration tests');
 const parsed=new URL(url);
 if(!['127.0.0.1','localhost'].includes(parsed.hostname)||!parsed.pathname.endsWith('_test')) throw new Error('Integration tests require a local disposable *_test database');
 return new PrismaClient({datasources:{db:{url}}});
}
export async function stockFixture(db: PrismaClient) {
 const id=crypto.randomUUID();
 const tenant=await db.tenant.create({data:{name:'Inventory test',slug:'test-'+id,settings:{features:{enforceStockAvailability:true}}}});
 const item=await db.inventoryItem.create({data:{tenantId:tenant.id,sku:'seed',name:'Seed',unitOfMeasure:'bag',defaultUnitValue:'10',currencyCode:'USD'}});
 const leads=await Promise.all([1,2].map(n=>db.lead.create({data:{tenantId:tenant.id,userId:'tester',firstname:'Borrower '+n,fineractLoanId:n}})));
 const balance=await db.inventoryBalance.create({data:{tenantId:tenant.id,inventoryItemId:item.id,fineractOfficeId:1,currencyCode:'USD',quantityOnHand:'5',stockValue:'50'}});
 const input={tenantId:tenant.id,leadId:leads[0].id,actorUserId:'tester',selection:{inventoryItemId:item.id,fineractOfficeId:1,currencyCode:'USD',quantity:'4',unitValue:'10'}};
 return {tenant,item,leads,balance,input};
}
