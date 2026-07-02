"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/searchable-select";

type RuleDraft = {
  id: string;
  enabled: boolean;
  loanProductId: string;
};

type LoanProduct = {
  id: number;
  name?: string;
  shortName?: string;
};

function makeRuleDraft(): RuleDraft {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    loanProductId: "",
  };
}

export function UssdAutoLeadRulesConfig() {
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("[]");

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);

        const [rulesResponse, productsResponse] = await Promise.all([
          fetch("/api/tenant/ussd-auto-lead-rules"),
          fetch("/api/fineract/loanproducts"),
        ]);

        if (!rulesResponse.ok) {
          throw new Error("Failed to load USSD auto-lead rules");
        }

        if (!productsResponse.ok) {
          throw new Error("Failed to load loan products");
        }

        const [rulesData, productsData] = await Promise.all([
          rulesResponse.json(),
          productsResponse.json(),
        ]);

        const nextRules = Array.isArray(rulesData.rules)
          ? rulesData.rules.map((rule: any) => ({
              id: `rule-${rule.loanProductId}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
              enabled: rule.enabled !== false,
              loanProductId: String(rule.loanProductId ?? ""),
            }))
          : [];

        const rawProducts = Array.isArray(productsData)
          ? productsData
          : productsData?.pageItems ?? [];

        setRules(nextRules);
        setSavedSnapshot(JSON.stringify(nextRules));
        setLoanProducts(Array.isArray(rawProducts) ? rawProducts : []);
      } catch (error) {
        console.error("Error loading USSD auto-lead config:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load USSD auto-lead configuration"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const hasChanges = JSON.stringify(rules) !== savedSnapshot;

  const productOptions = loanProducts.map((product) => ({
    value: String(product.id),
    label: `${product.id} - ${product.name || product.shortName || "Unnamed product"}`,
    shortLabel: product.name || product.shortName || String(product.id),
  }));

  const updateRule = (ruleId: string, patch: Partial<RuleDraft>) => {
    setRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      )
    );
  };

  const handleSave = async () => {
    const hasInvalidRule = rules.some((rule) => !rule.loanProductId);

    if (hasInvalidRule) {
      toast.error("Each rule needs a loan product.");
      return;
    }

    setSaving(true);
    try {
      const payload = rules.map((rule) => ({
        enabled: rule.enabled,
        loanProductId: Number(rule.loanProductId),
      }));

      const response = await fetch("/api/tenant/ussd-auto-lead-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: payload }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save USSD auto-lead rules");
      }

      const nextRules = Array.isArray(data?.rules)
        ? data.rules.map((rule: any) => ({
            id: `rule-${rule.loanProductId}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            enabled: rule.enabled !== false,
            loanProductId: String(rule.loanProductId ?? ""),
          }))
        : [];

      setRules(nextRules);
      setSavedSnapshot(JSON.stringify(nextRules));
      toast.success("USSD auto-lead rules saved successfully");
    } catch (error) {
      console.error("Error saving USSD auto-lead rules:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save USSD auto-lead rules"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Loading USSD auto-lead rules...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">USSD Auto Lead Rules</h3>
          <p className="text-sm text-muted-foreground">
            Automatically create leads for matching USSD applications as soon as
            the consumer stores them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setRules((currentRules) => [...currentRules, makeRuleDraft()])}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Rules
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No rules configured yet. Add a rule to start creating leads from
            eligible USSD applications automatically.
          </CardContent>
        </Card>
      ) : null}

      {rules.map((rule, index) => (
        <Card key={rule.id}>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Rule {index + 1}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Match one loan product and auto-create a lead on ingest.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setRules((currentRules) =>
                    currentRules.filter((item) => item.id !== rule.id)
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Rule Enabled</p>
                <p className="text-sm text-muted-foreground">
                  Disabled rules stay saved but will not create leads.
                </p>
              </div>
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) =>
                  updateRule(rule.id, { enabled: Boolean(checked) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Loan Product</Label>
              <SearchableSelect
                options={productOptions}
                value={rule.loanProductId}
                onValueChange={(value) =>
                  updateRule(rule.id, { loanProductId: value })
                }
                placeholder="Select loan product"
                emptyMessage="No loan products found"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
