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
import { Loader2, RefreshCw, CheckCircle } from "lucide-react";

interface Currency {
  code: string;
  name: string;
}

interface FineractSummary {
  sumCashAllocation: number;
  sumCashSettlement: number;
  sumOutwardCash?: number;
  netCash: number;
  tellerName?: string;
  cashierName?: string;
}

interface SessionInfo {
  sessionStatus: string;
  countedCashAmount?: number;
  closingBalance?: number;
}

interface ReconcileCashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
}

export function ReconcileCashModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
}: ReconcileCashModalProps) {
  const router = useRouter();
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyCode, setCurrencyCode] = useState("");
  const [summary, setSummary] = useState<FineractSummary | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    notes: "",
  });

  // Fetch currencies and session info on mount
  useEffect(() => {
    if (open) {
      fetchCurrencies();
      fetchSessionInfo();
      setError(null);
      setSuccess(null);
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

  const fetchSessionInfo = async () => {
    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`
      );
      if (response.ok) {
        const data = await response.json();
        setSessionInfo({
          sessionStatus: data.session?.sessionStatus || "NONE",
          countedCashAmount: data.session?.countedCashAmount,
          closingBalance: data.session?.closingBalance,
        });
      }
    } catch (error) {
      console.error("Error fetching session:", error);
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
          sumOutwardCash: data.sumOutwardCash ?? 0,
          netCash: data.netCash || 0,
          tellerName: data.tellerName,
          cashierName: data.cashierName,
        });
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

  const formatAmount = (amount: number) => {
    // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
    const normalizedCurrency = currencyCode === "ZMK" ? "ZMW" : (currencyCode || orgCurrency);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
      }).format(amount);
    } catch {
      return `${normalizedCurrency} ${amount.toFixed(2)}`;
    }
  };

  const handleReconcile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const remainingBalance = summary?.netCash || 0;

    if (remainingBalance <= 0) {
      setSuccess("Reconciliation complete! No remaining balance to return.");
      setLoading(false);
      return;
    }

    try {
      // Settle remaining balance back to teller safe
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: remainingBalance,
            currency: currencyCode,
            notes: formData.notes || "End of day reconciliation - Return to teller safe",
            date: new Date().toISOString().split("T")[0],
          }),
        }
      );

      if (response.ok) {
        setSuccess(
          `Reconciliation complete! ${formatAmount(remainingBalance)} returned to teller safe.`
        );
        
        // Refresh data
        setTimeout(() => {
          fetchFineractSummary();
          fetchSessionInfo();
        }, 1000);
      } else {
        const errorData = await response.json();
        const errorMessage =
          errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
          errorData.error ||
          errorData.details ||
          "Failed to reconcile";
        setError(errorMessage);
      }
    } catch (error) {
      console.error("Error reconciling:", error);
      setError("Failed to reconcile cash");
    } finally {
      setLoading(false);
    }
  };

  const remainingBalance = summary?.netCash || 0;
  const isReconciled = remainingBalance === 0;
  const isSettled = sessionInfo?.sessionStatus === "SETTLED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Reconcile & Return Cash</DialogTitle>
          <DialogDescription>
            {cashierName
              ? `Return remaining cash from ${cashierName} to teller safe`
              : "Return remaining cash to teller safe"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Status */}
          {sessionInfo && (
            <div
              className={`p-3 border rounded-lg ${
                isSettled
                  ? "bg-green-50 border-green-200"
                  : sessionInfo.sessionStatus === "CLOSED"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Session Status</span>
                <span
                  className={`text-sm font-bold ${
                    isSettled
                      ? "text-green-700"
                      : sessionInfo.sessionStatus === "CLOSED"
                      ? "text-yellow-700"
                      : "text-gray-700"
                  }`}
                >
                  {sessionInfo.sessionStatus}
                </span>
              </div>
            </div>
          )}

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

          {/* Fineract Summary */}
          {loadingData ? (
            <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading data from Fineract...</span>
                </div>
          ) : summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Total Cash In
                  </Label>
                  <p className="text-lg font-semibold text-green-600">
                    {formatAmount(summary.sumCashAllocation)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Total Cash Out
                  </Label>
                  <p className="text-lg font-semibold text-red-600">
                    {formatAmount(
                      (summary.sumCashSettlement || 0) + (summary.sumOutwardCash ?? 0)
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Remaining Balance
                  </Label>
                  <p className="text-lg font-bold">{formatAmount(remainingBalance)}</p>
                </div>
              </div>

              {/* Reconciliation Status */}
              {isReconciled ? (
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      Fully Reconciled
                    </span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    All cash has been returned to the teller safe. Balance is zero.
                  </p>
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">
                      Amount to Return
                    </span>
                    <span className="text-xl font-bold text-blue-800">
                      {formatAmount(remainingBalance)}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600 mt-1">
                    This amount will be returned to the teller safe
                  </p>
                </div>
              )}
              </div>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
              No data available. Select a currency to load data.
              </div>
          )}

          {/* Notes */}
          {!isReconciled && (
              <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                placeholder="End of day reconciliation notes..."
                rows={2}
                />
              </div>
          )}

          {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

          {/* Success */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
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
            {isReconciled ? "Close" : "Cancel"}
              </Button>
          {!isReconciled && (
            <Button
              onClick={handleReconcile}
              disabled={loading || !summary || remainingBalance <= 0}
            >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                  </>
                ) : (
                `Return ${formatAmount(remainingBalance)} to Safe`
                )}
              </Button>
          )}
            </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
