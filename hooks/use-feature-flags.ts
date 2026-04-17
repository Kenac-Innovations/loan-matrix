"use client";

import { useState, useEffect, useCallback } from "react";
import { TenantFeatures, DEFAULT_FEATURES } from "@/shared/types/tenant";

interface FeatureFlagsState {
  features: TenantFeatures;
  isLoading: boolean;
  error: string | null;
  tenantSlug: string | null;
}

/**
 * Extract tenant slug from hostname (client-side)
 */
function getTenantSlugFromHost(): string {
  if (globalThis.window === undefined) return "goodfellow";
  
  const host = globalThis.location.hostname;
  
  // Handle plain localhost (no subdomain)
  if (host === "localhost" || host === "127.0.0.1") {
    return "goodfellow";
  }

  // Handle subdomain.localhost (e.g. omama.localhost)
  if (host.endsWith(".localhost")) {
    const subdomain = host.replace(".localhost", "");
    return subdomain || "goodfellow";
  }
  
  // Extract subdomain from full domains (e.g. omama.kenacloanmatrix.com)
  const parts = host.split(".");
  if (parts.length > 2) {
    return parts[0];
  }
  
  return "goodfellow";
}

/**
 * Hook to access tenant feature flags
 * 
 * @example
 * ```tsx
 * const { isEnabled, features, isLoading } = useFeatureFlags();
 * 
 * if (isEnabled("ussdLeads")) {
 *   // Show USSD Leads menu item
 * }
 * ```
 */
export function useFeatureFlags() {
  const [state, setState] = useState<FeatureFlagsState>({
    features: DEFAULT_FEATURES,
    isLoading: true,
    error: null,
    tenantSlug: null,
  });

  useEffect(() => {
    const tenantSlug = getTenantSlugFromHost();
    
    async function fetchFeatures() {
      try {
        const response = await fetch("/api/tenant/features", {
          headers: {
            "x-tenant-slug": tenantSlug,
          },
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch tenant features");
        }
        
        const data = await response.json();
        
        setState({
          features: { ...DEFAULT_FEATURES, ...data.features },
          isLoading: false,
          error: null,
          tenantSlug: data.tenantSlug || tenantSlug,
        });
      } catch (error) {
        console.error("Error fetching feature flags:", error);
        // Fall back to default features on error
        setState({
          features: DEFAULT_FEATURES,
          isLoading: false,
          error: error instanceof Error ? error.message : "Unknown error",
          tenantSlug,
        });
      }
    }
    
    fetchFeatures();
  }, []);

  /**
   * Check if a feature is enabled
   */
  const isEnabled = useCallback(
    (feature: keyof TenantFeatures): boolean => {
      return state.features[feature] ?? false;
    },
    [state.features]
  );

  return {
    /** All feature flags */
    features: state.features,
    /** Check if a specific feature is enabled */
    isEnabled,
    /** Whether feature flags are still loading */
    isLoading: state.isLoading,
    /** Error message if fetching failed */
    error: state.error,
    /** Current tenant slug */
    tenantSlug: state.tenantSlug,
  };
}
