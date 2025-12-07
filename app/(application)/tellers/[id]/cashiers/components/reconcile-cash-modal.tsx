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

interface Settlement {
  id: string;
  openingBalance: number;
  closingBalance: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  status: string;
  settlementDate: string;
}

interface ClosedSession {
  id: string;
  sessionStatus: string;
  allocatedBalance: number;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  countedCashAmount: number | null;
  closingBalance: number | null;
  expectedBalance: number | null;
  difference: number | null;
  sessionEndTime: string | null;
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
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [closedSession, setClosedSession] = useState<ClosedSession | null>(
    null
  );
  const [tellerAvailableBalance, setTellerAvailableBalance] = useState<
    number | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    returnedAmount: "",
    notes: "",
  });

  // Fetch closed session and settlement when modal opens
  useEffect(() => {
    if (open && tellerId && cashierId) {
      fetchData();
    }
  }, [open, tellerId, cashierId]);

  const fetchData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      // Fetch closed session (to get counted cash)
      const sessionResponse = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/sessions?status=CLOSED&limit=1`
      );

      // Fetch pending settlement
      const settlementResponse = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/settlements?status=PENDING&latest=true`
      );

      // Fetch teller available balance
      const tellerResponse = await fetch(`/api/tellers/${tellerId}`);

      let sessionData = null;
      let settlementData = null;
      let tellerData = null;

      if (sessionResponse.ok) {
        const response = await sessionResponse.json();
        // API returns { sessions: [...], total, limit, offset }
        if (
          response.sessions &&
          Array.isArray(response.sessions) &&
          response.sessions.length > 0
        ) {
          sessionData = response.sessions[0];
        } else if (Array.isArray(response) && response.length > 0) {
          // Fallback: if response is directly an array
          sessionData = response[0];
        } else if (response && response.id) {
          // Fallback: if response is a single session object
          sessionData = response;
        }
      }

      if (settlementResponse.ok) {
        settlementData = await settlementResponse.json();
      }

      if (tellerResponse.ok) {
        tellerData = await tellerResponse.json();
        setTellerAvailableBalance(tellerData.availableBalance || 0);
      }

      if (!sessionData) {
        setError("No closed session found. Please close the session first.");
        setLoadingData(false);
        return;
      }

      if (!settlementData) {
        setError("No pending settlement found. Please settle cash first.");
        setLoadingData(false);
        return;
      }

      setClosedSession(sessionData);
      setSettlement(settlementData);

      // Pre-fill returned amount with counted cash from closed session
      const countedCash =
        sessionData.countedCashAmount || sessionData.closingBalance || 0;

      setFormData({
        returnedAmount: countedCash.toFixed(2),
        notes: "",
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch session or settlement data");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!closedSession) {
      setError("No closed session found");
      setLoading(false);
      return;
    }

    if (!settlement) {
      setError("No pending settlement found. Please settle cash first.");
      setLoading(false);
      return;
    }

    if (!formData.returnedAmount || parseFloat(formData.returnedAmount) < 0) {
      setError("Please enter a valid returned amount");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/reconcile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settlementId: settlement.id,
            returnedAmount: parseFloat(formData.returnedAmount),
            notes: formData.notes,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        onOpenChange(false);
        router.refresh();
        setFormData({ returnedAmount: "", notes: "" });
        setSettlement(null);

        // Show success message
        alert(
          `Reconciliation successful!\n\n` +
            `Reversed ${result.reconciliation.reversedAllocations} allocations\n` +
            `Returned ${result.reconciliation.vaultAllocation.amount} ${result.reconciliation.vaultAllocation.currency} to vault\n` +
            (result.reconciliation.variance
              ? `Variance: ${result.reconciliation.variance.amount} ${result.reconciliation.variance.currency} (${result.reconciliation.variance.type})\n`
              : "") +
            `Cashier balance: ${result.reconciliation.cashierBalance}\n` +
            `Vault balance: ${result.reconciliation.vaultBalance}`
        );
      } else {
        const errorData = await response.json();
        setError(
          errorData.error || errorData.details || "Failed to reconcile cash"
        );
      }
    } catch (error) {
      console.error("Error reconciling cash:", error);
      setError("Failed to reconcile cash");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // Get values from closed session instead of settlement
  const openingBalance =
    closedSession?.allocatedBalance || closedSession?.openingFloat || 0;
  const cashIn = closedSession?.cashIn || 0;
  const cashOut = closedSession?.cashOut || 0;
  const expectedBalance =
    closedSession?.expectedBalance || openingBalance + cashIn - cashOut;
  const countedCash =
    closedSession?.countedCashAmount || closedSession?.closingBalance || 0;
  const variance = closedSession?.difference || countedCash - expectedBalance;
  const expectedReturn = expectedBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Reconcile Cash - Return to Vault</DialogTitle>
          <DialogDescription>
            {cashierName && `Return cash from ${cashierName} to teller vault`}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading session and settlement data...</span>
          </div>
        ) : closedSession ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Session Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Teller Available Balance
                  </Label>
                  <p className="text-lg font-semibold text-blue-600">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(tellerAvailableBalance || 0)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Opening Balance
                  </Label>
                  <p className="text-lg font-semibold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(openingBalance)}
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
                    }).format(cashIn)}
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
                    }).format(cashOut)}
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
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Counted Cash (from Session)
                  </Label>
                  <p className="text-lg font-semibold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(countedCash)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Variance
                  </Label>
                  <p
                    className={`text-lg font-semibold ${
                      variance > 0
                        ? "text-green-600"
                        : variance < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {variance > 0 ? "+" : ""}
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(variance)}
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will reverse all cashier allocations and return cash to
                  the vault. The cashier's balance will become 0. Any variance
                  will be tracked separately.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="returnedAmount">
                  Amount to Return to Vault{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="returnedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.returnedAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      returnedAmount: e.target.value,
                    })
                  }
                  required
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the actual cash amount being returned to the vault
                  (pre-filled with counted cash)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Reconciliation Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Add any notes about the reconciliation..."
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
                    Reconciling...
                  </>
                ) : (
                  "Reconcile & Return Cash"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-4">
            <Alert variant="destructive">
              <AlertDescription>
                {error ||
                  "No pending settlement found. Please settle cash first."}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
