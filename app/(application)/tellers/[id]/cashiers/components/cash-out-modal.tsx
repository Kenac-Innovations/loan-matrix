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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ArrowUpRight, Search, Banknote, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CashOutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  onSuccess?: () => void;
}

interface Currency {
  code: string;
  name: string;
  displaySymbol?: string;
}

interface PendingPayout {
  id: number; // Fineract loan ID
  loanId: number;
  clientId: number;
  clientName: string;
  loanAccountNo: string;
  productName: string;
  principal: number;
  disbursedAmount: number;
  currency: string;
  disbursementDate?: any;
  status?: string;
}

export function CashOutModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
  onSuccess,
}: CashOutModalProps) {
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Transaction type
  const [transactionType, setTransactionType] = useState<
    "EXPENSE" | "DISBURSEMENT"
  >("EXPENSE");

  // Pending payouts for disbursement
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [payoutSearch, setPayoutSearch] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<PendingPayout | null>(
    null
  );

  const [formData, setFormData] = useState({
    amount: "",
    currency: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchCurrencies();
      setError(null);
      setSuccess(null);
      setTransactionType("EXPENSE");
      setSelectedPayout(null);
      setPayoutSearch("");
    } else {
      // Reset form when modal closes
      setFormData({
        amount: "",
        currency: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
      });
      setError(null);
      setSuccess(null);
      setTransactionType("EXPENSE");
      setSelectedPayout(null);
      setPendingPayouts([]);
    }
  }, [open]);

  // Fetch pending payouts when transaction type changes to DISBURSEMENT
  useEffect(() => {
    if (transactionType === "DISBURSEMENT" && open) {
      fetchPendingPayouts();
    }
  }, [transactionType, open]);

  // Auto-fill amount when payout is selected
  useEffect(() => {
    if (selectedPayout) {
      const amount = selectedPayout.disbursedAmount || selectedPayout.principal;
      setFormData((prev) => ({
        ...prev,
        amount: amount.toString(),
        currency: selectedPayout.currency || prev.currency,
        notes: `Loan Disbursement - ${selectedPayout.clientName} - Account: ${selectedPayout.loanAccountNo}`,
      }));
    }
  }, [selectedPayout]);

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
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

        // Set default currency if available
        if (currencyList.length > 0 && !formData.currency) {
          setFormData((prev) => ({ ...prev, currency: currencyList[0].code }));
        }
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const fetchPendingPayouts = async () => {
    setLoadingPayouts(true);
    try {
      const response = await fetch(`/api/loans/pending-payouts`);
      if (response.ok) {
        const data = await response.json();
        setPendingPayouts(data.pendingPayouts || []);
      }
    } catch (error) {
      console.error("Error fetching pending payouts:", error);
    } finally {
      setLoadingPayouts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!formData.currency) {
      setError("Please select a currency");
      return;
    }

    if (transactionType === "DISBURSEMENT" && !selectedPayout) {
      setError("Please select a loan to disburse");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parseFloat(formData.amount),
            currency: formData.currency,
            notes:
              formData.notes ||
              (transactionType === "EXPENSE" ? "Expense" : "Loan Disbursement"),
            date: formData.date,
            transactionType,
            // Pass the Fineract loan ID for disbursement
            loanPayoutId: selectedPayout ? selectedPayout.loanId : undefined,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const typeLabel =
          transactionType === "DISBURSEMENT" ? "Disbursement" : "Cash Out";
        setSuccess(
          `${typeLabel} successful: ${formData.currency} ${parseFloat(
            formData.amount
          ).toFixed(2)}${
            selectedPayout ? ` to ${selectedPayout.clientName}` : ""
          }`
        );

        // Reset form
        setFormData({
          amount: "",
          currency: formData.currency,
          notes: "",
          date: new Date().toISOString().split("T")[0],
        });
        setSelectedPayout(null);

        // Call onSuccess callback if provided
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            onOpenChange(false);
          }, 1500);
        }
      } else {
        const errorData = await response.json();
        console.error("Cash Out error:", errorData);
        const defaultUserMessage =
          errorData.fineractError?.errors?.[0]?.defaultUserMessage ||
          errorData.fineractError?.defaultUserMessage ||
          errorData.details ||
          errorData.error;

        setError(defaultUserMessage || "Failed to process cash out");
      }
    } catch (error) {
      console.error("Error processing cash out:", error);
      setError("Failed to process cash out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (value: string) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Filter pending payouts based on search
  const filteredPayouts = pendingPayouts.filter((payout) => {
    if (!payoutSearch) return true;
    const searchLower = payoutSearch.toLowerCase();
    return (
      payout.clientName.toLowerCase().includes(searchLower) ||
      payout.loanAccountNo.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-red-600" />
            Cash Out
          </DialogTitle>
          <DialogDescription>
            {cashierName
              ? `Process cash out from ${cashierName}'s drawer`
              : "Process cash out from the cashier's drawer"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Transaction Type Selection */}
            <div className="space-y-3">
              <Label>Transaction Type *</Label>
              <RadioGroup
                value={transactionType}
                onValueChange={(value) => {
                  setTransactionType(value as "EXPENSE" | "DISBURSEMENT");
                  setSelectedPayout(null);
                  setFormData((prev) => ({ ...prev, amount: "", notes: "" }));
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 flex-1">
                  <RadioGroupItem value="EXPENSE" id="expense" />
                  <Label
                    htmlFor="expense"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Receipt className="h-4 w-4 text-orange-500" />
                    <div>
                      <div className="font-medium">Expense</div>
                      <div className="text-xs text-muted-foreground">
                        Regular cash out
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 flex-1">
                  <RadioGroupItem value="DISBURSEMENT" id="disbursement" />
                  <Label
                    htmlFor="disbursement"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Banknote className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="font-medium">Loan Disbursement</div>
                      <div className="text-xs text-muted-foreground">
                        Pay out a loan
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Pending Payouts List (for Disbursement) */}
            {transactionType === "DISBURSEMENT" && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label>Select Loan to Disburse *</Label>
                  <Badge variant="outline">
                    {filteredPayouts.length} pending
                  </Badge>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client name or account number..."
                    value={payoutSearch}
                    onChange={(e) => setPayoutSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Payouts List */}
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {loadingPayouts ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Loading pending payouts...
                    </div>
                  ) : filteredPayouts.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      {payoutSearch
                        ? "No matching loans found"
                        : "No pending payouts"}
                    </div>
                  ) : (
                    filteredPayouts.map((payout) => (
                      <div
                        key={payout.loanId}
                        onClick={() => setSelectedPayout(payout)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPayout?.loanId === payout.loanId
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {payout.clientName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Account: {payout.loanAccountNo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payout.productName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">
                              {formatCurrency(
                                payout.disbursedAmount || payout.principal,
                                payout.currency
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedPayout && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm font-medium text-green-800">
                      Selected: {selectedPayout.clientName}
                    </div>
                    <div className="text-xs text-green-600">
                      {selectedPayout.loanAccountNo} -{" "}
                      {formatCurrency(
                        selectedPayout.disbursedAmount || selectedPayout.principal,
                        selectedPayout.currency
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    amount: formatAmount(e.target.value),
                  }))
                }
                className="text-lg font-semibold"
                required
                disabled={
                  transactionType === "DISBURSEMENT" && selectedPayout !== null
                }
              />
              {transactionType === "DISBURSEMENT" && selectedPayout && (
                <p className="text-xs text-muted-foreground">
                  Amount auto-filled from selected loan
                </p>
              )}
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currency: e.target.value }))
                }
                disabled={
                  loadingCurrencies ||
                  (transactionType === "DISBURSEMENT" &&
                    selectedPayout !== null)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                {loadingCurrencies ? (
                  <option value="">Loading currencies...</option>
                ) : currencies.length === 0 ? (
                  <option value="">No currencies available</option>
                ) : (
                  currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Transaction Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Transaction notes (optional)"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                {success}
              </div>
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
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.amount ||
                !formData.currency ||
                (transactionType === "DISBURSEMENT" && !selectedPayout)
              }
              variant="destructive"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  {transactionType === "DISBURSEMENT"
                    ? "Disburse Loan"
                    : "Remove Cash"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
