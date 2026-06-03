"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";
import { useCurrency } from "@/contexts/currency-context";
import { useToast } from "@/hooks/use-toast";

interface Office {
  id: number;
  name: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
}

interface MobileMoneyTopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOfficeId?: number | null;
  onSaved: () => void;
}

export function MobileMoneyTopupModal({
  open,
  onOpenChange,
  defaultOfficeId,
  onSaved,
}: MobileMoneyTopupModalProps) {
  const { currencyCode: orgCurrency } = useCurrency();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [formData, setFormData] = useState({
    amount: "",
    officeId: "",
    sourceGlAccountId: "",
    transactionDate: new Date().toISOString().split("T")[0],
    referenceNumber: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;

    setFormData({
      amount: "",
      officeId: defaultOfficeId?.toString() || "",
      sourceGlAccountId: "",
      transactionDate: new Date().toISOString().split("T")[0],
      referenceNumber: "",
      notes: "",
    });
  }, [open, defaultOfficeId]);

  useEffect(() => {
    if (!open) return;

    async function fetchSetupData() {
      setLoadingData(true);
      try {
        const [officesRes, glAccountsRes] = await Promise.all([
          fetch("/api/fineract/offices"),
          fetch(
            "/api/fineract/glaccounts/detail?usage=1&disabled=false&manualEntriesAllowed=true"
          ),
        ]);

        if (!officesRes.ok) {
          throw new Error("Failed to fetch offices");
        }

        if (!glAccountsRes.ok) {
          throw new Error("Failed to fetch GL accounts");
        }

        const [officesData, glAccountsData] = await Promise.all([
          officesRes.json(),
          glAccountsRes.json(),
        ]);

        setOffices(Array.isArray(officesData) ? officesData : []);
        setGlAccounts(Array.isArray(glAccountsData) ? glAccountsData : []);
      } catch (fetchError) {
        console.error("Error loading top-up form data:", fetchError);
        error({
          title: "Unable to load top-up form",
          description:
            fetchError instanceof Error
              ? fetchError.message
              : "Please try again.",
        });
      } finally {
        setLoadingData(false);
      }
    }

    fetchSetupData();
  }, [open, error]);

  const officeOptions = useMemo(
    () =>
      offices.map((office) => ({
        value: office.id.toString(),
        label: office.name,
      })),
    [offices]
  );

  const glAccountOptions = useMemo(
    () =>
      glAccounts.map((account) => ({
        value: account.id.toString(),
        label: `${account.glCode} - ${account.name}`,
      })),
    [glAccounts]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.amount || Number(formData.amount) <= 0) {
      error({
        title: "Invalid amount",
        description: "Please enter a top-up amount greater than zero.",
      });
      return;
    }

    if (!formData.officeId || !formData.sourceGlAccountId) {
      error({
        title: "Missing details",
        description: "Please select the office and source GL account.",
      });
      return;
    }

    setLoading(true);
    try {
      const sourceGlAccount = glAccounts.find(
        (account) => account.id === Number(formData.sourceGlAccountId)
      );

      const response = await fetch("/api/mobile-money-transactions/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(formData.amount),
          officeId: Number(formData.officeId),
          sourceGlAccountId: Number(formData.sourceGlAccountId),
          sourceGlAccountName: sourceGlAccount?.name,
          sourceGlAccountCode: sourceGlAccount?.glCode,
          transactionDate: formData.transactionDate,
          referenceNumber: formData.referenceNumber || undefined,
          notes: formData.notes || undefined,
          currency: orgCurrency,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to top up mobile money");
      }

      success({
        title: "Top-up posted",
        description: "Mobile money pool has been funded successfully.",
      });
      onOpenChange(false);
      onSaved();
    } catch (submitError) {
      console.error("Error submitting mobile money top-up:", submitError);
      error({
        title: "Top-up failed",
        description:
          submitError instanceof Error
            ? submitError.message
            : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Top Up Mobile Money</DialogTitle>
          <DialogDescription>
            Fund the tenant-wide mobile money pool using the linked GL flow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transactionDate">Transaction Date *</Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transactionDate: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Office *</Label>
            <SearchableSelect
              options={officeOptions}
              value={formData.officeId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, officeId: value }))
              }
              placeholder={loadingData ? "Loading offices..." : "Select office"}
              emptyMessage="No offices found"
              disabled={loadingData}
            />
          </div>

          <div className="space-y-2">
            <Label>Source GL Account *</Label>
            <SearchableSelect
              options={glAccountOptions}
              value={formData.sourceGlAccountId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, sourceGlAccountId: value }))
              }
              placeholder={
                loadingData ? "Loading GL accounts..." : "Select source GL"
              }
              emptyMessage="No GL accounts found"
              disabled={loadingData}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                value={formData.referenceNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    referenceNumber: e.target.value,
                  }))
                }
                placeholder="Optional reference"
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={orgCurrency} disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Optional notes for the top-up"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? "Posting..." : "Post Top-Up"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
