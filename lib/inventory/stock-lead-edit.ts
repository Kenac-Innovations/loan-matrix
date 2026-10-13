import {Prisma, type PrismaClient} from '@/app/generated/prisma';
import {isArdaInventoryFeatureEnabled} from './inventory-access';
import {lockInventoryTenant} from './inventory-lock';
import {assertNoPendingStockAction,reserveStockInTransaction,selectionFromIssue} from './stock-reservation-service';
import {parseStockSelection,requiresStock,storedStockSelection} from './stock-product-policy';
import {StockControlError} from './stock-errors';

/** Coordinate existing API metadata writers with approval/disbursement preparation. */
export async function withStockLeadEdit<T>(db: PrismaClient, leadId: string, user: {id?:string;tenantId?:string} | undefined, data: Record<string,unknown>, update: (tx: Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 const lead=await db.lead.findUnique({where:{id:leadId},include:{tenant:true}});
 if(!lead?.tenant || !isArdaInventoryFeatureEnabled(lead.tenant,'enforceStockAvailability')) return update(db);
 if(!user?.id || user.tenantId!==lead.tenantId) throw new StockControlError('A matching tenant session is required to edit stock terms.',403);
 return db.$transaction(async tx=>{
  await lockInventoryTenant(tx,lead.tenantId);
  const current=await tx.lead.findUniqueOrThrow({where:{id:leadId}});
  const issue=await tx.stockLoanIssue.findFirst({where:{tenantId:lead.tenantId,leadId},include:{lines:true}});
  const currentRaw=storedStockSelection(current.stateMetadata);
  const nextRaw=storedStockSelection(data.stateMetadata===undefined ? current.stateMetadata : data.stateMetadata);
  const protectedLoan=issue || requiresStock(lead.tenant!.settings,current.loanProductId,currentRaw) || requiresStock(lead.tenant!.settings,Number(data.loanProductId)||null,nextRaw);
  // Tenant and stock identity cannot be reassigned through unrestricted lead patches.
  if(data.tenantId!==undefined && data.tenantId!==current.tenantId) throw new StockControlError('The tenant of a stock lead cannot be changed.');
  if(protectedLoan){
   await assertNoPendingStockAction(tx,lead.tenantId,leadId);
   for(const key of ['fineractLoanId','loanProductId'] as const){
    if(issue && data[key]!==undefined && data[key]!==current[key]) throw new StockControlError('Reconcile the stock reservation before changing the linked loan or product.');
   }
   if(data.stateMetadata!==undefined){
    const next=parseStockSelection(nextRaw);
    if(issue?.status==='RESERVED') await reserveStockInTransaction(tx,{tenantId:lead.tenantId,leadId,actorUserId:user.id!,selection:next});
    else if(issue && ['ISSUED','REPAID','PROCESSING'].includes(issue.status) && JSON.stringify(next)!==JSON.stringify(selectionFromIssue(issue))) throw new StockControlError('Stock has already been issued or is processing; its selection cannot be edited.');
   }
  }
  return update(tx);
 },{timeout:15000});
}
