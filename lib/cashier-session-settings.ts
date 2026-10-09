import { prisma } from "@/lib/prisma";
import type { SessionClosureTenantSettings } from "@/lib/cashier-session-enforcement-policy";

export type CashierSessionTenantSettings = SessionClosureTenantSettings & {
  cashVarianceTolerance: number;
};

/**
 * Read a tenant's session-closure settings. Read directly (not from the cached
 * tenant lookup) so a toggle takes effect immediately. A missing tenant reads as
 * module off, which keeps legacy behaviour.
 */
export async function getCashierSessionTenantSettings(
  tenantId: string
): Promise<CashierSessionTenantSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: true,
      sessionClosureSettingsUpdatedAt: true,
      tellerModuleEnabledAt: true,
      cashVarianceTolerance: true,
    },
  });

  return {
    isTellerManagementModuleOn: tenant?.isTellerManagementModuleOn ?? false,
    enforceSessionClosureByDefault: tenant?.enforceSessionClosureByDefault ?? false,
    sessionClosureEnforcedFrom: tenant?.sessionClosureEnforcedFrom ?? null,
    sessionClosureSettingsUpdatedAt: tenant?.sessionClosureSettingsUpdatedAt ?? null,
    tellerModuleEnabledAt: tenant?.tellerModuleEnabledAt ?? null,
    cashVarianceTolerance: tenant?.cashVarianceTolerance ?? 0,
  };
}
