import type { Prisma } from '@/app/generated/prisma';
import { isArdaInventoryFeatureEnabled } from './inventory-access';
/** One short tenant-level mutex orders multi-item replacements and legacy writers. */
export async function lockInventoryTenant(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`inventory:${tenantId}`}, 0))`;
}
export async function lockInventoryTenantIfEnabled(client: unknown, tenantId: string) {
  const tx=client as Prisma.TransactionClient;
  // Legacy in-memory ledger adapters have no database lock primitive.
  if (typeof tx.$queryRaw !== 'function') return;
  const tenant=await tx.tenant.findUnique({where:{id:tenantId}});
  if(tenant && isArdaInventoryFeatureEnabled(tenant,'enforceStockAvailability')) await lockInventoryTenant(tx,tenantId);
}
