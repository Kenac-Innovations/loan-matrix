"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import {
  setupCreditFacilityDatatables,
  setupCreditFacilityReports,
} from "@/app/actions/credit-facility-actions";
import type { RoleFeatureOverrides, TenantFeatures } from "@/shared/types/tenant";

interface FeatureConfig {
  key: keyof TenantFeatures;
  label: string;
  description: string;
  tag?: string;
}

const FEATURE_CONFIGS: FeatureConfig[] = [
  {
    key: "statemachine",
    label: "State Machine Pipeline",
    description: "Enable the automated state machine for the lead pipeline.",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Enable in-app notifications system.",
  },
  {
    key: "ussdLeads",
    label: "USSD Leads",
    description: "Allow lead creation via USSD integration.",
  },
  {
    key: "leadConfig",
    label: "Lead Configuration",
    description: "Enable the lead pipeline configuration page.",
  },
  {
    key: "aiAssistant",
    label: "AI Assistant",
    description: "Enable the AI assistant module.",
  },
  {
    key: "accounting",
    label: "Accounting Module",
    description: "Enable the accounting and journal entries module.",
  },
  {
    key: "reports",
    label: "Reports Module",
    description: "Enable the reports module.",
  },
  {
    key: "receiptRanges",
    label: "Managed Receipt Ranges",
    description: "Enable managed receipt number ranges for cash transactions.",
  },
  {
    key: "canEditLoan",
    label: "Edit Loan Terms",
    description: "Allow editing loan term fields during lead creation.",
  },
  {
    key: "hasInvoiceDiscounting",
    label: "Invoice Discounting",
    description: "Enable the invoice discounting product in lead origination.",
  },
  {
    key: "hasRevolvingCredit",
    label: "Revolving Credit Facility",
    description:
      "Enable the revolving credit facility (RCF) product. Shows a product selector on new lead creation and enables the RCF wizard.",
    tag: "New",
  },
  {
    key: "showAllLeadsByDefault",
    label: "Show All Leads by Default",
    description: "Default the lead pipeline view to all dates instead of today only.",
  },
  {
    key: "officeScopedAdminLeadsDashboard",
    label: "Office-Scoped Admin Dashboard",
    description: "Restrict Admin/Administrator dashboard to their office scope on the leads page.",
  },
  {
    key: "topupLoanBalanceExcludeUnrealizedInterests",
    label: "Top-up: Exclude Unrealized Interests",
    description:
      "Use the foreclosure settlement amount for active loan balances during top-up (excludes future/unrealized interest).",
  },
  {
    key: "hasCreditFacility",
    label: "Credit Facility",
    description:
      "Enable credit facility tracking on loans. Shows facility toggle on loan creation, facility details card on loan and lead pages, and a Credit Facilities menu item.",
    tag: "New",
  },
];

interface FineractRole {
  id: number;
  name: string;
  disabled?: boolean;
}

