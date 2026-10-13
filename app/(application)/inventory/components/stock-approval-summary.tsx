import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getTenantFromHeaders } from '@/lib/tenant-service';
import { isArdaInventoryFeatureEnabled } from '@/lib/inventory/inventory-access';
import { parseStockSelection, requiresStock, storedStockSelection } from '@/lib/inventory/stock-product-policy';
import { getLeadViewerAccessContext } from '@/lib/lead-policy';
export async function StockApprovalSummary({leadId}:{leadId:string}){
 const tenant=await getTenantFromHeaders();
 if(!tenant||!isArdaInventoryFeatureEnabled(tenant,'enforceStockAvailability'))return null;
 const session=await getSession();if(session?.user?.tenantId!==tenant.id)return null;
 const lead=await prisma.lead.findFirst({where:{id:leadId,tenantId:tenant.id}});if(!lead)return null;
 const raw=storedStockSelection(lead.stateMetadata);if(!requiresStock(tenant.settings,lead.loanProductId,raw))return null;
 let selection;try{selection=parseStockSelection(raw)}catch{return <div role="alert" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">This stock loan is missing a valid item, branch or quantity. Complete the stock selection before approval.</div>}
 const access=await getLeadViewerAccessContext(tenant.id,session.user.userId);
 if(access.visibleOfficeIds!==null&&!access.visibleOfficeIds.includes(selection.fineractOfficeId))return null;
 const [balance,issue,pending]=await Promise.all([
  prisma.inventoryBalance.findFirst({where:{tenantId:tenant.id,inventoryItemId:selection.inventoryItemId,fineractOfficeId:selection.fineractOfficeId,currencyCode:selection.currencyCode},include:{inventoryItem:true}}),
  prisma.stockLoanIssue.findFirst({where:{tenantId:tenant.id,leadId}}),
  prisma.stockActionOperation.findFirst({where:{tenantId:tenant.id,leadId,status:{in:['PREPARED','UNCERTAIN','CONFIRMED']}}}),
 ]);
 return <section aria-label="Stock provisioning" className="mt-4 rounded-lg border bg-card p-4"><h2 className="font-semibold">Stock provisioning</h2><p className="mt-2 text-sm">{balance?.inventoryItem.name||'Stock item unavailable'} · {balance?.fineractOfficeName||`Office ${selection.fineractOfficeId}`} · Requested: {selection.quantity} {balance?.inventoryItem.unitOfMeasure||''}</p><p className="mt-1 text-sm text-muted-foreground">Available for new reservations: {balance?.quantityOnHand.minus(balance.quantityReserved).toString()||'0'} · This loan: {issue?.status||'Not reserved'}</p>{pending&&<p role="status" className="mt-2 text-sm text-amber-500">An external action is awaiting reconciliation. Stock remains reserved. Do not repeat the payout.</p>}{issue?.failureReason&&<p className="mt-2 text-sm text-amber-500">{issue.failureReason}</p>}</section>;
}
