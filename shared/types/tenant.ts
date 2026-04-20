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
  /** Default lead pipeline to all dates instead of today's date */
  showAllLeadsByDefault: boolean;
  /** Omama-only office-scoped dashboard for Admin/Administrator users on the leads page */
  officeScopedAdminLeadsDashboard: boolean;
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

export interface FirstRepaymentDateConfig {
  strategy: FirstRepaymentDateStrategy;
  /** Day-of-month cutoff (only used with "cutoff" strategy). Defaults to 16. */
  cutoffDay?: number;
}

/**
 * Tenant settings stored in the database
 */
export interface TenantSettings {
  theme: string;
  features: TenantFeatures;
  /** How loan interest rates should be displayed in the UI and documents */
  loanTermsInterestRateDisplay?: InterestRateDisplayMode;
  /** Monthly lead target */
  monthlyTarget?: number;
  /** Conversion rate target (percentage) */
  conversionTarget?: number;
  /** Processing time target (days) */
  processingTimeTarget?: number;
  /** How to calculate the default first repayment date */
  firstRepaymentDate?: FirstRepaymentDateConfig;
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
  showAllLeadsByDefault: false,
  officeScopedAdminLeadsDashboard: false,
};

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  settings?: TenantSettings;
  /** Document service file URL for org logo (when set) */
  logoFileUrl?: string | null;
  /** Document service link ID (UUID) for logo */
  logoLinkId?: string | null;
}
