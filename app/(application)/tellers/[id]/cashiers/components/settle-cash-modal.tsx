"use client";

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

interface SettleCashModalProps {
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
  netCash: number;
  tellerName?: string;
  cashierName?: string;
}

interface ClosedSession {
  countedCashAmount?: number;
  closingBalance?: number;
  sessionDate?: string;
  status?: string;
}

export function SettleCashModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
}: SettleCashModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyCode, setCurrencyCode] = useState("");
  const [summary, setSummary] = useState<FineractSummary | null>(null);
  const [closedSession, setClosedSession] = useState<ClosedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    notes: "",
  });

  // Fetch currencies and closed session on mount
  useEffect(() => {
    if (open) {
      fetchCurrencies();
      fetchClosedSession();
      setError(null);
    }
  }, [open]);

  const fetchClosedSession = async () => {
    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`
      );
      if (response.ok) {
        const data = await response.json();
        // Check if session is closed
        if (data.session?.sessionStatus === "CLOSED") {
          setClosedSession({
            countedCashAmount: data.session.countedCashAmount,
            closingBalance: data.session.closingBalance,
            sessionDate: data.session.sessionDate,
            status: data.session.sessionStatus,
          });
          // Pre-populate with counted amount from closed session
          if (data.session.countedCashAmount) {
            setFormData((prev) => ({
              ...prev,
              amount: data.session.countedCashAmount.toFixed(2),
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching closed session:", error);
    }
  };

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
          netCash: data.netCash || 0,
          tellerName: data.tellerName,
          cashierName: data.cashierName,
        });

        // Only pre-fill with netCash if no closed session amount is available
        if (!closedSession?.countedCashAmount) {
          setFormData((prev) => ({
            ...prev,
            amount: (data.netCash || 0).toFixed(2),
          }));
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    if (amount > (summary?.netCash || 0)) {
      setError(
        `Amount exceeds available balance of ${formatAmount(summary?.netCash || 0)}`
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount,
            currency: currencyCode,
            notes: formData.notes || "Settlement to teller safe",
            date: new Date().toISOString().split("T")[0],
          }),
        }
      );

      if (response.ok) {
        onOpenChange(false);
        router.refresh();
        setFormData({ amount: "", notes: "" });
        setSummary(null);
      } else {
        const errorData = await response.json();
        const errorMessage =
          errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
          errorData.error ||
          errorData.details ||
          "Failed to settle cash";
        setError(errorMessage);
      }
    } catch (error) {
      console.error("Error settling cash:", error);
      setError("Failed to settle cash");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode || "USD",
      }).format(amount);
    } catch {
      return `${currencyCode || "USD"} ${amount.toFixed(2)}`;
    }
  };

  const cashIn = summary?.sumCashAllocation || 0;
  const cashOut = summary?.sumCashSettlement || 0;
  const balance = summary?.netCash || 0;
  const settleAmount = parseFloat(formData.amount || "0");
  const remainingBalance = balance - settleAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Settle Cash</DialogTitle>
          <DialogDescription>
            {cashierName
              ? `Return cash from ${cashierName} to teller safe`
              : "Return cash to teller safe"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Currency Selector */}
          <div className="flex items-center gap-4">
            <Label htmlFor="currencyCode" className="shrink-0">
              Currency:
            </Label>
            <div className="flex gap-2 flex-1">
              <select
                id="currencyCode"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
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

          {/* Closed Session Info with Variance */}
          {closedSession && summary && (() => {
            const countedAmount = closedSession.countedCashAmount || 0;
            const expectedAmount = summary.netCash || 0;
            const variance = countedAmount - expectedAmount;
            const isBalanced = Math.abs(variance) < 0.01;
            const isShortage = variance < -0.01;
            const isOverage = variance > 0.01;
            
            return (
              <div className="space-y-3">
                {/* Counted Amount */}
                <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-800">
                      Closed Session - Counted Amount
                    </span>
                    <span className="text-lg font-bold text-blue-800">
                      {formatAmount(countedAmount)}
                    </span>
                  </div>
                </div>
                
                {/* Variance Banner */}
                <div className={`p-3 border rounded-lg ${
                  isBalanced 
                    ? "bg-green-50 border-green-200" 
                    : isShortage 
                      ? "bg-red-50 border-red-200" 
                      : "bg-yellow-50 border-yellow-200"
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className={`text-sm font-medium ${
                        isBalanced 
                          ? "text-green-800" 
                          : isShortage 
                            ? "text-red-800" 
                            : "text-yellow-800"
                      }`}>
                        {isBalanced 
                          ? "✓ Balanced" 
                          : isShortage 
                            ? "↓ Shortage" 
                            : "↑ Overage"}
                      </span>
                      <p className={`text-xs mt-1 ${
                        isBalanced 
                          ? "text-green-600" 
                          : isShortage 
                            ? "text-red-600" 
                            : "text-yellow-600"
                      }`}>
                        {isBalanced 
                          ? "Counted amount matches expected balance" 
                          : `Counted: ${formatAmount(countedAmount)} vs Expected: ${formatAmount(expectedAmount)}`}
                      </p>
                    </div>
                    {!isBalanced && (
                      <span className={`text-xl font-bold ${
                        isShortage ? "text-red-800" : "text-yellow-800"
                      }`}>
                        {variance > 0 ? "+" : ""}{formatAmount(variance)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fineract Summary */}
          {loadingData ? (
            <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading data from Fineract...</span>
            </div>
          ) : summary ? (
            <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs text-muted-foreground">Cash In</Label>
                <p className="text-lg font-semibold text-green-600">
                  {formatAmount(cashIn)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Cash Out
                </Label>
                <p className="text-lg font-semibold text-red-600">
                  {formatAmount(cashOut)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Fineract Balance
                </Label>
                <p className="text-lg font-bold">{formatAmount(balance)}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
              No data available. Select a currency to load data.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Amount to Settle <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={balance}
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: e.target.value,
                    })
                  }
                  required
                  placeholder="0.00"
                  className="text-lg font-semibold"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the amount to return to teller safe
                </p>
              </div>

              {formData.amount && summary && (
                <div className="p-3 border rounded-lg bg-blue-50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Remaining Balance After Settlement:
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        remainingBalance < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {formatAmount(remainingBalance)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Settlement to teller safe..."
                  rows={2}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="mt-6">
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
                disabled={loading || !summary || settleAmount <= 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Settling...
                  </>
                ) : (
                  "Settle Cash"
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
