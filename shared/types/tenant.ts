/**
 * Feature flags that can be toggled per tenant
 */
export interface TenantFeatures {
  /** Enable state machine for lead pipeline */
  statemachine: boolean;
  /** Enable notifications system */
  notifications: boolean;
  /** Enable USSD leads feature */
  ussdLeads: boolean;
  /** Enable lead configuration page */
  leadConfig: boolean;
  /** Enable AI assistant */
  aiAssistant: boolean;
  /** Enable accounting module */
  accounting: boolean;
  /** Enable reports module */
  reports: boolean;
  /** Enable managed receipt number ranges for cash transactions */
  receiptRanges: boolean;
  /** Allow editing loan terms fields in lead creation */
  canEditLoan: boolean;
  /** Enable invoice discounting module inside lead creation flow */
  hasInvoiceDiscounting: boolean;
  /** Enable revolving credit facility product in lead origination */
  hasRevolvingCredit: boolean;
  /** Enable credit facility tracking on loans */
  hasCreditFacility: boolean;
  /** Default lead pipeline to all dates instead of today's date */
  showAllLeadsByDefault: boolean;
  /** Omama-only office-scoped dashboard for Admin/Administrator users on the leads page */
  officeScopedAdminLeadsDashboard: boolean;
  /** When showing client active loans for topup, use the foreclosure settlement amount instead of total outstanding (excludes unrealized/future interest) */
  topupLoanBalanceExcludeUnrealizedInterests: boolean;
  /** Restrict non-exempt users to cash-only loan repayments, auto-resolving their teller/cashier from their cashier session (blocking submission if unresolvable), unless the user is individually exempted */
  autoResolveRepaymentCashier: boolean;
  /** When true, only SUPER_ADMIN users may edit sensitive client fields on the client edit form. */
  restrictSensitiveClientEditFieldsToSuperAdmin: boolean;
  /** When true, MFA is required for tenant logins. Missing or false disables MFA. */
  usesMFA?: boolean;
  /** Enabled MFA delivery channels for the tenant. */
  mfaChannels?: MfaChannel[];
  /** Maximum incorrect MFA verification attempts before the account is blocked. */
  mfaMaxAttempts?: number;
}

/**
 * Strategy for calculating the default first repayment date.
 *
 * - "cutoff": If today >= cutoffDay, last day of next month; otherwise last day of current month.
 * - "month-after-disbursement": One calendar month after the expected disbursement date.
 */
export type FirstRepaymentDateStrategy =
  | "cutoff"
  | "month-after-disbursement";

export type InterestRateDisplayMode = "annual" | "monthly";
export type MfaChannel = "email" | "sms";
export type SelfPasswordResetChannel = MfaChannel;
export type AutoDisbursementDecision = "APPROVED" | "MANUAL_REVIEW" | "DECLINED";

export interface SelfPasswordResetSettings {
  enabled?: boolean;
  notificationChannels?: SelfPasswordResetChannel[];
}

export interface FirstRepaymentDateConfig {
  strategy: FirstRepaymentDateStrategy;
  /** Day-of-month cutoff (only used with "cutoff" strategy). Defaults to 16. */
  cutoffDay?: number;
}

export interface TenantAutoPopulateFields {
  /** Auto-populate the principal amount in the lead Terms tab unless explicitly disabled */
  principalAmount?: boolean;
}

export interface TenantMobileMoneySettings {
  glAccountId?: number;
  glAccountName?: string;
  glAccountCode?: string;
  defaultOfficeId?: number;
  defaultOfficeName?: string;
  payoutClearingGlAccountId?: number;
  payoutClearingGlAccountName?: string;
  payoutClearingGlAccountCode?: string;
}

export interface TenantSupersetSettings {
  enabled?: boolean;
  baseUrl?: string;
  creatorUsernames?: string[];
}

export interface TenantAutoProgressToDisbursementRule {
  enabled?: boolean;
  loanProductId: number;
  triggerStageId: string;
  allowedCdeDecisions: AutoDisbursementDecision[];
  /**
   * Whether CDE should evaluate income for this product. Omitted rules keep
   * the existing income-based decision path.
   */
  incomeEvaluationRequired?: boolean;
}

