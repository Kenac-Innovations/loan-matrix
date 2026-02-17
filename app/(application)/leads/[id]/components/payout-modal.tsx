"use client";

import { useCurrency } from "@/contexts/currency-context";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Banknote, CheckCircle, AlertCircle, Smartphone, Building2 } from "lucide-react";
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
  currency,
  onSuccess,
}: PayoutModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [disbursementPaymentType, setDisbursementPaymentType] = useState<{
    id: number | null;
    name: string | null;
  }>({ id: null, name: null });

  // Teller and cashier selection
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedTeller, setSelectedTeller] = useState<string>("");
  const [selectedCashier, setSelectedCashier] = useState<string>("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);

  // Payment method selection (when no disbursement payment type exists)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | null
  >(null);

  // Check payout status
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Whether we need user to pick payment method
  const needsPaymentMethodSelection =
    disbursementPaymentType.id == null;
  // Whether cash flow is active (either from Fineract or user selection)
  const isCashFlow =
    disbursementPaymentType.id != null || selectedPaymentMethod === "CASH";

  useEffect(() => {
    if (open) {
      fetchTellers();
      checkPayoutStatus();
      setError(null);
      setSuccess(null);
      setNotes("");
      setDisbursementPaymentType({ id: null, name: null });
      setSelectedPaymentMethod(null);
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
        if (data.disbursementPaymentType) {
          setDisbursementPaymentType({
            id: data.disbursementPaymentType.id ?? null,
            name: data.disbursementPaymentType.name ?? null,
          });
        } else {
          setDisbursementPaymentType({ id: null, name: null });
        }
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
        const activeCashiers = (Array.isArray(data) ? data : []).filter(
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

  // Normalize currency code - converts deprecated ZMK to current code
  const { currencyCode: orgCurrency } = useCurrency();
  const normalizeCurrencyCode = (code: string | undefined | null): string => {
    if (!code) return orgCurrency;
    if (code.toUpperCase() === "ZMK") return "ZMW";
    return code;
  };

  const formatCurrency = (amount: number, curr: string) => {
    return `${normalizeCurrencyCode(curr)} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handlePayout = async () => {
    setError(null);
    setSuccess(null);

    // Determine which payment method is being used
    const paymentMethod = disbursementPaymentType.id
      ? "CASH" // Has Fineract payment type = cash flow
      : selectedPaymentMethod;

    if (!paymentMethod) {
      setError("Please select a payment method");
      return;
    }

    // For cash flow, require teller and cashier
    if (paymentMethod === "CASH") {
      if (!selectedTeller) {
        setError("Please select a teller");
        return;
      }
      if (!selectedCashier) {
        setError("Please select a cashier with an active session");
        return;
      }
    }

    setLoading(true);

    try {
      if (paymentMethod === "CASH") {
        // Cash flow: process through teller/cashier settle endpoint
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
              loanPayoutId: loanId,
              paymentTypeId: disbursementPaymentType.id,
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log("Cash payout processed successfully:", result);

          setSuccess(
            `Successfully paid out ${formatCurrency(principal, currency)} to ${clientName} via Cash`
          );
          setPayoutStatus("PAID");
          onSuccess?.();
          setTimeout(() => {
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
      } else {
        // Non-cash flow (Mobile Money / Bank Transfer): mark payout as paid directly
        const response = await fetch(`/api/loans/${loanId}/payout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "markPaid",
            paymentMethod,
            notes:
              notes ||
              `Loan Payout - ${clientName} via ${
                paymentMethod === "MOBILE_MONEY"
                  ? "Mobile Money"
                  : "Bank Transfer"
              }`,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Non-cash payout processed successfully:", result);

          const methodLabel =
            paymentMethod === "MOBILE_MONEY"
              ? "Mobile Money"
              : "Bank Transfer";
          setSuccess(
            `Successfully paid out ${formatCurrency(principal, currency)} to ${clientName} via ${methodLabel}`
          );
          setPayoutStatus("PAID");
          onSuccess?.();
          setTimeout(() => {
            router.refresh();
            onOpenChange(false);
          }, 2000);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to process payout");
        }
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-600" />
            Loan Payout
          </DialogTitle>
          <DialogDescription>
            Process payout for this disbursed loan
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

            {/* Payment Method Selection - shown when no payment type from Fineract */}
            {needsPaymentMethodSelection && (
              <div className="space-y-2">
                <Label>Select Payment Method *</Label>
                <p className="text-xs text-muted-foreground">
                  No disbursement payment type was recorded. Please select how
                  the client will receive their funds.
                </p>
                <Select
                  value={selectedPaymentMethod || ""}
                  onValueChange={(value) => {
                    setSelectedPaymentMethod(
                      value as "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER"
                    );
                    setError(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <span className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-green-600" />
                        Cash
                      </span>
                    </SelectItem>
                    <SelectItem value="MOBILE_MONEY">
                      <span className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-blue-600" />
                        Mobile Money
                      </span>
                    </SelectItem>
                    <SelectItem value="BANK_TRANSFER">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-600" />
                        Bank Transfer
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Existing Fineract payment type info - shown when payment type exists */}
            {!needsPaymentMethodSelection && (
              <div className="space-y-2">
                <Label>Disbursement Payment Type</Label>
                <Input value={disbursementPaymentType.name || "Cash"} disabled />
                <p className="text-xs text-muted-foreground">
                  This payout uses the payment method selected during loan
                  disbursement.
                </p>
              </div>
            )}

            {/* Teller/Cashier Selection - only shown for cash flow */}
            {isCashFlow ? (
              <>
                <div className="space-y-2">
                  <Label>Select Teller *</Label>
                  <Select
                    value={selectedTeller}
                    onValueChange={setSelectedTeller}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingTellers
                            ? "Loading tellers..."
                            : "Select a teller"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {tellers.map((teller) => (
                        <SelectItem
                          key={teller.id}
                          value={
                            teller.fineractTellerId?.toString() || teller.id
                          }
                        >
                          {teller.name} - {teller.officeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs"
                            >
                              Active Session
                            </Badge>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTeller &&
                    cashiers.length === 0 &&
                    !loadingCashiers && (
                      <p className="text-sm text-yellow-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        No cashiers have active sessions. Start a session first.
                      </p>
                    )}
                </div>
              </>
            ) : null}

            {/* Non-cash info banner */}
            {selectedPaymentMethod &&
              selectedPaymentMethod !== "CASH" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  <p className="font-medium">
                    {selectedPaymentMethod === "MOBILE_MONEY"
                      ? "Mobile Money Payout"
                      : "Bank Transfer Payout"}
                  </p>
                  <p className="text-xs mt-1">
                    The payout will be marked as paid. No cashier balance will be
                    affected.
                  </p>
                </div>
              )}

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
                loading ||
                checkingStatus ||
                // Cash flow requires teller + cashier
                (isCashFlow && (!selectedTeller || !selectedCashier)) ||
                // Must have a payment method selected (either from Fineract or user)
                (needsPaymentMethodSelection && !selectedPaymentMethod)
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
                  {selectedPaymentMethod === "MOBILE_MONEY" ? (
                    <Smartphone className="mr-2 h-4 w-4" />
                  ) : selectedPaymentMethod === "BANK_TRANSFER" ? (
                    <Building2 className="mr-2 h-4 w-4" />
                  ) : (
                    <Banknote className="mr-2 h-4 w-4" />
                  )}
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

