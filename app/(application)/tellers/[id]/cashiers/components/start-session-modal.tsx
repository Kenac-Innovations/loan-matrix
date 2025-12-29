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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";

interface StartSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  allocatedBalance?: number;
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

export function StartSessionModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
}: StartSessionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyCode, setCurrencyCode] = useState("");
  const [summary, setSummary] = useState<FineractSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch currencies on mount
  useEffect(() => {
    if (open) {
      fetchCurrencies();
      setError(null);
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
      } else {
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
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode || "USD",
      }).format(amount);
    } catch {
      return `${currencyCode || "USD"} ${amount.toFixed(2)}`;
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            openingFloat: netCash,
            currencyCode,
          }),
        }
      );

      if (response.ok || response.status === 207) {
        const result = await response.json();
        if (result.warning) {
          alert(`Session started but with warning: ${result.warning}`);
        }
        onOpenChange(false);
        router.refresh();
      } else {
        let errorMessage = "Failed to start session";
        try {
          const errorData = await response.json();
          if (errorData && Object.keys(errorData).length > 0) {
            errorMessage =
              errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
              errorData.error ||
              errorData.details ||
              errorData.message ||
              JSON.stringify(errorData);
          }
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        setError(errorMessage);
      }
    } catch (error) {
      console.error("Error starting session:", error);
      setError("Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  const netCash = summary?.netCash || 0;
  const hasBalance = netCash > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start Cashier Session</DialogTitle>
          <DialogDescription>
            {cashierName && `Start a new session for ${cashierName}`}
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

          {/* Fineract Balance */}
          {loadingData ? (
            <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading balance from Fineract...</span>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {/* Balance Display */}
              <div
                className={`p-4 border rounded-lg ${
                  hasBalance
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="text-center">
                  <Label className="text-sm text-muted-foreground">
                    Opening Float (Net Cash Position)
                  </Label>
                  <p
                    className={`text-3xl font-bold mt-2 ${
                      hasBalance ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatAmount(netCash)}
                  </p>
                  {hasBalance ? (
                    <p className="text-sm text-green-600 mt-2">
                      This cashier has cash allocated and ready for the session
                    </p>
                  ) : (
                    <p className="text-sm text-red-600 mt-2">
                      No cash available. Please allocate cash using "Cash In"
                      before starting a session.
                    </p>
                  )}
                </div>
              </div>

              {/* Summary Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 border rounded bg-muted/50">
                  <Label className="text-xs text-muted-foreground">
                    Total Cash In
                  </Label>
                  <p className="font-medium text-green-600">
                    {formatAmount(summary.sumCashAllocation)}
                  </p>
                </div>
                <div className="p-3 border rounded bg-muted/50">
                  <Label className="text-xs text-muted-foreground">
                    Total Cash Out
                  </Label>
                  <p className="font-medium text-red-600">
                    {formatAmount(summary.sumCashSettlement)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
              Select a currency to check balance
            </div>
          )}

          {/* No Balance Warning */}
          {summary && !hasBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cannot start session with zero balance. Use "Cash In" to
                allocate cash to this cashier first.
              </AlertDescription>
            </Alert>
          )}

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
          <Button onClick={handleStart} disabled={loading || !hasBalance}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Session"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
