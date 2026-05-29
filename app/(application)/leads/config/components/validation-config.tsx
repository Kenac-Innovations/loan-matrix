"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Pencil, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ConditionRule {
  field: string;
  operator: string;
  value?: any;
}

interface DbValidationRule {
  id?: string;
  name: string;
  description: string | null;
  tab: string | null;
  severity: string;
  enabled: boolean;
  order: number;
  pipelineStageId: string | null;
  conditions: { type: "AND" | "OR"; rules: ConditionRule[] };
  actions: {
    onPass: { message: string };
    onFail: { message: string; suggestedAction?: string; actionUrl?: string };
  };
}

const TABS = [
  { value: "details", label: "Details" },
  { value: "documents", label: "Documents" },
  { value: "communication", label: "Communication" },
  { value: "appraisal", label: "Appraisal" },
  { value: "notes", label: "Notes" },
];

const SEVERITY_OPTIONS = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error (Blocking)" },
];

const FIELD_OPTIONS = [
  { value: "firstname", label: "First Name", group: "lead" },
  { value: "lastname", label: "Last Name", group: "lead" },
  { value: "mobileNo", label: "Phone Number", group: "lead" },
  { value: "emailAddress", label: "Email Address", group: "lead" },
  { value: "externalId", label: "NRC / External ID", group: "lead" },
  { value: "dateOfBirth", label: "Date of Birth", group: "lead" },
  { value: "requestedAmount", label: "Requested Amount", group: "lead" },
  { value: "loanProductId", label: "Loan Product ID", group: "lead" },
  { value: "loanProductName", label: "Loan Product Name", group: "lead" },
  { value: "monthlyIncome", label: "Monthly Income", group: "lead" },
  { value: "totalDebt", label: "Total Debt", group: "lead" },
  { value: "collateralValue", label: "Collateral Value", group: "lead" },
  { value: "employerName", label: "Employer Name", group: "lead" },
  { value: "nationality", label: "Nationality", group: "lead" },
  { value: "requiredDocuments", label: "Required Documents", group: "special" },
  { value: "communications", label: "Communications", group: "special" },
  { value: "appraisal", label: "Appraisal Items", group: "special" },
  { value: "debtToIncomeRatio", label: "Debt-to-Income Ratio", group: "computed" },
  { value: "collateralRatio", label: "Collateral Ratio", group: "computed" },
];

const OPERATOR_MAP: Record<string, { value: string; label: string; needsValue: boolean }[]> = {
  lead: [
    { value: "isNotEmpty", label: "Is not empty", needsValue: false },
    { value: "isEmpty", label: "Is empty", needsValue: false },
    { value: "equals", label: "Equals", needsValue: true },
    { value: "notEquals", label: "Not equals", needsValue: true },
    { value: "greaterThan", label: "Greater than", needsValue: true },
    { value: "greaterThanOrEqual", label: "≥ (greater or equal)", needsValue: true },
    { value: "lessThan", label: "Less than", needsValue: true },
    { value: "lessThanOrEqual", label: "≤ (less or equal)", needsValue: true },
    { value: "contains", label: "Contains", needsValue: true },
    { value: "isValidEmail", label: "Is valid email", needsValue: false },
    { value: "isValidPhone", label: "Is valid phone", needsValue: false },
  ],
  requiredDocuments: [
    { value: "allUploaded", label: "All required uploaded", needsValue: false },
    { value: "anyUploaded", label: "Any uploaded", needsValue: false },
  ],
  communications: [
    { value: "hasContactPerson", label: "Has contact person", needsValue: true },
    { value: "hasMinimumCount", label: "Has minimum count", needsValue: true },
    { value: "hasAnyComms", label: "Has any communications", needsValue: false },
  ],
  appraisal: [
    { value: "hasMinimumCount", label: "Has minimum items", needsValue: true },
    { value: "hasAnyItems", label: "Has any items", needsValue: false },
    { value: "coverageAbove", label: "Coverage % above", needsValue: true },
  ],
  computed: [
    { value: "lessThan", label: "Less than", needsValue: true },
    { value: "lessThanOrEqual", label: "≤ (less or equal)", needsValue: true },
    { value: "greaterThan", label: "Greater than", needsValue: true },
    { value: "greaterThanOrEqual", label: "≥ (greater or equal)", needsValue: true },
  ],
};

function getFieldGroup(field: string): string {
  return FIELD_OPTIONS.find((f) => f.value === field)?.group || "lead";
}

