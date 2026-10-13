import { Prisma } from '@/app/generated/prisma';
import { isArdaInventoryFeatureEnabled, InventoryAccessError } from './inventory-access';
import { stockCommand } from './stock-command-policy';
import { requiresStock, parseStockSelection, storedStockSelection } from './stock-product-policy';
import { createStockActionService, StockActionPendingError } from './stock-action-service';
import { lockInventoryTenant } from './inventory-lock';
import { assertNoPendingStockAction, releaseStockInTransaction } from './stock-reservation-service';

/** Shared boundary for the fetch and Axios Fineract clients. Other tenants bypass it. */
export async function guardStockRequest<T>(endpoint:string,method:string,payload:Record<string,unknown>,execute:(payload:Record<string,unknown>)=>Promise<T>):Promise<T>{
 const command=stockCommand(endpoint,method);if(!command)return execute(payload);
 const [{getTenantFromHeaders},{getSession},{prisma},{fetchFineractAPI},{getLeadViewerAccessContext}]=await Promise.all([import('../tenant-service'),import('../auth'),import('../prisma'),import('../api'),import('../lead-policy')]);
 const tenant=await getTenantFromHeaders();
 if(!tenant||!isArdaInventoryFeatureEnabled(tenant,'enforceStockAvailability'))return execute(payload);
 const session=await getSession();
 if(!session?.user?.id||session.user.tenantId!==tenant.id)throw new InventoryAccessError('A matching tenant session is required for stock loan actions.');
 const actorUserId=session.user.id;
 const loan=await fetchFineractAPI(`/loans/${command.loanId}?associations=transactions`);
 const lead=await prisma.lead.findFirst({where:{tenantId:tenant.id,fineractLoanId:command.loanId}});
 const raw=storedStockSelection(lead?.stateMetadata);
 if(!requiresStock(tenant.settings,loan.loanProductId??lead?.loanProductId,raw))return execute(payload);
 if(!lead)throw new Error('This stock loan must be linked to a Loan Matrix lead before approval or disbursement.');
 const selection=parseStockSelection(raw);
 const access=await getLeadViewerAccessContext(tenant.id,session.user.userId);
 if(access.visibleOfficeIds!==null&&!access.visibleOfficeIds.includes(selection.fineractOfficeId))throw new InventoryAccessError('This stock branch is outside your assigned offices.');
 const office=loan.clientOfficeId??loan.officeId;
 if(office&&office!==selection.fineractOfficeId)throw new Error('Loan office and reserved stock branch must match.');
 const value=new Prisma.Decimal(selection.quantity).mul(selection.unitValue);
 const requested=payload.approvedLoanAmount??payload.transactionAmount??payload.principal??loan.approvedPrincipal??loan.principal;
 if(requested==null||!value.equals(String(requested)))throw new Error('Loan amount must match the selected stock quantity and unit value. Update the stock selection first.');
 if(payload.productId&&Number(payload.productId)!==Number(loan.loanProductId))throw new Error('Change the stock selection and product together before approving this loan.');
 if(command.command==='approve'||command.command==='disburse'){
   return createStockActionService(prisma).run({tenant,leadId:lead.id,loanId:command.loanId,command:command.command,actorUserId,selection,payload,
     execute:externalId=>execute(externalId?{...payload,externalId}:payload),
     reconcile:async op=>{
       // Approval has no transaction external ID; uncertain approvals require an audited review.
       if(op.command!=='disburse')return null;
       const snapshot=op.requestSnapshot as {payload?:{externalId?:string}};
       const expected=snapshot.payload?.externalId||`stock-op-${op.id}`;
       const current=await fetchFineractAPI(`/loans/${op.loanId}?associations=transactions`);
       const tx=(current.transactions??[]).find((t:{externalId?:string|{value?:string};reversed?:boolean;type?:{id?:number};amount?:number})=>(typeof t.externalId==='string'?t.externalId:t.externalId?.value)===expected&&!t.reversed&&t.type?.id===1&&new Prisma.Decimal(t.amount??0).equals(value));
       return tx?{resourceId:op.loanId,loanId:op.loanId,transactionId:tx.id} as T:null;
     },
   });
 }
 // Non-disbursement mutations also get a durable marker, blocking concurrent approvals.
 const op=await prisma.$transaction(async tx=>{
   await lockInventoryTenant(tx,tenant.id);await assertNoPendingStockAction(tx,tenant.id,lead.id);
   const issue=await tx.stockLoanIssue.findFirst({where:{tenantId:tenant.id,leadId:lead.id}});
   return tx.stockActionOperation.create({data:{tenantId:tenant.id,leadId:lead.id,loanId:command.loanId,command:command.command,operationKey:crypto.randomUUID(),generation:issue?.reservationGeneration??0,requestSnapshot:{payload:payload as Prisma.InputJsonObject},status:'PREPARED'}});
 });
 let result:T;
 try{result=await execute(payload)}catch(error){
   const status=(error as {status?:number}).status;
   await prisma.stockActionOperation.update({where:{id:op.id},data:{status:status&&[400,401,403,404,422].includes(status)?'FAILED':'UNCERTAIN',failureReason:String(error)}});
   throw error;
 }
 try{
 await prisma.$transaction(async tx=>{
   await lockInventoryTenant(tx,tenant.id);
   await tx.stockActionOperation.update({where:{id:op.id},data:{status:'FINALIZED',result:JSON.parse(JSON.stringify(result??{}))}});
   if(['reject','withdrawnbyapplicant','delete','undoapproval'].includes(command.command))await releaseStockInTransaction(tx,{tenantId:tenant.id,leadId:lead.id,actorUserId,reason:`Loan ${command.command}`});
   if(command.command==='undodisbursal')await tx.stockLoanIssue.updateMany({where:{tenantId:tenant.id,leadId:lead.id},data:{failureReason:'Financial disbursement undone. Confirm physical return and reconcile stock before reuse.'}});
 });
 }catch{throw new StockActionPendingError(op.id)}
 return result;
}
