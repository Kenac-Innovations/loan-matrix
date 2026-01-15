"use client";

import { useState, useEffect } from "react";
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

interface AllocateFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankId: string;
  bankName: string;
  onSuccess?: () => void;
}

interface Currency {
  code: string;
  name: string;
  displaySymbol?: string;
}

export function AllocateFundsModal({
  open,
  onOpenChange,
  bankId,
  bankName,
  onSuccess,
}: AllocateFundsModalProps) {
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    currency: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchCurrencies();
    } else {
      // Reset form when modal closes
      setFormData({
        amount: "",
        currency: "",
        notes: "",
      });
    }
  }, [open]);

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const response = await fetch("/api/fineract/currencies");
      if (response.ok) {
        const data = await response.json();
        const currencyList = Array.isArray(data.selectedCurrencyOptions)
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
          ? data
          : data.currencies || [];

        setCurrencies(currencyList);

        // Set default currency if available
        if (currencyList.length > 0 && !formData.currency) {
          const defaultCurrency =
            currencyList.find((c: Currency) => c.code === "ZMW") ||
            currencyList[0];
          setFormData((prev) => ({ ...prev, currency: defaultCurrency.code }));
        }
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/banks/${bankId}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to allocate funds");
      }
    } catch (error) {
      console.error("Error allocating funds:", error);
      alert("Failed to allocate funds");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Allocate Funds to Bank</DialogTitle>
          <DialogDescription>
            Add funds to <strong>{bankName}</strong> vault. These funds can then
            be distributed to tellers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <SearchableSelect
                options={currencies.map((c) => ({
                  value: c.code,
                  label: `${c.code}${c.name ? ` - ${c.name}` : ""}`,
                }))}
                value={formData.currency}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency: value })
                }
                placeholder={
                  loadingCurrencies
                    ? "Loading currencies..."
                    : "Select currency"
                }
                emptyMessage="No currencies found"
                disabled={loadingCurrencies}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes (e.g., source of funds)..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Allocating..." : "Allocate Funds"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

