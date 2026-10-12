/**
 * Cashier session closure enforcement policy.
 *
 * Pure functions (no Prisma) deciding whether a cashier's unclosed earlier-day
 * sessions should block CASH disbursements. Rollout is gated by
 * Tenant.isTellerManagementModuleOn and, per cashier, Cashier.enforceSessionClosure
 * (null = inherit Tenant.enforceSessionClosureByDefault, true = enforce, false = exempt).
 */

export const BUSINESS_TIME_ZONE = "Africa/Harare";

export type SessionClosureTenantSettings = {
  isTellerManagementModuleOn: boolean;
  enforceSessionClosureByDefault: boolean;
  sessionClosureEnforcedFrom: Date | null;
  sessionClosureSettingsUpdatedAt?: Date | null;
  tellerModuleEnabledAt?: Date | null;
};

export type SessionClosureCashierSettings = {
  enforceSessionClosure: boolean | null;
  sessionClosureEnforcedFrom: Date | null;
  sessionClosureFlagUpdatedAt?: Date | null;
  createdAt: Date;
};

export type SessionClosureEnforcement =
  | { enforced: false; reason: "MODULE_OFF" | "CASHIER_EXEMPT" | "NOT_ENROLLED" }
  | { enforced: true; source: "CASHIER" | "TENANT_DEFAULT"; enforcedFrom: Date };

function later(a: Date, b: Date): Date {
  return a > b ? a : b;
}

/**
 * Resolve enforcement for one cashier record.
 *
 * enforcedFrom is never null: sessions before it are not counted, so a missing
 * start date falls back to when the flag/setting last changed rather than
 * counting every legacy session.
 */
export function resolveSessionClosureEnforcement(
  tenant: SessionClosureTenantSettings,
  cashier: SessionClosureCashierSettings
): SessionClosureEnforcement {
  if (!tenant.isTellerManagementModuleOn) {
    return { enforced: false, reason: "MODULE_OFF" };
  }

  if (cashier.enforceSessionClosure === false) {
    return { enforced: false, reason: "CASHIER_EXEMPT" };
  }

  if (cashier.enforceSessionClosure === true) {
    const sourceFrom =
      cashier.sessionClosureEnforcedFrom ??
      cashier.sessionClosureFlagUpdatedAt ??
      cashier.createdAt;
    return {
      enforced: true,
      source: "CASHIER",
      enforcedFrom: tenant.tellerModuleEnabledAt ? later(sourceFrom, tenant.tellerModuleEnabledAt) : sourceFrom,
    };
  }

  if (tenant.enforceSessionClosureByDefault) {
    const tenantFrom =
      tenant.sessionClosureEnforcedFrom ?? tenant.sessionClosureSettingsUpdatedAt ?? null;
    const cashierFrom = cashier.sessionClosureFlagUpdatedAt ?? cashier.createdAt;
    const sourceFrom = tenantFrom ? later(tenantFrom, cashierFrom) : cashierFrom;
    return {
      enforced: true,
      source: "TENANT_DEFAULT",
      enforcedFrom: tenant.tellerModuleEnabledAt ? later(sourceFrom, tenant.tellerModuleEnabledAt) : sourceFrom,
    };
  }

  return { enforced: false, reason: "NOT_ENROLLED" };
}

/**
 * Resolve enforcement for each of a user's cashier records independently.
 * Callers must check each cashier's sessions against that cashier's own
 * enforcedFrom, so an exempt or later-enrolled record never blocks via another.
 */
export function resolveEnforcementPerCashier<T extends SessionClosureCashierSettings>(
  tenant: SessionClosureTenantSettings,
  cashiers: T[]
): Array<{ cashier: T; enforcement: SessionClosureEnforcement }> {
  return cashiers.map((cashier) => ({
    cashier,
    enforcement: resolveSessionClosureEnforcement(tenant, cashier),
  }));
}

/**
 * Only cash payouts touch the cashier's drawer; mobile money and bank transfers
 * are never blocked by session closure.
 */
export function isCashDisbursementSubjectToSessionClosure(input: {
  payoutMethod?: string | null;
  paymentTypeIsCash?: boolean | null;
}): boolean {
  return input.payoutMethod === "CASH" || input.paymentTypeIsCash === true;
}

/** Calendar date (YYYY-MM-DD) of an instant in the business time zone. */
export function toBusinessDateString(instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Whether a session's business date falls on or after the enforcement start.
 * businessDate is a @db.Date column, which Prisma returns as UTC midnight.
 */
export function isSessionCountedForEnforcement(
  sessionBusinessDate: Date,
  enforcedFrom: Date
): boolean {
  return sessionBusinessDate.toISOString().slice(0, 10) >= toBusinessDateString(enforcedFrom);
}