function getOperatorsForField(field: string) {
  const group = getFieldGroup(field);
  return OPERATOR_MAP[group] || OPERATOR_MAP.lead;
}

function emptyRule(): DbValidationRule {
  return {
    name: "",
    description: null,
    tab: "details",
    severity: "error",
    enabled: true,
    order: 0,
    pipelineStageId: null,
    conditions: { type: "AND", rules: [] },
    actions: {
      onPass: { message: "" },
      onFail: { message: "" },
    },
  };
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "info": return "bg-blue-100 text-blue-700 border-blue-200";
    case "warning": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "error": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function getOperatorLabel(field: string, operator: string): string {
  const ops = getOperatorsForField(field);
  return ops.find((o) => o.value === operator)?.label || operator;
}

function getFieldLabel(field: string): string {
  return FIELD_OPTIONS.find((f) => f.value === field)?.label || field;
}

export function ValidationConfig() {
  const [rules, setRules] = useState<DbValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DbValidationRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const [newCondField, setNewCondField] = useState("");
  const [newCondOp, setNewCondOp] = useState("");
  const [newCondValue, setNewCondValue] = useState("");

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/validation-rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (e) {
      console.error("Error fetching validation rules:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreateModal = () => {
    setEditingRule({ ...emptyRule(), order: rules.length });
    setIsEditing(false);
    setNewCondField("");
    setNewCondOp("");
    setNewCondValue("");
    setModalOpen(true);
  };

  const openEditModal = (rule: DbValidationRule) => {
    setEditingRule(structuredClone(rule));
    setIsEditing(true);
    setNewCondField("");
    setNewCondOp("");
    setNewCondValue("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingRule || !editingRule.name.trim()) return;
    if (editingRule.conditions.rules.length === 0) {
      toast({ title: "Error", description: "Add at least one condition", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const method = isEditing ? "PUT" : "POST";
      const url = isEditing
        ? `/api/validation-rules/${editingRule.id}`
        : "/api/validation-rules";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingRule.name,
          description: editingRule.description || null,
          tab: editingRule.tab || null,
          severity: editingRule.severity,
          enabled: editingRule.enabled,
          order: editingRule.order,
          pipelineStageId: editingRule.pipelineStageId || null,
          conditions: editingRule.conditions,
          actions: editingRule.actions,
        }),
      });

      if (res.ok) {
        toast({
          title: isEditing ? "Rule Updated" : "Rule Created",
          description: `"${editingRule.name}" has been saved.`,
        });
        await fetchRules();
        setModalOpen(false);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to save", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to save validation rule", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: DbValidationRule) => {
    if (!rule.id) return;
    try {
      const res = await fetch(`/api/validation-rules/${rule.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Deleted", description: `"${rule.name}" removed.` });
        await fetchRules();
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (rule: DbValidationRule) => {
    if (!rule.id) return;
    try {
      const res = await fetch(`/api/validation-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        await fetchRules();
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to toggle rule", variant: "destructive" });
    }
  };

  const addCondition = () => {
    if (!editingRule || !newCondField || !newCondOp) return;
    const ops = getOperatorsForField(newCondField);
    const needsValue = ops.find((o) => o.value === newCondOp)?.needsValue;
    if (needsValue && !newCondValue) return;

    const condition: ConditionRule = {
      field: newCondField,
      operator: newCondOp,
      ...(needsValue && { value: newCondValue }),
    };
    setEditingRule({
      ...editingRule,
      conditions: {
        ...editingRule.conditions,
        rules: [...editingRule.conditions.rules, condition],
      },
    });
    setNewCondField("");
    setNewCondOp("");
    setNewCondValue("");
  };

  const removeCondition = (index: number) => {
    if (!editingRule) return;
    const updated = [...editingRule.conditions.rules];
    updated.splice(index, 1);
    setEditingRule({
      ...editingRule,
      conditions: { ...editingRule.conditions, rules: updated },
    });
  };

  const currentOperators = newCondField ? getOperatorsForField(newCondField) : [];
  const needsValue = currentOperators.find((o) => o.value === newCondOp)?.needsValue ?? false;

  const rulesByTab = rules.reduce<Record<string, DbValidationRule[]>>((acc, rule) => {
    const tab = rule.tab || "general";
    if (!acc[tab]) acc[tab] = [];
    acc[tab].push(rule);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading validation rules...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button onClick={openCreateModal} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <p>No validation rules configured yet.</p>
            <p className="text-sm mt-1">Add rules to validate lead data on each tab.</p>
          </div>
        ) : (
          Object.entries(rulesByTab)
            .sort(([a], [b]) => {
              const tabOrder = TABS.map((t) => t.value);
              return (tabOrder.indexOf(a) === -1 ? 99 : tabOrder.indexOf(a)) -
                     (tabOrder.indexOf(b) === -1 ? 99 : tabOrder.indexOf(b));
            })
            .map(([tab, tabRules]) => (
              <div key={tab} className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {TABS.find((t) => t.value === tab)?.label || tab}
                </h4>
                <div className="space-y-2">
                  {tabRules
                    .sort((a, b) => a.order - b.order)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          rule.enabled ? "bg-background" : "bg-muted/40 opacity-60"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{rule.name}</span>
                            <Badge className={`text-xs ${getSeverityColor(rule.severity)}`}>
                              {rule.severity}
                            </Badge>
                            {!rule.enabled && (
                              <Badge variant="secondary" className="text-xs">Disabled</Badge>
                            )}
                          </div>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {rule.conditions?.rules?.map((cond, i) => (
                              <Badge key={i} variant="outline" className="text-xs font-mono">
                                {getFieldLabel(cond.field)} {getOperatorLabel(cond.field, cond.operator)}
                                {cond.value !== undefined ? ` ${cond.value}` : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggleEnabled(rule)}
                            className="mr-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditModal(rule)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(rule)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Validation Rule" : "Add Validation Rule"}</DialogTitle>
            <DialogDescription>
              Configure a validation check for lead data.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name *</Label>
                  <Input
                    placeholder="e.g. Client name required"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tab *</Label>
                  <Select
                    value={editingRule.tab || "details"}
                    onValueChange={(v) => setEditingRule({ ...editingRule, tab: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TABS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="What does this rule check?"
                  value={editingRule.description || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={editingRule.severity}
                    onValueChange={(v) => setEditingRule({ ...editingRule, severity: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condition Logic</Label>
                  <Select
                    value={editingRule.conditions.type}
                    onValueChange={(v) =>
                      setEditingRule({
                        ...editingRule,
                        conditions: { ...editingRule.conditions, type: v as "AND" | "OR" },
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">ALL conditions must pass (AND)</SelectItem>
                      <SelectItem value="OR">ANY condition must pass (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Enabled</Label>
                  <p className="text-xs text-muted-foreground">Disabled rules are skipped</p>
                </div>
                <Switch
                  checked={editingRule.enabled}
                  onCheckedChange={(checked) => setEditingRule({ ...editingRule, enabled: checked })}
                />
              </div>

              {/* Conditions */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Conditions</h4>

                {editingRule.conditions.rules.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {editingRule.conditions.rules.map((cond, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
                      >
                        <span className="text-sm">
                          <span className="font-medium">{getFieldLabel(cond.field)}</span>{" "}
                          <span className="text-muted-foreground">{getOperatorLabel(cond.field, cond.operator)}</span>
                          {cond.value !== undefined && (
                            <span className="font-mono ml-1">{String(cond.value)}</span>
                          )}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCondition(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={newCondField}
                    onValueChange={(v) => { setNewCondField(v); setNewCondOp(""); setNewCondValue(""); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Field" /></SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={newCondOp}
                    onValueChange={(v) => setNewCondOp(v)}
                    disabled={!newCondField}
                  >
                    <SelectTrigger><SelectValue placeholder="Operator" /></SelectTrigger>
                    <SelectContent>
                      {currentOperators.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {needsValue ? (
                    <Input
                      placeholder="Value"
                      value={newCondValue}
                      onChange={(e) => setNewCondValue(e.target.value)}
                    />
                  ) : (
                    <div />
                  )}
                </div>

                <Button
                  onClick={addCondition}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={!newCondField || !newCondOp || (needsValue && !newCondValue)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Condition
                </Button>
              </div>

              {/* Actions (pass/fail messages) */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Messages</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-green-700">On Pass</Label>
                    <Input
                      placeholder="e.g. Name provided"
                      value={editingRule.actions?.onPass?.message || ""}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          actions: {
                            ...editingRule.actions,
                            onPass: { message: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-red-700">On Fail</Label>
                    <Input
                      placeholder="e.g. First name and last name required"
                      value={editingRule.actions?.onFail?.message || ""}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          actions: {
                            ...editingRule.actions,
                            onFail: { ...editingRule.actions.onFail, message: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !editingRule?.name.trim() || (editingRule?.conditions.rules.length ?? 0) === 0}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <>{isEditing ? "Update" : "Add"} Rule</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
