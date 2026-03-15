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
import { Loader2, ArrowDownLeft } from "lucide-react";

interface CashInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  onSuccess?: () => void;
}

interface Currency {
  code: string;
  name: string;
  displaySymbol?: string;
}

export function CashInModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
  onSuccess,
}: CashInModalProps) {
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    currency: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchCurrencies();
      setError(null);
      setSuccess(null);
    } else {
      // Reset form when modal closes
      setFormData({
        amount: "",
        currency: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
      });
      setError(null);
      setSuccess(null);
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
          setFormData((prev) => ({ ...prev, currency: currencyList[0].code }));
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
    setError(null);
    setSuccess(null);

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!formData.currency) {
      setError("Please select a currency");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/allocate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parseFloat(formData.amount),
            currency: formData.currency,
            notes: formData.notes || "Allocation from teller safe",
            date: formData.date,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSuccess(
          `Successfully added ${formData.currency} ${parseFloat(
            formData.amount
          ).toFixed(2)} to cashier`
        );

        // Reset form
        setFormData({
          amount: "",
          currency: formData.currency,
          notes: "",
          date: new Date().toISOString().split("T")[0],
        });

        // Call onSuccess callback if provided
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            onOpenChange(false);
          }, 1500);
        }
      } else {
        const errorData = await response.json();
        console.error("Cash In error:", errorData);
        // Show detailed error - prioritize defaultUserMessage
        let errorMessage = "";
        
        // Check for defaultUserMessage - prioritize the specific error message
        const defaultUserMessage = 
          errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
          errorData.fineractError?.defaultUserMessage ||
          errorData.details ||
          errorData.error;
        
        setError(defaultUserMessage || "Failed to add cash");
      }
    } catch (error) {
      console.error("Error adding cash:", error);
      setError("Failed to add cash. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (value: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, "");
    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-green-600" />
            Cash In
          </DialogTitle>
          <DialogDescription>
            {cashierName
              ? `Add cash to ${cashierName}'s drawer`
              : "Add cash to the cashier's drawer"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    amount: formatAmount(e.target.value),
                  }))
                }
                className="text-lg font-semibold"
                required
              />
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currency: e.target.value }))
                }
                disabled={loadingCurrencies}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                {loadingCurrencies ? (
                  <option value="">Loading currencies...</option>
                ) : currencies.length === 0 ? (
                  <option value="">No currencies available</option>
                ) : (
                  currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Transaction Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Transaction notes (optional)"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                {success}
              </div>
            )}
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
            <Button
              type="submit"
              disabled={loading || !formData.amount || !formData.currency}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" />
                  Add Cash
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

