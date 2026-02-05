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
}

/**
 * Tenant settings stored in the database
 */
export interface TenantSettings {
  theme: string;
  features: TenantFeatures;
  /** Monthly lead target */
  monthlyTarget?: number;
  /** Conversion rate target (percentage) */
  conversionTarget?: number;
  /** Processing time target (days) */
  processingTimeTarget?: number;
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
};

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  settings?: TenantSettings;
}
