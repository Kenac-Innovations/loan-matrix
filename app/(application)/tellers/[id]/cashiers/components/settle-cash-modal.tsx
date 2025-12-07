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
import { Loader2, AlertCircle } from "lucide-react";

interface SessionData {
  session?: {
    sessionStatus: string;
    closingBalance?: number;
    countedCashAmount?: number;
  } | null;
  balances?: {
    allocatedBalance: number;
    openingFloat: number;
    cashIn: number;
    cashOut: number;
    netCash: number;
    expectedBalance: number;
  };
}

interface SettleCashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
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
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    closingBalance: "",
    notes: "",
  });

  // Fetch session data when modal opens
  useEffect(() => {
    if (open && tellerId && cashierId) {
      fetchSessionData();
    }
  }, [open, tellerId, cashierId]);

  const fetchSessionData = async () => {
    setLoadingSession(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`
      );

      if (response.ok) {
        const data = await response.json();
        setSessionData(data);

        // Pre-fill closing balance with counted cash from closed session, or expected balance
        const closingBalance =
          data.session?.countedCashAmount ||
          data.session?.closingBalance ||
          data.balances?.expectedBalance ||
          0;

        setFormData({
          closingBalance: closingBalance.toFixed(2),
          notes: "",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch session data");
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      setError("Failed to fetch session data");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            closingBalance: parseFloat(formData.closingBalance),
            notes: formData.notes,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        onOpenChange(false);
        router.refresh();
        setFormData({ closingBalance: "", notes: "" });
        setSessionData(null);

        // Show success message with settlement details
        const variance = result.difference || 0;
        alert(
          `Settlement created successfully!\n\n` +
            `Opening Balance: ${result.openingBalance?.toFixed(2) || 0}\n` +
            `Cash In: ${result.cashIn?.toFixed(2) || 0}\n` +
            `Cash Out: ${result.cashOut?.toFixed(2) || 0}\n` +
            `Expected Balance: ${result.expectedBalance?.toFixed(2) || 0}\n` +
            `Actual Balance: ${result.actualBalance?.toFixed(2) || 0}\n` +
            (Math.abs(variance) > 0.01
              ? `Variance: ${variance > 0 ? "+" : ""}${variance.toFixed(2)} (${
                  variance > 0 ? "Surplus" : "Shortage"
                })\n`
              : "") +
            `\nStatus: ${result.status}\n` +
            `\nNext step: Reconcile & Return Cash to complete end-of-day process.`
        );
      } else {
        const errorData = await response.json();
        setError(
          errorData.error || errorData.details || "Failed to settle cash"
        );
      }
    } catch (error) {
      console.error("Error settling cash:", error);
      setError("Failed to settle cash");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const balances = sessionData?.balances;
  const expectedBalance = balances?.expectedBalance || 0;
  const closingBalance = parseFloat(formData.closingBalance || "0");
  const variance = closingBalance - expectedBalance;
  const isBalanced = Math.abs(variance) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Settle Cash for Cashier</DialogTitle>
          <DialogDescription>
            {cashierName && `Review and settle cash for ${cashierName}`}
          </DialogDescription>
        </DialogHeader>

        {loadingSession ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading session data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Session Summary */}
              {balances && (
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Opening Balance
                    </Label>
                    <p className="text-lg font-semibold">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(balances.openingFloat)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Cash In
                    </Label>
                    <p className="text-lg font-semibold text-green-600">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(balances.cashIn)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Cash Out
                    </Label>
                    <p className="text-lg font-semibold text-red-600">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(balances.cashOut)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Expected Balance
                    </Label>
                    <p className="text-lg font-semibold">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(expectedBalance)}
                    </p>
                  </div>
                </div>
              )}

              <Alert>
                <AlertDescription>
                  Settlement recognizes the variance between expected and actual
                  cash. After settling, use "Reconcile & Return Cash" to return
                  cash to vault and complete end-of-day process.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="closingBalance">
                  Closing Balance (Counted Cash){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="closingBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.closingBalance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      closingBalance: e.target.value,
                    })
                  }
                  required
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the actual cash amount counted (from closed session)
                </p>
              </div>

              {formData.closingBalance && (
                <Alert
                  variant={
                    isBalanced
                      ? "default"
                      : variance > 0
                      ? "default"
                      : "destructive"
                  }
                >
                  <AlertDescription>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {isBalanced
                          ? "Balanced"
                          : variance > 0
                          ? "Surplus"
                          : "Shortage"}
                      </span>
                      <span className="text-lg font-bold">
                        {variance > 0 ? "+" : ""}
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(variance)}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Settlement Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes about the settlement..."
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
              <Button type="submit" disabled={loading}>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
