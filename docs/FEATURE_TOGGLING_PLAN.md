# Feature Toggling Plan

## Overview
Add per-tenant feature toggling to enable/disable specific features like USSD channel, AI chat, credit scoring, affordability calculations, etc.

## Current State
- Tenant model already has a `settings: Json?` field
- Current structure stores minimal settings: `{ theme, features: { statemachine, notifications } }`

## Proposed Solution

### Option 1: Extend Existing Settings JSON (Recommended)
**Pros:** No migration needed, flexible, already in place  
**Cons:** Less type-safe, harder to query

### Option 2: Create Dedicated FeatureFlags Model
**Pros:** Type-safe, queryable, better for complex features  
**Cons:** Requires migration

## Recommended Approach: Hybrid Solution

### Phase 1: Enhance Settings JSON with Feature Flags

**1. Create Type Definitions**

```typescript
// lib/types/feature-flags.ts
export interface FeatureFlags {
  leadChannels: {
    ussd: boolean;
    web: boolean;
    mobile: boolean;
    api: boolean;
  };
  leadManagement: {
    creditScoring: boolean;
    affordabilityCalculator: boolean;
    riskAssessment: boolean;
    documentVerification: boolean;
  };
  aiFeatures: {
    aiChat: boolean;
    automatedResponses: boolean;
    loanRecommendations: boolean;
    fraudDetection: boolean;
  };
  integrations: {
    fineractIntegration: boolean;
    smsIntegration: boolean;
    emailIntegration: boolean;
  };
  reporting: {
    advancedAnalytics: boolean;
    customReports: boolean;
    exports: boolean;
  };
}

export interface TenantSettings {
  theme: string;
  features: FeatureFlags;
  // ... other settings
}
```

**2. Create Feature Flag Service**

```typescript
// lib/feature-flags-service.ts
import { prisma } from "./prisma";
import { FeatureFlags } from "./types/feature-flags";

export class FeatureFlagsService {
  // Get feature flags for a tenant
  static async getFeatureFlags(tenantId: string): Promise<FeatureFlags> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    return this.parseFeatureFlags(tenant?.settings);
  }

  // Update feature flags for a tenant
  static async updateFeatureFlags(
    tenantId: string, 
    flags: Partial<FeatureFlags>
  ): Promise<void> {
    const currentFlags = await this.getFeatureFlags(tenantId);
    const updatedFlags = { ...currentFlags, ...flags };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...tenant.settings,
          features: updatedFlags
        }
      }
    });
  }

  // Check if specific feature is enabled
  static async isFeatureEnabled(
    tenantId: string,
    featurePath: string
  ): Promise<boolean> {
    const flags = await this.getFeatureFlags(tenantId);
    return this.getNestedValue(flags, featurePath);
  }

  private static parseFeatureFlags(settings: any): FeatureFlags {
    // Return default flags if not configured
    return settings?.features || this.getDefaultFlags();
  }

  private static getDefaultFlags(): FeatureFlags {
    return {
      leadChannels: {
        ussd: false,
        web: true,
        mobile: false,
        api: false,
      },
      leadManagement: {
        creditScoring: true,
        affordabilityCalculator: true,
        riskAssessment: true,
        documentVerification: true,
      },
      aiFeatures: {
        aiChat: false,
        automatedResponses: false,
        loanRecommendations: false,
        fraudDetection: false,
      },
      integrations: {
        fineractIntegration: true,
        smsIntegration: true,
        emailIntegration: true,
      },
      reporting: {
        advancedAnalytics: false,
        customReports: true,
        exports: true,
      },
    };
  }

  private static getNestedValue(obj: any, path: string): boolean {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return false;
    }
    return value === true;
  }
}
```

**3. Create React Hook for Client-Side Checks**

```typescript
// hooks/use-feature-flags.ts
import { useEffect, useState } from "react";
import { FeatureFlags } from "@/lib/types/feature-flags";

export function useFeatureFlags(tenantId?: string) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/tenant/${tenantId}/features`);
      const data = await response.json();
      setFlags(data);
      setLoading(false);
    };

    fetchFlags();
  }, [tenantId]);

  const isEnabled = (featurePath: string): boolean => {
    if (!flags) return false;
    const keys = featurePath.split('.');
    let value: any = flags;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return false;
    }
    return value === true;
  };

  return { flags, loading, isEnabled };
}
```

**4. Create API Route**

```typescript
// app/api/tenant/[id]/features/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const flags = await FeatureFlagsService.getFeatureFlags(params.id);
  return NextResponse.json(flags);
}
```

**5. Update Middleware/Context to Provide Flags**

```typescript
// middleware.ts or context
export async function getFeatureFlagsForRequest() {
  const tenant = await getTenantFromRequest();
  return await FeatureFlagsService.getFeatureFlags(tenant.id);
}
```

### Phase 2: Create Feature Flags Management UI

**Admin Interface for Enabling/Disabling Features:**

- Settings page: `/settings/features`
- Toggle switches for each feature
- Save changes to database
- Real-time updates

### Phase 3: Implementation Examples

**Example 1: Conditional Rendering**

```typescript
// In a component
const { isEnabled } = useFeatureFlags(tenantId);

{isEnabled('leadChannels.ussd') && (
  <UssdChannelSection />
)}
```

**Example 2: API Route Protection**

```typescript
// In API route
const isUssdEnabled = await FeatureFlagsService.isFeatureEnabled(
  tenantId,
  'leadChannels.ussd'
);

if (!isUssdEnabled) {
  return NextResponse.json(
    { error: 'USSD channel not enabled for this tenant' },
    { status: 403 }
  );
}
```

## Database Migration

**Optional Migration to Add Index:**

```sql
-- Add index if we need to query settings frequently
CREATE INDEX idx_tenant_settings ON "Tenant" USING GIN("settings");
```

## Migration Strategy

1. **Backward Compatibility:** Existing tenants get default flags
2. **Seed New Defaults:** Update seed script with new default flags
3. **Admin Tool:** Create UI for updating flags per tenant
4. **Documentation:** Document all available features

## Feature Categories

1. **Lead Channels** - How leads can be created
2. **Lead Management** - Features within lead processing
3. **AI Features** - AI-powered functionality
4. **Integrations** - Third-party integrations
5. **Reporting** - Analytics and reports

## Next Steps

1. Create type definitions
2. Implement FeatureFlagsService
3. Create API routes
4. Create React hook
5. Build admin UI for management
6. Update existing code to use feature flags
7. Add tests


