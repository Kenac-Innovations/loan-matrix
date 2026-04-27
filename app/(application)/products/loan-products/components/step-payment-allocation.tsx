"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  AllocationRuleItem,
  CreditAllocationEntry,
  LoanProductFormData,
  LoanProductTemplate,
  PaymentAllocationEntry,
} from "@/shared/types/loan-product";

interface StepPaymentAllocationProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

// ─── Sortable row ──────────────────────────────────────────────────────────────

function SortableRuleRow({ item }: { item: AllocationRuleItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-sm select-none",
        isDragging && "z-50 shadow-lg opacity-80"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1">{item.value}</span>
    </div>
  );
}

// ─── Sortable list ─────────────────────────────────────────────────────────────

function SortableList({
  items,
  onReorder,
}: {
  items: AllocationRuleItem[];
  onReorder: (next: AllocationRuleItem[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map((item) => (
            <SortableRuleRow key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Payment allocation tab content ───────────────────────────────────────────

function PaymentAllocationTabContent({
  entry,
  futureInstallmentRules,
  onReorder,
  onFutureRuleChange,
  onRemove,
}: {
  entry: PaymentAllocationEntry;
  futureInstallmentRules: Array<{ id: number; code: string; value: string }>;
  onReorder: (next: AllocationRuleItem[]) => void;
  onFutureRuleChange: (code: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">
          Drag rows to set the payment allocation priority order.
        </p>
        {!entry.isDefault && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <SortableList items={entry.paymentAllocationOrder} onReorder={onReorder} />

      {futureInstallmentRules.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Future Installment Allocation Rule</Label>
          <Select value={entry.futureInstallmentAllocationRule} onValueChange={onFutureRuleChange}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select rule…" />
            </SelectTrigger>
            <SelectContent>
              {futureInstallmentRules.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ─── Credit allocation tab content ────────────────────────────────────────────

function CreditAllocationTabContent({
  entry,
  onReorder,
  onRemove,
}: {
  entry: CreditAllocationEntry;
  onReorder: (next: AllocationRuleItem[]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">
          Drag rows to set the credit allocation priority order.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
      <SortableList items={entry.creditAllocationOrder} onReorder={onReorder} />
    </div>
  );
}

// ─── Add transaction type dialog ───────────────────────────────────────────────

function AddTransactionDialog({
  open,
  paymentTxTypes: allPaymentTxTypes,
  creditTxTypes: allCreditTxTypes,
  usedPaymentCodes,
  usedCreditCodes,
  onAdd,
  onClose,
}: {
  open: boolean;
  paymentTxTypes: Array<{ id: number; code: string; value: string }>;
  creditTxTypes: Array<{ id: number; code: string; value: string }>;
  usedPaymentCodes: Set<string>;
  usedCreditCodes: Set<string>;
  onAdd: (code: string, isCredit: boolean) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState("");

  const available = [
    ...allPaymentTxTypes
      .filter((t) => !usedPaymentCodes.has(t.code) && t.code !== "DEFAULT")
      .map((t) => ({ ...t, isCredit: false, label: t.value })),
    ...allCreditTxTypes
      .filter((t) => !usedCreditCodes.has(t.code))
      .map((t) => ({ ...t, isCredit: true, label: `${t.value} (Credit)` })),
  ];

  const handleAdd = () => {
    const found = available.find((a) => `${a.isCredit ? "credit" : "payment"}:${a.code}` === selected);
    if (found) {
      onAdd(found.code, found.isCredit);
      setSelected("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Transaction Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Transaction Type</Label>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">All available transaction types have been added.</p>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select transaction type…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((a) => (
                  <SelectItem key={`${a.isCredit ? "credit" : "payment"}:${a.code}`} value={`${a.isCredit ? "credit" : "payment"}:${a.code}`}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main step ─────────────────────────────────────────────────────────────────

export function StepPaymentAllocation({ form, template, onChange }: StepPaymentAllocationProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  const futureInstallmentRules = template.advancedPaymentAllocationFutureInstallmentAllocationRules ?? [];
  const paymentTxTypes = template.advancedPaymentAllocationTransactionTypes ?? [];
  const allocationTypes = template.advancedPaymentAllocationTypes ?? [];
  const creditTxTypes = template.creditAllocationTransactionTypes ?? [];
  const creditAllocationTypes = template.creditAllocationAllocationTypes ?? [];

  const paymentAllocations = form.paymentAllocations;
  const creditAllocations = form.creditAllocations;

  const usedPaymentCodes = new Set(paymentAllocations.map((e) => e.transactionTypeCode));
  const usedCreditCodes = new Set(creditAllocations.map((e) => e.transactionTypeCode));

  // Build a stable tab id so active tab doesn't jump unexpectedly
  const tabId = (prefix: string, code: string) => `${prefix}-${code}`;

  const updatePaymentEntry = (
    code: string,
    patch: Partial<PaymentAllocationEntry>
  ) => {
    onChange({
      paymentAllocations: paymentAllocations.map((e) =>
        e.transactionTypeCode === code ? { ...e, ...patch } : e
      ),
    });
  };

  const updateCreditEntry = (
    code: string,
    patch: Partial<CreditAllocationEntry>
  ) => {
    onChange({
      creditAllocations: creditAllocations.map((e) =>
        e.transactionTypeCode === code ? { ...e, ...patch } : e
      ),
    });
  };

  const removePaymentEntry = (code: string) => {
    onChange({ paymentAllocations: paymentAllocations.filter((e) => e.transactionTypeCode !== code) });
  };

  const removeCreditEntry = (code: string) => {
    onChange({ creditAllocations: creditAllocations.filter((e) => e.transactionTypeCode !== code) });
  };

  const handleAddTransaction = (code: string, isCredit: boolean) => {
    if (isCredit) {
      const txType = creditTxTypes.find((t) => t.code === code);
      const newEntry: CreditAllocationEntry = {
        transactionTypeCode: code,
        transactionTypeValue: txType?.value ?? code,
        creditAllocationOrder: creditAllocationTypes.map((t) => ({ id: t.code, code: t.code, value: t.value })),
      };
      onChange({ creditAllocations: [...creditAllocations, newEntry] });
      setActiveTab(tabId("credit", code));
    } else {
      const txType = paymentTxTypes.find((t) => t.code === code);
      const defaultEntry = paymentAllocations[0];
      const newEntry: PaymentAllocationEntry = {
        transactionTypeCode: code,
        transactionTypeValue: txType?.value ?? code,
        paymentAllocationOrder: allocationTypes.map((t) => ({ id: t.code, code: t.code, value: t.value })),
        futureInstallmentAllocationRule:
          defaultEntry?.futureInstallmentAllocationRule ?? futureInstallmentRules[0]?.code ?? "",
        isDefault: false,
      };
      onChange({ paymentAllocations: [...paymentAllocations, newEntry] });
      setActiveTab(tabId("payment", code));
    }
  };

  const allTabs = [
    ...paymentAllocations.map((e) => ({
      id: tabId("payment", e.transactionTypeCode),
      label: e.transactionTypeValue,
      isDefault: e.isDefault,
    })),
    ...creditAllocations.map((e) => ({
      id: tabId("credit", e.transactionTypeCode),
      label: `${e.transactionTypeValue} (Credit)`,
      isDefault: false,
    })),
  ];

  const currentTab = activeTab && allTabs.find((t) => t.id === activeTab)
    ? activeTab
    : allTabs[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Payment Allocation</h2>
        <p className="text-sm text-muted-foreground">
          Configure how payments are allocated across installments for each transaction type.
          Drag rules to reprioritise.
        </p>
      </div>

      {allTabs.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No payment allocation entries. Add a transaction type to begin.
        </div>
      ) : (
        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <div className="flex items-center gap-2">
            <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {allTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                  {tab.label}
                  {tab.isDefault && (
                    <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">
                      DEFAULT
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowAddDialog(true)}
              title="Add transaction type"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {paymentAllocations.map((entry) => (
            <TabsContent key={entry.transactionTypeCode} value={tabId("payment", entry.transactionTypeCode)}>
              <PaymentAllocationTabContent
                entry={entry}
                futureInstallmentRules={futureInstallmentRules}
                onReorder={(next) =>
                  updatePaymentEntry(entry.transactionTypeCode, { paymentAllocationOrder: next })
                }
                onFutureRuleChange={(code) =>
                  updatePaymentEntry(entry.transactionTypeCode, { futureInstallmentAllocationRule: code })
                }
                onRemove={() => removePaymentEntry(entry.transactionTypeCode)}
              />
            </TabsContent>
          ))}

          {creditAllocations.map((entry) => (
            <TabsContent key={entry.transactionTypeCode} value={tabId("credit", entry.transactionTypeCode)}>
              <CreditAllocationTabContent
                entry={entry}
                onReorder={(next) =>
                  updateCreditEntry(entry.transactionTypeCode, { creditAllocationOrder: next })
                }
                onRemove={() => removeCreditEntry(entry.transactionTypeCode)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <AddTransactionDialog
        open={showAddDialog}
        paymentTxTypes={paymentTxTypes}
        creditTxTypes={creditTxTypes}
        usedPaymentCodes={usedPaymentCodes}
        usedCreditCodes={usedCreditCodes}
        onAdd={handleAddTransaction}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}
