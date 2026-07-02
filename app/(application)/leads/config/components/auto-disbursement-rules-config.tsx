"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/searchable-select";
import type { AutoDisbursementDecision } from "@/shared/types/tenant";

type RuleDraft = {
  id: string;
  enabled: boolean;
  loanProductId: string;
  triggerStageId: string;
  allowedCdeDecisions: AutoDisbursementDecision[];
};

type LoanProduct = {
  id: number;
  name?: string;
  shortName?: string;
};

type PipelineStage = {
  id: string;
  name: string;
  fineractAction?: string | null;
  fineractStatus?: string | null;
  order?: number | null;
};

const DEFAULT_SUPPORTED_DECISIONS: AutoDisbursementDecision[] = [
  "APPROVED",
  "MANUAL_REVIEW",
  "DECLINED",
];

function makeRuleDraft(): RuleDraft {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    loanProductId: "",
    triggerStageId: "",
    allowedCdeDecisions: ["APPROVED"],
  };
}

export function AutoDisbursementRulesConfig() {
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [supportedDecisions, setSupportedDecisions] = useState<
    AutoDisbursementDecision[]
  >(DEFAULT_SUPPORTED_DECISIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("[]");

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);

        const [rulesResponse, stagesResponse, productsResponse] =
          await Promise.all([
            fetch("/api/tenant/auto-disbursement-rules"),
            fetch("/api/pipeline/stages"),
            fetch("/api/fineract/loanproducts"),
          ]);

        if (!rulesResponse.ok) {
          throw new Error("Failed to load auto-disbursement rules");
        }

        if (!stagesResponse.ok) {
          throw new Error("Failed to load pipeline stages");
        }

        if (!productsResponse.ok) {
          throw new Error("Failed to load loan products");
        }

        const [rulesData, stagesData, productsData] = await Promise.all([
          rulesResponse.json(),
          stagesResponse.json(),
          productsResponse.json(),
        ]);

        const nextRules = Array.isArray(rulesData.rules)
          ? rulesData.rules.map((rule: any) => ({
              id: `rule-${rule.loanProductId}-${rule.triggerStageId}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
              enabled: rule.enabled !== false,
              loanProductId: String(rule.loanProductId ?? ""),
              triggerStageId: String(rule.triggerStageId ?? ""),
              allowedCdeDecisions: Array.isArray(rule.allowedCdeDecisions)
                ? rule.allowedCdeDecisions
                : ["APPROVED"],
            }))
          : [];

        const nextStages = Array.isArray(stagesData.stages)
          ? [...stagesData.stages].sort(
              (left: PipelineStage, right: PipelineStage) =>
                Number(left.order || 0) - Number(right.order || 0)
            )
          : [];

        const rawProducts = Array.isArray(productsData)
          ? productsData
          : productsData?.pageItems ?? [];

        setRules(nextRules);
        setSavedSnapshot(JSON.stringify(nextRules));
        setStages(nextStages);
        setLoanProducts(Array.isArray(rawProducts) ? rawProducts : []);
        setSupportedDecisions(
          Array.isArray(rulesData.supportedDecisions) &&
            rulesData.supportedDecisions.length > 0
            ? rulesData.supportedDecisions
            : DEFAULT_SUPPORTED_DECISIONS
        );
      } catch (error) {
        console.error("Error loading auto-disbursement config:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load auto-disbursement configuration"
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

  const stageOptions = stages.map((stage) => ({
    value: stage.id,
    label: `${stage.name}${
      stage.fineractAction ? ` (${stage.fineractAction})` : ""
    }`,
    shortLabel: stage.name,
  }));

  const updateRule = (ruleId: string, patch: Partial<RuleDraft>) => {
    setRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      )
    );
  };

  const toggleDecision = (
    ruleId: string,
    decision: AutoDisbursementDecision,
    checked: boolean
  ) => {
    setRules((currentRules) =>
      currentRules.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }

        const nextDecisions = checked
          ? Array.from(new Set([...rule.allowedCdeDecisions, decision]))
          : rule.allowedCdeDecisions.filter((item) => item !== decision);

        return {
          ...rule,
          allowedCdeDecisions: nextDecisions,
        };
      })
    );
  };

  const handleSave = async () => {
    const hasInvalidRule = rules.some(
      (rule) =>
        !rule.loanProductId ||
        !rule.triggerStageId ||
        rule.allowedCdeDecisions.length === 0
    );

    if (hasInvalidRule) {
      toast.error(
        "Each rule needs a loan product, a trigger stage, and at least one allowed CDE decision."
      );
      return;
    }

    setSaving(true);
    try {
      const payload = rules.map((rule) => ({
        enabled: rule.enabled,
        loanProductId: Number(rule.loanProductId),
        triggerStageId: rule.triggerStageId,
        allowedCdeDecisions: rule.allowedCdeDecisions,
      }));

      const response = await fetch("/api/tenant/auto-disbursement-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: payload }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save auto-disbursement rules");
      }

      const nextRules = Array.isArray(data?.rules)
        ? data.rules.map((rule: any) => ({
            id: `rule-${rule.loanProductId}-${rule.triggerStageId}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            enabled: rule.enabled !== false,
            loanProductId: String(rule.loanProductId ?? ""),
            triggerStageId: String(rule.triggerStageId ?? ""),
            allowedCdeDecisions: Array.isArray(rule.allowedCdeDecisions)
              ? rule.allowedCdeDecisions
              : ["APPROVED"],
          }))
        : [];

      setRules(nextRules);
      setSavedSnapshot(JSON.stringify(nextRules));
      toast.success("Auto-disbursement rules saved successfully");
    } catch (error) {
      console.error("Error saving auto-disbursement rules:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save auto-disbursement rules"
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
          Loading auto-disbursement rules...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Auto Disbursement Rules</h3>
          <p className="text-sm text-muted-foreground">
            Choose which product and stage combinations should call CDE and then
            auto-progress through to disbursement.
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
            No rules configured yet. Add a rule to start auto-progressing eligible
            leads after CDE evaluation.
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
                  Match one product at one trigger stage.
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
                  Disabled rules stay saved but will not trigger automation.
                </p>
              </div>
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) =>
                  updateRule(rule.id, { enabled: Boolean(checked) })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2">
                <Label>Trigger Stage</Label>
                <SearchableSelect
                  options={stageOptions}
                  value={rule.triggerStageId}
                  onValueChange={(value) =>
                    updateRule(rule.id, { triggerStageId: value })
                  }
                  placeholder="Select pipeline stage"
                  emptyMessage="No stages found"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Allowed CDE Decisions</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {supportedDecisions.map((decision) => (
                  <label
                    key={`${rule.id}-${decision}`}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={rule.allowedCdeDecisions.includes(decision)}
                      onCheckedChange={(checked) =>
                        toggleDecision(rule.id, decision, checked === true)
                      }
                    />
                    <span>{decision}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
