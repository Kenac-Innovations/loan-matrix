"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  setupCreditFacilityDatatables,
  setupCreditFacilityReports,
} from "@/app/actions/credit-facility-actions";
import { setupBranchCollectionPerformanceReports } from "@/app/actions/collection-actions";
import {
  setupRecoveryDatatables,
  setupRecoveriesReports,
} from "@/app/actions/recovery-actions";
import type { TenantFeatures } from "@/shared/types/tenant";

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

export default function FeaturesSettingsPage() {
  const [features, setFeatures] = useState<TenantFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof TenantFeatures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<keyof TenantFeatures | null>(null);
  const [setupStatus, setSetupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [reportsStatus, setReportsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [recoverySetupStatus, setRecoverySetupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [recoverySetupError, setRecoverySetupError] = useState<string | null>(null);
  const [recoveryReportsStatus, setRecoveryReportsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [recoveryReportsError, setRecoveryReportsError] = useState<string | null>(null);
  const [collectionReportsStatus, setCollectionReportsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [collectionReportsError, setCollectionReportsError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/features");
      if (!res.ok) throw new Error("Failed to load features");
      const data = await res.json();
      setFeatures(data.features);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const handleToggle = async (key: keyof TenantFeatures, value: boolean) => {
    if (!features) return;
    setSaving(key);
    setError(null);

    const optimistic = { ...features, [key]: value };
    setFeatures(optimistic);

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
      setFeatures(data.features);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      setFeatures({ ...features });
      setError(err instanceof Error ? err.message : "Failed to save feature flag");
    } finally {
      setSaving(null);
    }
  };

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

  const handleSetupRecoveryDatatables = async () => {
    setRecoverySetupStatus("loading");
    setRecoverySetupError(null);
    const result = await setupRecoveryDatatables();
    if (result.success) {
      setRecoverySetupStatus("success");
      setTimeout(() => setRecoverySetupStatus("idle"), 3000);
    } else {
      setRecoverySetupStatus("error");
      setRecoverySetupError(result.error ?? "Setup failed");
    }
  };

  const handleSetupRecoveryReports = async () => {
    setRecoveryReportsStatus("loading");
    setRecoveryReportsError(null);
    const result = await setupRecoveriesReports();
    if (result.success) {
      setRecoveryReportsStatus("success");
      setTimeout(() => setRecoveryReportsStatus("idle"), 3000);
    } else {
      setRecoveryReportsStatus("error");
      setRecoveryReportsError(result.error ?? "Setup failed");
    }
  };

  const handleSetupCollectionReports = async () => {
    setCollectionReportsStatus("loading");
    setCollectionReportsError(null);
    const result = await setupBranchCollectionPerformanceReports();
    if (result.success) {
      setCollectionReportsStatus("success");
      setTimeout(() => setCollectionReportsStatus("idle"), 3000);
    } else {
      setCollectionReportsStatus("error");
      setCollectionReportsError(result.error ?? "Setup failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable product features for this tenant.
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
              {setupStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {setupStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />}
              {setupStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 py-2 border-b">
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
              {reportsStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {reportsStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />}
              {reportsStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 py-2 border-b">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Recovery Court Datatables</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register Fineract loan datatables for court cases and court proceedings.
              </p>
              {recoverySetupStatus === "error" && recoverySetupError && (
                <p className="text-xs text-destructive mt-1">{recoverySetupError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetupRecoveryDatatables}
              disabled={recoverySetupStatus === "loading"}
              className="shrink-0"
            >
              {recoverySetupStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {recoverySetupStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />}
              {recoverySetupStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 py-2 border-b">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Recovery Reports</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register Fineract stretchy reports for arrears, NPA, court cases, and court proceedings.
              </p>
              {recoveryReportsStatus === "error" && recoveryReportsError && (
                <p className="text-xs text-destructive mt-1">{recoveryReportsError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetupRecoveryReports}
              disabled={recoveryReportsStatus === "loading"}
              className="shrink-0"
            >
              {recoveryReportsStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {recoveryReportsStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />}
              {recoveryReportsStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Collection Performance Reports</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register the branch collection performance report for expected versus actual collections.
              </p>
              {collectionReportsStatus === "error" && collectionReportsError && (
                <p className="text-xs text-destructive mt-1">{collectionReportsError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetupCollectionReports}
              disabled={collectionReportsStatus === "loading"}
              className="shrink-0"
            >
              {collectionReportsStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {collectionReportsStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1.5" />}
              {collectionReportsStatus === "success" ? "Done" : "Run Setup"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Products &amp; Modules</CardTitle>
          <CardDescription className="text-xs">
            Changes take effect immediately for all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_CONFIGS.map((config) => {
            const value = Boolean(features?.[config.key] ?? false);
            const isSaving = saving === config.key;
            const isSaved = savedKey === config.key;

            return (
              <div
                key={config.key}
                className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`feature-${config.key}`} className="text-sm font-medium cursor-pointer">
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
                  <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Switch
                    id={`feature-${config.key}`}
                    checked={value}
                    onCheckedChange={(checked) => handleToggle(config.key, checked)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
