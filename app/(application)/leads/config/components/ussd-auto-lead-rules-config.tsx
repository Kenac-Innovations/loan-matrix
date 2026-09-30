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

type RuleDraft = {
  id: string;
  enabled: boolean;
  loanProductId: string;
  chargeIds: string[];
};

type LoanProduct = {
  id: number;
  name?: string;
  shortName?: string;
};

type SavedRule = {
  enabled?: boolean;
  loanProductId?: number | string;
  loanChargeAttachment?: {
    mode?: string;
    chargeIds?: Array<number | string>;
  };
};

type LoanCharge = {
  id?: number;
  chargeId?: number;
  name?: string;
  amount?: number;
  percentage?: number;
  active?: boolean;
  penalty?: boolean;
  currency?: { displaySymbol?: string; code?: string };
  chargeTimeType?: { code?: string; value?: string };
  chargeCalculationType?: { code?: string; value?: string };
};

const SALARY_ADVANCE_LOAN_PRODUCT_ID = "13";

function chargeId(charge: LoanCharge): number | null {
  const value = Number(charge.chargeId ?? charge.id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isOverdueOrPenaltyCharge(charge: LoanCharge): boolean {
  const timeType = `${charge.chargeTimeType?.code || ""} ${
    charge.chargeTimeType?.value || ""
  }`.toLowerCase();
  return charge.penalty === true || timeType.includes("overdue");
}

function isSpecifiedDueDateCharge(charge: LoanCharge): boolean {
  const timeType = `${charge.chargeTimeType?.code || ""} ${
    charge.chargeTimeType?.value || ""
  }`.toLowerCase();
  return (
    timeType.includes("specifiedduedate") ||
    timeType.includes("specified due date")
  );
}

function isEligibleCharge(charge: LoanCharge): boolean {
  return (
    chargeId(charge) !== null &&
    charge.active !== false &&
    !isOverdueOrPenaltyCharge(charge) &&
    !isSpecifiedDueDateCharge(charge)
  );
}

function chargeLabel(charge: LoanCharge): string {
  const value = charge.amount ?? charge.percentage;
  const calculation = `${charge.chargeCalculationType?.code || ""} ${
    charge.chargeCalculationType?.value || ""
  }`.toLowerCase();
  const suffix = calculation.includes("percent") ? "%" : "";
  const currency = charge.currency?.displaySymbol || charge.currency?.code || "";
  return `${charge.name || `Charge ${chargeId(charge)}`} (${currency}${
    value ?? 0
  }${suffix})`;
}

function makeRuleDraft(): RuleDraft {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    loanProductId: "",
    chargeIds: [],
  };
}

export function UssdAutoLeadRulesConfig() {
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [chargesByProduct, setChargesByProduct] = useState<
    Record<string, LoanCharge[]>
  >({});
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
          ? (rulesData.rules as SavedRule[]).map((rule) => ({
              id: `rule-${rule.loanProductId}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
              enabled: rule.enabled !== false,
              loanProductId: String(rule.loanProductId ?? ""),
              chargeIds:
                rule.loanChargeAttachment?.mode === "SELECTED" &&
                Array.isArray(rule.loanChargeAttachment.chargeIds)
                  ? rule.loanChargeAttachment.chargeIds.map(String)
                  : [],
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

  const selectedProductIds = Array.from(
    new Set(
      rules
        .map((rule) => rule.loanProductId)
        .filter((loanProductId) => /^\d+$/.test(loanProductId))
    )
  )
    .sort()
    .join(",");

  useEffect(() => {
    const productIds = selectedProductIds ? selectedProductIds.split(",") : [];
    if (productIds.length === 0) {
      return;
    }

    let cancelled = false;

    Promise.all(
      productIds.map(async (productId) => {
        const response = await fetch(
          `/api/fineract/loanproducts/${productId}?template=true`
        );
        if (!response.ok) {
          throw new Error("Failed to load the product charge configuration");
        }
        const template = await response.json();
        return [
          productId,
          Array.isArray(template?.charges)
            ? template.charges.filter(isEligibleCharge)
            : [],
        ] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setChargesByProduct((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading USSD product charges:", error);
          toast.error("Failed to load the product charge configuration");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProductIds]);

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
        loanChargeAttachment:
          rule.chargeIds.length > 0
            ? {
                mode: "SELECTED",
                chargeIds: rule.chargeIds.map(Number),
              }
            : { mode: "NONE" },
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
        ? (data.rules as SavedRule[]).map((rule) => ({
            id: `rule-${rule.loanProductId}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            enabled: rule.enabled !== false,
            loanProductId: String(rule.loanProductId ?? ""),
            chargeIds:
              rule.loanChargeAttachment?.mode === "SELECTED" &&
              Array.isArray(rule.loanChargeAttachment.chargeIds)
                ? rule.loanChargeAttachment.chargeIds.map(String)
                : [],
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
                  updateRule(rule.id, { loanProductId: value, chargeIds: [] })
                }
                placeholder="Select loan product"
                emptyMessage="No loan products found"
              />
            </div>

            {rule.loanProductId === SALARY_ADVANCE_LOAN_PRODUCT_ID ? (
              <div className="space-y-3 rounded-lg border p-3">
              <div>
                <Label>Loan Charge Attachment</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select the product charges to include when a USSD loan is
                  created. Fineract remains the source of the charge amounts;
                  overdue penalties and specified-due-date charges are
                  excluded.
                </p>
              </div>

              {!rule.loanProductId ? (
                <p className="text-sm text-muted-foreground">
                  Select a loan product to configure its charges.
                </p>
              ) : !Object.prototype.hasOwnProperty.call(
                  chargesByProduct,
                  rule.loanProductId
                ) ? (
                <p className="text-sm text-muted-foreground">
                  Loading product charges...
                </p>
              ) : (chargesByProduct[rule.loanProductId] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This product has no eligible configured charges.
                </p>
              ) : (
                <div className="space-y-2">
                  {(chargesByProduct[rule.loanProductId] || []).map((charge) => {
                    const configuredChargeId = chargeId(charge);
                    if (configuredChargeId === null) return null;
                    const checked = rule.chargeIds.includes(
                      String(configuredChargeId)
                    );

                    return (
                      <label
                        key={configuredChargeId}
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) =>
                            updateRule(rule.id, {
                              chargeIds: nextChecked
                                ? [
                                    ...rule.chargeIds,
                                    String(configuredChargeId),
                                  ]
                                : rule.chargeIds.filter(
                                    (id) => id !== String(configuredChargeId)
                                  ),
                            })
                          }
                        />
                        <span className="text-sm">
                          <span className="font-medium">{chargeLabel(charge)}</span>
                          <span className="mt-1 block text-muted-foreground">
                            {charge.chargeTimeType?.value ||
                              charge.chargeTimeType?.code ||
                              "Configured at loan creation"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Charge attachment is currently available only for Goodfellow
                Salary Advance (product 13). Other USSD products keep their
                existing loan-creation workflows.
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