export interface TenantUssdAutoLeadRule {
  enabled?: boolean;
  loanProductId: number;
}

/**
 * Tenant settings stored in the database
 */
export interface TenantSettings {
  theme: string;
  features: TenantFeatures;
  /** Self-service password reset configuration. Missing settings are disabled. */
  selfPasswordReset?: SelfPasswordResetSettings;
  /** How loan interest rates should be displayed in the UI and documents */
  loanTermsInterestRateDisplay?: InterestRateDisplayMode;
  /** Field-level auto-population controls for lead creation */
  autoPopulateFields?: TenantAutoPopulateFields;
  /** Monthly lead target */
  monthlyTarget?: number;
  /** Conversion rate target (percentage) */
  conversionTarget?: number;
  /** Processing time target (days) */
  processingTimeTarget?: number;
  /** How to calculate the default first repayment date */
  firstRepaymentDate?: FirstRepaymentDateConfig;
  /** Mobile money pool configuration */
  mobileMoney?: TenantMobileMoneySettings;
  /** Optional shared analytics configuration */
  superset?: TenantSupersetSettings;
  /** Product-specific rules for automatic CDE-gated progression through disbursement */
  autoProgressToDisbursementRules?: TenantAutoProgressToDisbursementRule[];
  /** Product-specific rules for automatic USSD lead creation */
  ussdAutoLeadRules?: TenantUssdAutoLeadRule[];
}

/**
 * Default feature flags - all enabled by default
 */
export const DEFAULT_FEATURES: TenantFeatures = {
  statemachine: true,
  notifications: true,
  ussdLeads: true,
  leadConfig: true,
  aiAssistant: true,
  accounting: true,
  reports: true,
  receiptRanges: false,
  canEditLoan: false,
  hasInvoiceDiscounting: false,
  hasRevolvingCredit: false,
  hasCreditFacility: false,
  showAllLeadsByDefault: false,
  officeScopedAdminLeadsDashboard: false,
  topupLoanBalanceExcludeUnrealizedInterests: false,
  autoResolveRepaymentCashier: false,
  restrictSensitiveClientEditFieldsToSuperAdmin: false,
};

/**
 * Merge a tenant's stored settings.features with the feature defaults.
 * Accepts a loosely-typed tenant so callers can pass a full Prisma Tenant
 * row, a partial select, or null/undefined without extra casting.
 */
export function getTenantFeatures(
  tenant: { settings?: unknown } | null | undefined
): TenantFeatures {
  const settings = tenant?.settings as
    | { features?: Partial<TenantFeatures> }
    | null
    | undefined;

  return {
    ...DEFAULT_FEATURES,
    ...settings?.features,
  };
}

const SELF_PASSWORD_RESET_CHANNELS: SelfPasswordResetChannel[] = [
  "email",
  "sms",
];

export function getTenantSelfPasswordResetConfig(settings: unknown): {
  enabled: boolean;
  notificationChannels: SelfPasswordResetChannel[];
} {
  const config =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};
  const rawConfig =
    config.selfPasswordReset && typeof config.selfPasswordReset === "object"
      ? (config.selfPasswordReset as Record<string, unknown>)
      : {};
  const rawChannels = Array.isArray(rawConfig.notificationChannels)
    ? rawConfig.notificationChannels
    : [];

  return {
    enabled: rawConfig.enabled === true,
    notificationChannels: Array.from(
      new Set(
        rawChannels.filter(
          (channel): channel is SelfPasswordResetChannel =>
            SELF_PASSWORD_RESET_CHANNELS.includes(
              channel as SelfPasswordResetChannel
            )
        )
      )
    ),
  };
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  settings?: TenantSettings;
  notificationServiceTenantId?: string | null;
  ussdServiceTenantId?: string | null;
  restrictLeadVisibilityToBranches?: boolean;
  onlyOriginatorCanDisburse?: boolean;
  autoAssignLeadOnApproval?: boolean;
  /** Document service file URL for org logo (when set) */
  logoFileUrl?: string | null;
  /** Document service link ID (UUID) for logo */
  logoLinkId?: string | null;
}
