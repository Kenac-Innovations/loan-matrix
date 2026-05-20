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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ArrowDownLeft, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { useCurrency } from "@/contexts/currency-context";

interface ReturnToBankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  tellerName?: string;
  bankName?: string | null;
  vaultBalance?: number | null;
  currency?: string | null;
  onSuccess?: () => void;
}

interface Currency {
  code: string;
  name: string;
}

export function ReturnToBankModal({
  open,
  onOpenChange,
  tellerId,
  tellerName,
  bankName,
  vaultBalance,
  currency: tellerCurrency,
  onSuccess,
}: ReturnToBankModalProps) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    transactionId?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    currency: tellerCurrency || orgCurrency,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setResult(null);
      setFormData({
        amount: "",
        currency: tellerCurrency || orgCurrency,
        notes: "",
      });
      fetchCurrencies();
    }
  }, [open, tellerCurrency, orgCurrency]);

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const response = await fetch("/api/fineract/currencies");
      if (response.ok) {
        const data = await response.json();
        const currencyList: Currency[] = Array.isArray(
          data.selectedCurrencyOptions
        )
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
          ? data
          : data.currencies || [];
        setCurrencies(currencyList);
      }
    } catch (e) {
      console.error("Error fetching currencies:", e);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const amountNum = parseFloat(formData.amount);
    if (!amountNum || amountNum <= 0) {
      setResult({ success: false, message: "Enter an amount greater than 0." });
      return;
    }
    if (
      typeof vaultBalance === "number" &&
      amountNum > vaultBalance
    ) {
      setResult({
        success: false,
        message: `Amount exceeds the teller's vault balance (${vaultBalance.toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )} ${formData.currency}).`,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/tellers/${tellerId}/return-to-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          currency: formData.currency,
          notes: formData.notes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setResult({
          success: false,
          message:
            data.details || data.error || "Failed to return cash to bank.",
        });
        return;
      }

      setResult({
        success: true,
        message: `Returned ${amountNum.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${formData.currency} to ${bankName || "bank"}.`,
        transactionId: data.journalTransactionId,
      });
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1500);
    } catch (e) {
      console.error("Error returning to bank:", e);
      setResult({
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-blue-600" />
            Return Cash to Bank
          </DialogTitle>
          <DialogDescription>
            Move cash from {tellerName || "this teller"} back to{" "}
            <span className="font-medium">{bankName || "its parent bank"}</span>
            . A Fineract journal entry will be posted (DEBIT bank GL, CREDIT
            teller GL).
          </DialogDescription>
        </DialogHeader>

        {typeof vaultBalance === "number" && (
          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available in vault</span>
              <span className="font-medium">
                {vaultBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {tellerCurrency || orgCurrency}
              </span>
            </div>
          </div>
        )}

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {result.message}
              {result.transactionId && (
                <span className="block mt-1 font-mono text-xs">
                  Transaction ID: {result.transactionId}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
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
                disabled={loading}
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
                disabled={loadingCurrencies || loading}
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
                placeholder="Why is cash being returned? (optional)"
                rows={3}
                disabled={loading}
              />
            </div>
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
            <Button type="submit" disabled={loading || result?.success}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Returning...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" />
                  Return to Bank
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
