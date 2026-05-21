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
  defaultBankId?: string | null;
  defaultBankName?: string | null;
  vaultBalance?: number | null;
  currency?: string | null;
  onSuccess?: () => void;
}

interface Currency {
  code: string;
  name: string;
}

interface BankOption {
  id: string;
  name: string;
  code: string;
  glAccountId: number | null;
  glAccountCode: string | null;
  status: string;
  isActive: boolean;
}

export function ReturnToBankModal({
  open,
  onOpenChange,
  tellerId,
  tellerName,
  defaultBankId,
  defaultBankName,
  vaultBalance,
  currency: tellerCurrency,
  onSuccess,
}: Readonly<ReturnToBankModalProps>) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    transactionId?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    currency: tellerCurrency || orgCurrency,
    notes: "",
    bankId: defaultBankId || "",
  });

  useEffect(() => {
    if (open) {
      setResult(null);
      setFormData({
        amount: "",
        currency: tellerCurrency || orgCurrency,
        notes: "",
        bankId: defaultBankId || "",
      });
      fetchCurrencies();
      fetchBanks();
    }
  }, [open, tellerCurrency, orgCurrency, defaultBankId]);

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

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const response = await fetch("/api/banks?status=ACTIVE");
      if (response.ok) {
        const data = await response.json();
        const list: BankOption[] = Array.isArray(data) ? data : [];
        // Only banks that have a GL account can receive a return.
        setBanks(list.filter((b) => b.glAccountId && b.isActive !== false));
      }
    } catch (e) {
      console.error("Error fetching banks:", e);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const amountNum = Number.parseFloat(formData.amount);
    if (!amountNum || amountNum <= 0) {
      setResult({ success: false, message: "Enter an amount greater than 0." });
      return;
    }
    if (!formData.bankId) {
      setResult({
        success: false,
        message: "Select a destination bank.",
      });
      return;
    }
    if (typeof vaultBalance === "number" && amountNum > vaultBalance) {
      setResult({
        success: false,
        message: `Amount exceeds the teller vault balance (${vaultBalance.toLocaleString(
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
          bankId: formData.bankId,
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

      const selectedBank = banks.find((b) => b.id === formData.bankId);
      const destinationName =
        selectedBank?.name ||
        (formData.bankId === defaultBankId ? defaultBankName : null) ||
        "bank";
      setResult({
        success: true,
        message: `Returned ${amountNum.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${formData.currency} to ${destinationName}.`,
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
            Move cash from {tellerName || "this teller"} back to a bank. Defaults
            to the teller&apos;s parent bank
            {defaultBankName ? ` (${defaultBankName})` : ""} but you can pick
            any other configured bank. A Fineract journal entry will be posted
            (DEBIT destination bank GL, CREDIT teller GL).
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
              <Label htmlFor="bank">Destination Bank *</Label>
              <SearchableSelect
                options={banks.map((b) => {
                  const label = `${b.name}${b.code ? ` (${b.code})` : ""}${
                    b.id === defaultBankId ? " — default" : ""
                  }`;
                  return { value: b.id, label };
                })}
                value={formData.bankId}
                onValueChange={(value) =>
                  setFormData({ ...formData, bankId: value })
                }
                placeholder={
                  loadingBanks ? "Loading banks..." : "Select destination bank"
                }
                emptyMessage="No banks with GL accounts found"
                disabled={loadingBanks || loading}
              />
              {formData.bankId &&
                defaultBankId &&
                formData.bankId !== defaultBankId && (
                  <p className="text-xs text-amber-600">
                    Not the teller&apos;s parent bank — cash will be returned to
                    a different bank.
                  </p>
                )}
            </div>
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