// Mirror lib/feature-flags.normalizeRoleName so the UI keys match what the API stores.
function normalizeRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export default function FeaturesSettingsPage() {
  // Global tenant defaults (raw, before any role override is applied).
  const [globalFeatures, setGlobalFeatures] = useState<TenantFeatures | null>(
    null
  );
  // Per-role overrides keyed by normalized role name.
  const [roleOverrides, setRoleOverrides] = useState<RoleFeatureOverrides>({});
  // Available Fineract roles for the per-role dropdown.
  const [roles, setRoles] = useState<FineractRole[]>([]);
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof TenantFeatures | null>(null);
  const [savingOverrideKey, setSavingOverrideKey] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<keyof TenantFeatures | null>(null);

  const [setupStatus, setSetupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [reportsStatus, setReportsStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [reportsError, setReportsError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/features");
      if (!res.ok) throw new Error("Failed to load features");
      const data = await res.json();
      setGlobalFeatures(data.global ?? data.features);
      setRoleOverrides(data.roleFeatureOverrides ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/roles");
      if (!res.ok) return;
      const data = await res.json();
      const list: FineractRole[] = Array.isArray(data?.roles) ? data.roles : [];
      setRoles(list);
      if (!selectedRoleName && list.length > 0) {
        setSelectedRoleName(normalizeRoleName(list[0].name));
      }
    } catch (err) {
      console.error("Error loading roles:", err);
    }
  }, [selectedRoleName]);

  useEffect(() => {
    fetchFeatures();
    fetchRoles();
  }, [fetchFeatures, fetchRoles]);

  // ----- Global toggle handler -----------------------------------------------
  const handleToggleGlobal = async (
    key: keyof TenantFeatures,
    value: boolean
  ) => {
    if (!globalFeatures) return;
    setSaving(key);
    setError(null);
    const optimistic = { ...globalFeatures, [key]: value };
    setGlobalFeatures(optimistic);
    try {
      const res = await fetch("/api/tenant/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: { [key]: value } }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const data = await res.json();
      setGlobalFeatures(data.global ?? data.features);
      setRoleOverrides(data.roleFeatureOverrides ?? {});
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      setGlobalFeatures({ ...globalFeatures });
      setError(
        err instanceof Error ? err.message : "Failed to save feature flag"
      );
    } finally {
      setSaving(null);
    }
  };

  // ----- Per-role override handler -------------------------------------------
  /**
   * `next` semantics:
   *   - true  -> force-enable this feature for the role
   *   - false -> force-disable this feature for the role
   *   - undefined -> inherit (clear the override for this key)
   */
  const handleSetOverride = async (
    roleName: string,
    key: keyof TenantFeatures,
    next: boolean | undefined
  ) => {
    const normalized = normalizeRoleName(roleName);
    if (!normalized) return;
    const overrideKey = `${normalized}:${key}`;
    setSavingOverrideKey(overrideKey);
    setError(null);

    // Optimistic local update.
    const previousOverrides = roleOverrides;
    const nextOverrides: RoleFeatureOverrides = { ...previousOverrides };
    const currentForRole = { ...(nextOverrides[normalized] ?? {}) };
    if (next === undefined) {
      delete (currentForRole as Record<string, unknown>)[key];
    } else {
      (currentForRole as Record<string, boolean>)[key] = next;
    }
    if (Object.keys(currentForRole).length === 0) {
      delete nextOverrides[normalized];
    } else {
      nextOverrides[normalized] = currentForRole;
    }
    setRoleOverrides(nextOverrides);

    try {
      // The server normalizes undefined -> "clear" within a Partial<TenantFeatures>.
      const payloadValue: Record<string, boolean | undefined> = {
        [key]: next,
      };
      const res = await fetch("/api/tenant/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleFeatureOverrides: { [normalized]: payloadValue },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save override");
      }
      const data = await res.json();
      setRoleOverrides(data.roleFeatureOverrides ?? {});
    } catch (err) {
      setRoleOverrides(previousOverrides);
      setError(err instanceof Error ? err.message : "Failed to save override");
    } finally {
      setSavingOverrideKey(null);
    }
  };

  // ----- Setup actions (unchanged) -------------------------------------------
  const handleSetupDatatables = async () => {
    setSetupStatus("loading");
    setSetupError(null);
    const result = await setupCreditFacilityDatatables();
    if (result.success) {
      setSetupStatus("success");
      setTimeout(() => setSetupStatus("idle"), 3000);
    } else {
      setSetupStatus("error");
      setSetupError(result.error ?? "Setup failed");
    }
  };

  const handleSetupReports = async () => {
    setReportsStatus("loading");
    setReportsError(null);
    const result = await setupCreditFacilityReports();
    if (result.success) {
      setReportsStatus("success");
      setTimeout(() => setReportsStatus("idle"), 3000);
    } else {
      setReportsStatus("error");
      setReportsError(result.error ?? "Setup failed");
    }
  };

  // ----- Derived values for the per-role section -----------------------------
  const overridesForSelectedRole = useMemo<Partial<TenantFeatures>>(() => {
    if (!selectedRoleName) return {};
    return roleOverrides[selectedRoleName] ?? {};
  }, [roleOverrides, selectedRoleName]);

  const overrideCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [role, overrides] of Object.entries(roleOverrides)) {
      out[role] = Object.keys(overrides).length;
    }
    return out;
  }, [roleOverrides]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable product features globally and, optionally, override
          them per role.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
          <CardDescription className="text-xs">
            One-time setup tasks for optional features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 py-2 border-b">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Credit Facility Datatables</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register the Fineract datatables required for the Credit Facility feature. Safe to run multiple times.
              </p>
              {setupStatus === "error" && setupError && (
                <p className="text-xs text-destructive mt-1">{setupError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetupDatatables}
              disabled={setupStatus === "loading"}
              className="shrink-0"
            >
              {setupStatus === "loading" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              {setupStatus === "success" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />
              )}
              {setupStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Credit Facility Stretchy Reports</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register the Fineract stretchy reports required for the Credit Facilities list page. Safe to run multiple times.
              </p>
              {reportsStatus === "error" && reportsError && (
                <p className="text-xs text-destructive mt-1">{reportsError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetupReports}
              disabled={reportsStatus === "loading"}
              className="shrink-0"
            >
              {reportsStatus === "loading" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              {reportsStatus === "success" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />
              )}
              {reportsStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Products &amp; Modules (Global)</CardTitle>
          <CardDescription className="text-xs">
            These flags apply to everyone in the tenant. Use the section below
            to override individual features for specific roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_CONFIGS.map((config) => {
            const value = globalFeatures?.[config.key] ?? false;
            const isSaving = saving === config.key;
            const isSaved = savedKey === config.key;

            return (
              <div
                key={config.key}
                className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`feature-${config.key}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {config.label}
                    </Label>
                    {config.tag && (
                      <Badge variant="secondary" className="text-xs">
                        {config.tag}
                      </Badge>
                    )}
                    {isSaved && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {isSaving && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    id={`feature-${config.key}`}
                    checked={value}
                    onCheckedChange={(checked) =>
                      handleToggleGlobal(config.key, checked)
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <RoleOverridesCard
        roles={roles}
        selectedRoleName={selectedRoleName}
        setSelectedRoleName={setSelectedRoleName}
        overridesForSelectedRole={overridesForSelectedRole}
        overrideCounts={overrideCounts}
        globalFeatures={globalFeatures}
        savingOverrideKey={savingOverrideKey}
        onSetOverride={handleSetOverride}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-role override card
// ---------------------------------------------------------------------------

interface RoleOverridesCardProps {
  roles: FineractRole[];
  selectedRoleName: string | null;
  setSelectedRoleName: (name: string | null) => void;
  overridesForSelectedRole: Partial<TenantFeatures>;
  overrideCounts: Record<string, number>;
  globalFeatures: TenantFeatures | null;
  savingOverrideKey: string | null;
  onSetOverride: (
    roleName: string,
    key: keyof TenantFeatures,
    next: boolean | undefined
  ) => void | Promise<void>;
}

function RoleOverridesCard(props: RoleOverridesCardProps) {
  const {
    roles,
    selectedRoleName,
    setSelectedRoleName,
    overridesForSelectedRole,
    overrideCounts,
    globalFeatures,
    savingOverrideKey,
    onSetOverride,
  } = props;

  const selectedRole = roles.find(
    (r) => normalizeRoleName(r.name) === selectedRoleName
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              Per-Role Overrides
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedRoleName ?? undefined}
              onValueChange={(v) => setSelectedRoleName(v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select a role…" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => {
                  const normalized = normalizeRoleName(r.name);
                  const count = overrideCounts[normalized] ?? 0;
                  return (
                    <SelectItem key={r.id} value={normalized}>
                      <span className="flex items-center gap-2">
                        <span>{r.name}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {count} override{count === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription className="text-xs">
          Overrides apply on top of the global flags. <strong>Inherit</strong>{" "}
          uses the global value. <strong>On</strong> force-enables for this
          role; <strong>Off</strong> force-disables. When a user holds multiple
          roles the most-permissive value wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!selectedRole && (
          <p className="text-sm text-muted-foreground">
            No role selected. {roles.length === 0
              ? "Roles failed to load — make sure the current user can READ Fineract roles."
              : "Pick a role from the dropdown to configure overrides."}
          </p>
        )}

        {selectedRole &&
          FEATURE_CONFIGS.map((config) => {
            const override = overridesForSelectedRole[config.key];
            const globalValue = globalFeatures?.[config.key] ?? false;
            const isSaving =
              savingOverrideKey ===
              `${normalizeRoleName(selectedRole.name)}:${config.key}`;

            const buttonClasses = (active: boolean) =>
              active
                ? "h-7 px-2 text-xs"
                : "h-7 px-2 text-xs text-muted-foreground";

            return (
              <div
                key={config.key}
                className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{config.label}</span>
                    {override === undefined && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Inheriting {globalValue ? "ON" : "OFF"}
                      </span>
                    )}
                    {override === true && (
                      <Badge
                        variant="default"
                        className="text-[10px] bg-emerald-500 text-white"
                      >
                        Force ON
                      </Badge>
                    )}
                    {override === false && (
                      <Badge variant="destructive" className="text-[10px]">
                        Force OFF
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  {isSaving && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <div className="inline-flex rounded-md border bg-background">
                    <Button
                      size="sm"
                      variant={override === undefined ? "secondary" : "ghost"}
                      className={buttonClasses(override === undefined)}
                      onClick={() =>
                        onSetOverride(selectedRole.name, config.key, undefined)
                      }
                      disabled={isSaving}
                    >
                      Inherit
                    </Button>
                    <Button
                      size="sm"
                      variant={override === true ? "secondary" : "ghost"}
                      className={buttonClasses(override === true)}
                      onClick={() =>
                        onSetOverride(selectedRole.name, config.key, true)
                      }
                      disabled={isSaving}
                    >
                      On
                    </Button>
                    <Button
                      size="sm"
                      variant={override === false ? "secondary" : "ghost"}
                      className={buttonClasses(override === false)}
                      onClick={() =>
                        onSetOverride(selectedRole.name, config.key, false)
                      }
                      disabled={isSaving}
                    >
                      Off
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
