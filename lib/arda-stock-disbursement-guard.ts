import {
  syncArdaStockDetailsForCurrentTenant,
} from "@/lib/fineract-arda-stock-details";
import type { ArdaStockDetails } from "@/lib/inventory/arda-stock-workflow-service";
import { isArdaStockReportsEnabled } from "@/lib/tenant-arda-stock-reports";

export async function runArdaStockDisbursementGuard<T>(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractLoanId: number;
  getDetails: () => ArdaStockDetails | null;
  sync?: typeof syncArdaStockDetailsForCurrentTenant;
  disburse: () => Promise<T>;
}): Promise<T> {
  const enabled = isArdaStockReportsEnabled({
    tenantSlug: input.appTenantSlug,
    tenantSettings: input.tenantSettings,
  });

  if (!enabled) {
    return input.disburse();
  }

  const details = input.getDetails();
  if (!details) return input.disburse();

  await (input.sync ?? syncArdaStockDetailsForCurrentTenant)({
    appTenantSlug: input.appTenantSlug,
    tenantSettings: input.tenantSettings,
    fineractLoanId: input.fineractLoanId,
    details,
  });

  return input.disburse();
}
