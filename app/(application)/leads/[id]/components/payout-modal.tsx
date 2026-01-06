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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Banknote, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface PayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: number;
  clientId: number;
  clientName: string;
  loanAccountNo?: string;
  principal: number;
  currency?: string;
  onSuccess?: () => void;
}

interface Teller {
  id: string;
  fineractTellerId: number;
  name: string;
  officeName: string;
}

interface Cashier {
  id: string | number;
  dbId?: string;
  staffId: number;
  staffName: string;
  sessionStatus?: string;
}

export function PayoutModal({
  open,
  onOpenChange,
  loanId,
  clientId,
  clientName,
  loanAccountNo,
  principal,
  currency = "ZMW",
  onSuccess,
}: PayoutModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Teller and cashier selection
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedTeller, setSelectedTeller] = useState<string>("");
  const [selectedCashier, setSelectedCashier] = useState<string>("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);

  // Check payout status
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTellers();
      checkPayoutStatus();
      setError(null);
      setSuccess(null);
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (selectedTeller) {
      fetchCashiers(selectedTeller);
    } else {
      setCashiers([]);
      setSelectedCashier("");
    }
  }, [selectedTeller]);

  const checkPayoutStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/loans/${loanId}/payout`);
      if (response.ok) {
        const data = await response.json();
        setPayoutStatus(data.status);
      }
    } catch (error) {
      console.error("Error checking payout status:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const fetchTellers = async () => {
    setLoadingTellers(true);
    try {
      const response = await fetch("/api/tellers");
      if (response.ok) {
        const data = await response.json();
        setTellers(data || []);
      }
    } catch (error) {
      console.error("Error fetching tellers:", error);
    } finally {
      setLoadingTellers(false);
    }
  };

  const fetchCashiers = async (tellerId: string) => {
    setLoadingCashiers(true);
    try {
      const response = await fetch(`/api/tellers/${tellerId}/cashiers`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only show cashiers with active sessions
        const activeCashiers = data.filter(
          (c: Cashier) => c.sessionStatus === "ACTIVE"
        );
        setCashiers(activeCashiers);
      }
    } catch (error) {
      console.error("Error fetching cashiers:", error);
    } finally {
      setLoadingCashiers(false);
    }
  };

  const formatCurrency = (amount: number, curr: string) => {
    return `${curr} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handlePayout = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedTeller) {
      setError("Please select a teller");
      return;
    }

    if (!selectedCashier) {
      setError("Please select a cashier with an active session");
      return;
    }

    setLoading(true);

    try {
      // Process the payout through the settle endpoint
      const response = await fetch(
        `/api/tellers/${selectedTeller}/cashiers/${selectedCashier}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: principal,
            currency: currency,
            notes: notes || `Loan Disbursement Payout - ${clientName}`,
            date: new Date().toISOString().split("T")[0],
            transactionType: "DISBURSEMENT",
            loanPayoutId: loanId, // Pass Fineract loan ID
          }),
        }
      );

      if (response.ok) {
        setSuccess(
          `Successfully paid out ${formatCurrency(principal, currency)} to ${clientName}`
        );
        setPayoutStatus("PAID");

        // Refresh and close after delay
        setTimeout(() => {
          onSuccess?.();
          router.refresh();
          onOpenChange(false);
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(
          errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
            errorData.details ||
            errorData.error ||
            "Failed to process payout"
        );
      }
    } catch (error) {
      console.error("Error processing payout:", error);
      setError("Failed to process payout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCashierData = cashiers.find(
    (c) => (c.dbId || c.id.toString()) === selectedCashier
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-600" />
            Loan Payout
          </DialogTitle>
          <DialogDescription>
            Process cash payout for this disbursed loan
          </DialogDescription>
        </DialogHeader>

        {checkingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Checking payout status...
          </div>
        ) : payoutStatus === "PAID" ? (
          <div className="py-6">
            <div className="flex flex-col items-center text-center gap-3">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold text-green-700">
                Already Paid Out
              </h3>
              <p className="text-muted-foreground">
                This loan has already been paid out to the client.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Loan Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{clientName}</span>
              </div>
              {loanAccountNo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-mono">{loanAccountNo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(principal, currency)}
                </span>
              </div>
            </div>

            {/* Teller Selection */}
            <div className="space-y-2">
              <Label>Select Teller *</Label>
              <Select value={selectedTeller} onValueChange={setSelectedTeller}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTellers ? "Loading tellers..." : "Select a teller"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tellers.map((teller) => (
                    <SelectItem
                      key={teller.id}
                      value={teller.fineractTellerId?.toString() || teller.id}
                    >
                      {teller.name} - {teller.officeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cashier Selection */}
            <div className="space-y-2">
              <Label>Select Cashier *</Label>
              <Select
                value={selectedCashier}
                onValueChange={setSelectedCashier}
                disabled={!selectedTeller || loadingCashiers}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedTeller
                        ? "Select a teller first"
                        : loadingCashiers
                        ? "Loading cashiers..."
                        : cashiers.length === 0
                        ? "No cashiers with active sessions"
                        : "Select a cashier"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cashiers.map((cashier) => (
                    <SelectItem
                      key={cashier.dbId || cashier.id}
                      value={cashier.dbId || cashier.id.toString()}
                    >
                      {cashier.staffName}
                      {cashier.sessionStatus === "ACTIVE" && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Active Session
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeller && cashiers.length === 0 && !loadingCashiers && (
                <p className="text-sm text-yellow-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  No cashiers have active sessions. Start a session first.
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional notes for this payout..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {success}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {payoutStatus === "PAID" ? "Close" : "Cancel"}
          </Button>
          {payoutStatus !== "PAID" && (
            <Button
              onClick={handlePayout}
              disabled={
                loading || !selectedTeller || !selectedCashier || checkingStatus
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Banknote className="mr-2 h-4 w-4" />
                  Process Payout
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

