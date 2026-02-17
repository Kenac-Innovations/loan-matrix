"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, RefreshCw } from "lucide-react";

interface CloseSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
}

interface Currency {
  code: string;
  name: string;
}

interface FineractSummary {
  sumCashAllocation: number;
  sumCashSettlement: number;
  sumInwardCash: number;
  sumOutwardCash: number;
  netCash: number;
  tellerName?: string;
  cashierName?: string;
}

export function CloseSessionModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
}: CloseSessionModalProps) {
  const router = useRouter();
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyCode, setCurrencyCode] = useState("");
  const [summary, setSummary] = useState<FineractSummary | null>(null);
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formData, setFormData] = useState({
    countedCashAmount: "",
    comments: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch currencies on mount
  useEffect(() => {
    if (open) {
      fetchCurrencies();
    }
  }, [open]);

  // Fetch Fineract summary when currency changes
  useEffect(() => {
    if (open && currencyCode && tellerId && cashierId) {
      fetchFineractSummary();
    }
  }, [open, currencyCode, tellerId, cashierId]);

  const fetchCurrencies = async () => {
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

        if (currencyList.length > 0 && !currencyCode) {
          setCurrencyCode(currencyList[0].code);
        }
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchFineractSummary = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const url = `/api/tellers/${tellerId}/cashiers/${cashierId}/transactions?currencyCode=${currencyCode}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setSummary({
          sumCashAllocation: data.sumCashAllocation || 0,
          sumCashSettlement: data.sumCashSettlement || 0,
          sumInwardCash: data.sumInwardCash || 0,
          sumOutwardCash: data.sumOutwardCash || 0,
          netCash: data.netCash || 0,
          tellerName: data.tellerName,
          cashierName: data.cashierName,
        });

        // Pre-fill counted amount with expected balance (netCash)
        setFormData((prev) => ({
          ...prev,
          countedCashAmount: (data.netCash || 0).toFixed(2),
        }));
      } else {
        console.error("Failed to fetch Fineract summary");
        setSummary(null);
    }
    } catch (error) {
      console.error("Error fetching Fineract summary:", error);
      setSummary(null);
    } finally {
      setLoadingData(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (
      !formData.countedCashAmount ||
      parseFloat(formData.countedCashAmount) < 0
    ) {
      setError("Please enter a valid counted cash amount");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            countedCashAmount: parseFloat(formData.countedCashAmount),
            comments: formData.comments,
            currencyCode,
            sessionDate,
          }),
        }
      );

      if (response.ok) {
        onOpenChange(false);
        router.refresh();
        setFormData({ countedCashAmount: "", comments: "" });
        setSummary(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
          errorData.error ||
          errorData.details ||
          `Failed to close session (${response.status})`;
        setError(errorMessage);
        console.error("Error closing session:", errorData);
      }
    } catch (error) {
      console.error("Error closing session:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to close session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode || orgCurrency,
      }).format(amount);
    } catch {
      return `${currencyCode || orgCurrency} ${amount.toFixed(2)}`;
    }
  };

  // Calculate values from Fineract data
  const openingFloat = summary?.sumCashAllocation || 0;
  const cashIn = summary?.sumCashAllocation || 0; // Total allocated
  const cashOut = summary?.sumCashSettlement || 0; // Total settled
  const expectedBalance = summary?.netCash || 0;

  const difference =
    parseFloat(formData.countedCashAmount || "0") - expectedBalance;
  const isBalanced = Math.abs(difference) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Close Cashier Session</DialogTitle>
          <DialogDescription>
            {cashierName
              ? `Close today's session for ${cashierName}`
              : "Close today's session"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleClose}>
          <div className="space-y-4 py-4">
            {/* Session Date & Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sessionDate">Session Date</Label>
                <Input
                  id="sessionDate"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currencyCode">Currency</Label>
                <div className="flex gap-2">
                  <select
                    id="currencyCode"
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={fetchFineractSummary}
                    disabled={loadingData}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>
              </div>
            </div>

            {/* Session Summary from Fineract */}
            {loadingData ? (
              <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading session data from Fineract...</span>
              </div>
            ) : summary ? (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs text-muted-foreground">
                    Cash In (Allocated)
                </Label>
                <p className="text-lg font-semibold text-green-600">
                    {formatAmount(cashIn)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                    Cash Out (Settled)
                </Label>
                <p className="text-lg font-semibold text-red-600">
                    {formatAmount(cashOut)}
                </p>
              </div>
                <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">
                    Expected Balance (Net Cash)
                </Label>
                  <p className="text-2xl font-bold">
                    {formatAmount(expectedBalance)}
                </p>
                </div>
              </div>
            ) : (
              <div className="p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
                No session data available. Select a currency to load data.
            </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="countedCashAmount">
                Counted Cash Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="countedCashAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.countedCashAmount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    countedCashAmount: e.target.value,
                  })
                }
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Enter the actual cash amount counted physically
              </p>
            </div>

            {formData.countedCashAmount && summary && (
              <Alert
                variant={
                  isBalanced
                    ? "default"
                    : difference > 0
                    ? "default"
                    : "destructive"
                }
              >
                <AlertDescription>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {isBalanced
                        ? "✓ Balanced"
                        : difference > 0
                        ? "↑ Over"
                        : "↓ Short"}
                    </span>
                    <span className="text-lg font-bold">
                      {difference > 0 ? "+" : ""}
                      {formatAmount(difference)}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="comments">Comments / Notes</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) =>
                  setFormData({ ...formData, comments: e.target.value })
                }
                placeholder="Add any notes about the session closure..."
                rows={3}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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
            <Button type="submit" disabled={loading || !summary}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                "Close Session"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
