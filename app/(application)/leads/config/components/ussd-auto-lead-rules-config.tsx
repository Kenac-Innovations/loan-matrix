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
  chargeAppliesTo?: { code?: string; value?: string };
  chargeTimeType?: { code?: string; value?: string };
  chargeCalculationType?: { code?: string; value?: string };
};

const SALARY_ADVANCE_LOAN_PRODUCT_ID = "13";

function chargeId(charge: LoanCharge): number | null {
  const value = Number(charge.chargeId ?? charge.id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeOptionValue(value: string | undefined): string {
  return (value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function isSpecifiedDueDateCharge(charge: LoanCharge): boolean {
  const timeTypeCode = normalizeOptionValue(charge.chargeTimeType?.code);
  const timeTypeValue = normalizeOptionValue(charge.chargeTimeType?.value);

  return (
    timeTypeCode === "chargetimetype.specifiedduedate" ||
    timeTypeValue === "specifiedduedate"
  );
}

function isLoanCharge(charge: LoanCharge): boolean {
  const appliesToCode = normalizeOptionValue(charge.chargeAppliesTo?.code);
  const appliesToValue = normalizeOptionValue(charge.chargeAppliesTo?.value);

  return (
    appliesToCode === "chargeappliesto.loan" ||
    appliesToValue === "loan"
  );
}

function isEligibleCharge(charge: LoanCharge): boolean {
  return (
    chargeId(charge) !== null &&
    charge.active === true &&
    charge.penalty !== true &&
    isLoanCharge(charge) &&
    isSpecifiedDueDateCharge(charge)
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
  const [charges, setCharges] = useState<LoanCharge[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargePoolLoaded, setChargePoolLoaded] = useState(false);
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

  const hasSalaryAdvanceRule = rules.some(
    (rule) => rule.loanProductId === SALARY_ADVANCE_LOAN_PRODUCT_ID
  );

  useEffect(() => {
    if (!hasSalaryAdvanceRule) {
      return;
    }

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) {
          throw new Error("Charge pool request cancelled");
        }
        setChargesLoading(true);
        setChargePoolLoaded(false);
        return fetch("/api/fineract/charges", { cache: "no-store" });
      })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load the Fineract charge pool");
        }

        const payload = await response.json();
        let rawCharges: unknown[] | null = null;
        if (Array.isArray(payload)) {
          rawCharges = payload;
        } else if (Array.isArray(payload?.pageItems)) {
          rawCharges = payload.pageItems;
        } else if (Array.isArray(payload?.content)) {
          rawCharges = payload.content;
        }

        if (rawCharges === null) {
          throw new Error("Fineract returned an unrecognised charge pool response");
        }

        return rawCharges.filter(isEligibleCharge) as LoanCharge[];
      })
      .then((eligibleCharges) => {
        if (cancelled) return;
        setCharges(eligibleCharges);
        setChargePoolLoaded(true);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading USSD charge pool:", error);
          setCharges([]);
          setChargePoolLoaded(false);
          toast.error("Failed to load the Fineract charge pool");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChargesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasSalaryAdvanceRule]);

  const hasChanges = JSON.stringify(rules) !== savedSnapshot;

  const eligibleChargeIds = new Set(
    charges
      .map(chargeId)
      .filter((id): id is number => id !== null)
      .map(String)
  );

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
        ...(rule.loanProductId === SALARY_ADVANCE_LOAN_PRODUCT_ID
          ? {
              loanChargeAttachment:
                rule.chargeIds.length > 0
                  ? {
                      mode: "SELECTED",
                      chargeIds: rule.chargeIds.map(Number),
                    }
                  : { mode: "NONE" },
            }
          : {}),
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
                  Select active Fineract loan charges that are applied on a
                  specified due date. Fineract remains the source of the
                  charge amounts and due-date behavior.
                </p>
              </div>

              {chargesLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading eligible Fineract charges...
                </p>
              ) : charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active loan charges with a specified due date are
                  available.
                </p>
              ) : (
                <div className="space-y-2">
                  {charges.map((charge) => {
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
              {chargePoolLoaded &&
              !chargesLoading &&
              rule.chargeIds.some((id) => !eligibleChargeIds.has(id)) ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p>
                    Some legacy charge selections are no longer eligible for
                    Salary Advance because they are not active loan charges
                    with a specified due date: {rule.chargeIds
                      .filter((id) => !eligibleChargeIds.has(id))
                      .join(", ")}
                    . Remove them before saving a new charge selection.
                  </p>
                  <Button
                    type="button"
                    className="mt-2"
                    onClick={() =>
                      updateRule(rule.id, {
                        chargeIds: rule.chargeIds.filter((id) =>
                          eligibleChargeIds.has(id)
                        ),
                      })
                    }
                    size="sm"
                    variant="outline"
                  >
                    Remove ineligible selections
                  </Button>
                </div>
              ) : null}
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
