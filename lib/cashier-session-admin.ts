/**
 * Cashier session-closure admin controls: tenant-wide settings and per-cashier enforcement modes.
 *
 * Pure functions (no Prisma) for:
 * - Converting between boolean flags and enforcement modes (INHERIT, ENFORCE, EXEMPT)
 * - Computing the next cashier enforcement fields when a mode is set
 * - Computing the next tenant settings when configuration is updated
 */

export type EnforcementMode = "INHERIT" | "ENFORCE" | "EXEMPT";

export type CashierEnforcementInput = {
  enforceSessionClosure: boolean | null;
  sessionClosureEnforcedFrom: Date | null;
};

export type TenantSessionSettingsInput = {
  isTellerManagementModuleOn: boolean;
  enforceSessionClosureByDefault: boolean;
  sessionClosureEnforcedFrom: Date | null;
  tellerModuleEnabledAt: Date | null;
  cashVarianceTolerance: number;
};

/**
 * Convert a boolean flag (null | true | false) to an enforcement mode.
 * null => INHERIT, true => ENFORCE, false => EXEMPT.
 */
export function modeFromFlag(flag: boolean | null): EnforcementMode {
  if (flag === true) return "ENFORCE";
  if (flag === false) return "EXEMPT";
  return "INHERIT";
}

/**
 * Convert an enforcement mode back to a boolean flag.
 * ENFORCE => true, EXEMPT => false, INHERIT => null.
 */
export function flagFromMode(mode: EnforcementMode): boolean | null {
  if (mode === "ENFORCE") return true;
  if (mode === "EXEMPT") return false;
  return null;
}

/**
 * Type guard to validate an unknown value is an EnforcementMode.
 */
export function isEnforcementMode(x: unknown): x is EnforcementMode {
  return x === "INHERIT" || x === "ENFORCE" || x === "EXEMPT";
}

export interface CashierEnforcementUpdate {
  enforceSessionClosure: boolean | null;
  sessionClosureEnforcedFrom: Date | null;
  sessionClosureFlagUpdatedBy: string;
  sessionClosureFlagUpdatedAt: Date;
}

/**
 * Compute the next cashier enforcement fields when the enforcement mode is changed.
 *
 * Rules:
 * - If mode is ENFORCE and the cashier was not previously enforced, set
 *   sessionClosureEnforcedFrom to now. If already enforced, preserve the
 *   existing sessionClosureEnforcedFrom date.
 * - If mode is ENFORCE or EXEMPT, set sessionClosureFlagUpdatedBy/At.
 * - If mode is INHERIT, set enforceSessionClosure to null and clear
 *   sessionClosureEnforcedFrom (will be computed from tenant settings
 *   when resolving enforcement).
 */
export function nextCashierEnforcementFields(
  current: CashierEnforcementInput,
  mode: EnforcementMode,
  actorId: string,
  now: Date
): CashierEnforcementUpdate {
  const enforceSessionClosure = flagFromMode(mode);

  let sessionClosureEnforcedFrom: Date | null;

  if (mode === "ENFORCE") {
    // If already enforced, keep the existing enforcedFrom date.
    // Otherwise, use now.
    if (current.enforceSessionClosure === true && current.sessionClosureEnforcedFrom) {
      sessionClosureEnforcedFrom = current.sessionClosureEnforcedFrom;
    } else {
      sessionClosureEnforcedFrom = now;
    }
  } else {
    // INHERIT or EXEMPT: clear enforcedFrom.
    sessionClosureEnforcedFrom = null;
  }

  return {
    enforceSessionClosure,
    sessionClosureEnforcedFrom,
    sessionClosureFlagUpdatedBy: actorId,
    sessionClosureFlagUpdatedAt: now,
  };
}

export interface TenantSessionSettingsUpdate {
  ok: true;
  data: {
    isTellerManagementModuleOn: boolean;
    enforceSessionClosureByDefault: boolean;
    sessionClosureEnforcedFrom: Date | null;
    tellerModuleEnabledAt: Date | null;
    cashVarianceTolerance: number;
    sessionClosureSettingsUpdatedBy: string;
    sessionClosureSettingsUpdatedAt: Date;
  };
}

export interface TenantSessionSettingsError {
  ok: false;
  error: string;
}

export type TenantSessionSettingsResult = TenantSessionSettingsUpdate | TenantSessionSettingsError;

/**
 * Compute the next tenant session settings based on input updates.
 *
 * Validation:
 * - cashVarianceTolerance must be a finite number >= 0.
 *
 * Rules for sessionClosureEnforcedFrom:
 * - If the resulting state is (module on AND default on) and the previous
 *   state was not (module on AND default on), set to now.
 * - If the resulting state is not (module on AND default on), clear (set null).
 * - Otherwise, keep the existing value.
 *
 * Rules for tellerModuleEnabledAt:
 * - If module goes off->on, set to now.
 * - Otherwise, keep the existing value.
 *
 * Always set sessionClosureSettingsUpdatedBy/At.
 */
export function nextTenantSessionSettings(
  current: TenantSessionSettingsInput,
  input: {
    isTellerManagementModuleOn?: boolean;
    enforceSessionClosureByDefault?: boolean;
    cashVarianceTolerance?: number;
  },
  actorId: string,
  now: Date
): TenantSessionSettingsResult {
  // Validate cashVarianceTolerance if provided
  if (input.cashVarianceTolerance !== undefined) {
    if (!Number.isFinite(input.cashVarianceTolerance) || input.cashVarianceTolerance < 0) {
      return {
        ok: false,
        error: "Cash variance tolerance must be a finite number >= 0",
      };
    }
  }

  const nextSettings = {
    isTellerManagementModuleOn:
      input.isTellerManagementModuleOn ?? current.isTellerManagementModuleOn,
    enforceSessionClosureByDefault:
      input.enforceSessionClosureByDefault ?? current.enforceSessionClosureByDefault,
    cashVarianceTolerance:
      input.cashVarianceTolerance ?? current.cashVarianceTolerance,
  };

  const prevBothOn =
    current.isTellerManagementModuleOn && current.enforceSessionClosureByDefault;
  const nextBothOn =
    nextSettings.isTellerManagementModuleOn && nextSettings.enforceSessionClosureByDefault;

  let sessionClosureEnforcedFrom: Date | null;

  if (nextBothOn && !prevBothOn) {
    // Transitioning to both-on: set to now
    sessionClosureEnforcedFrom = now;
  } else if (!nextBothOn) {
    // Not both-on: clear
    sessionClosureEnforcedFrom = null;
  } else {
    // Both-on and was already both-on: preserve existing
    sessionClosureEnforcedFrom = current.sessionClosureEnforcedFrom;
  }

  // When module goes off->on, set tellerModuleEnabledAt to now; otherwise keep existing
  const prevModuleOn = current.isTellerManagementModuleOn;
  const nextModuleOn = nextSettings.isTellerManagementModuleOn;
  const tellerModuleEnabledAt =
    !prevModuleOn && nextModuleOn ? now : current.tellerModuleEnabledAt;

  return {
    ok: true,
    data: {
      isTellerManagementModuleOn: nextSettings.isTellerManagementModuleOn,
      enforceSessionClosureByDefault: nextSettings.enforceSessionClosureByDefault,
      sessionClosureEnforcedFrom,
      tellerModuleEnabledAt,
      cashVarianceTolerance: nextSettings.cashVarianceTolerance,
      sessionClosureSettingsUpdatedBy: actorId,
      sessionClosureSettingsUpdatedAt: now,
    },
  };
}
