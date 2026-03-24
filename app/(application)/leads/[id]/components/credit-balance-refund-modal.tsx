"use client";

import { useCurrency } from "@/contexts/currency-context";
import { fineractFetch } from "@/lib/fineract-fetch";
import { useCallback, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Coins,
  DollarSign,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RefundTemplate {
  loanId: number;
  externalLoanId?: string;
  type: {
    id: number;
    code: string;
    value: string;
  };
  date: number[];
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displayLabel: string;
  };
  amount: number;
  numberOfRepayments: number;
}

interface CreditBalanceRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  onSuccess: () => void;
}

interface PaymentType {
  id: number;
  name: string;
  description?: string;
  isCashPayment?: boolean;
}

interface Teller {
  id: string;
  fineractTellerId?: number;
  name: string;
  officeName?: string;
}

interface Cashier {
  id: string | number;
  dbId?: string;
  staffName: string;
  sessionStatus?: string;
}

export function CreditBalanceRefundModal({
  isOpen,
  onClose,
  loanId,
  onSuccess,
}: CreditBalanceRefundModalProps) {
  const [template, setTemplate] = useState<RefundTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedTeller, setSelectedTeller] = useState("");
  const [selectedCashier, setSelectedCashier] = useState("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);

  const [formData, setFormData] = useState({
    transactionDate: "",
    transactionAmount: "",
    paymentTypeId: "",
    note: "",
  });

  const fetchTemplate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fineractFetch(
        `/api/fineract/loans/${loanId}/transactions/credit-balance-refund-template`
      );
      const data: RefundTemplate = await response.json();
      setTemplate(data);

      const templateDate = Array.isArray(data.date)
        ? new Date(data.date[0], data.date[1] - 1, data.date[2])
        : new Date();
      const formattedDate = templateDate.toISOString().split("T")[0];

      setFormData((prev) => ({
        ...prev,
        transactionDate: formattedDate,
        transactionAmount: data.amount?.toString() || "",
      }));
    } catch (err) {
      console.error("Error fetching credit balance refund template:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load template"
      );
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    if (isOpen && loanId) {
      void fetchTemplate();
      void fetchPaymentTypes();
      void fetchTellers();
    }
  }, [fetchTemplate, isOpen, loanId]);

  useEffect(() => {
    if (selectedTeller) {
      void fetchCashiers(selectedTeller);
    } else {
      setCashiers([]);
      setSelectedCashier("");
    }
  }, [selectedTeller]);

  const fetchPaymentTypes = async () => {
    try {
      const response = await fetch("/api/fineract/paymenttypes");
      if (!response.ok) {
        throw new Error("Failed to load payment types");
      }

      const data = await response.json();
      const list: PaymentType[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.pageItems)
        ? data.pageItems
        : [];
      setPaymentTypes(list);
    } catch (err) {
      console.error("Error fetching payment types:", err);
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
    } catch (err) {
      console.error("Error fetching tellers:", err);
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
        const activeCashiers = (Array.isArray(data) ? data : []).filter(
          (cashier: Cashier) => cashier.sessionStatus === "ACTIVE"
        );
        setCashiers(activeCashiers);
      }
    } catch (err) {
      console.error("Error fetching cashiers:", err);
    } finally {
      setLoadingCashiers(false);
    }
  };

  const selectedPaymentType = paymentTypes.find(
    (paymentType) => paymentType.id.toString() === formData.paymentTypeId
  );
  const selectedPaymentTypeIsCash = !!selectedPaymentType?.isCashPayment;

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!formData.transactionDate || !formData.transactionAmount) {
        setError("Transaction Date and Transaction Amount are required");
        return;
      }

      if (!formData.paymentTypeId) {
        setError("Payment type is required for the refund.");
        return;
      }

      if (selectedPaymentTypeIsCash && !selectedTeller) {
        setError("Please select a teller for cash refunds.");
        return;
      }

      if (selectedPaymentTypeIsCash && !selectedCashier) {
        setError(
          "Please select a cashier with an active session for cash refunds."
        );
        return;
      }

      const payload: {
        transactionDate: string;
        transactionAmount: number;
        dateFormat: string;
        locale: string;
        paymentTypeId: number;
        note?: string;
      } = {
        transactionDate: formData.transactionDate,
        transactionAmount: parseFloat(formData.transactionAmount),
        dateFormat: "yyyy-MM-dd",
        locale: "en",
        paymentTypeId: parseInt(formData.paymentTypeId, 10),
      };

      if (formData.note) {
        payload.note = formData.note;
      }

      await fineractFetch(
        `/api/fineract/loans/${loanId}/transactions/credit-balance-refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (selectedPaymentTypeIsCash && selectedTeller && selectedCashier) {
        const settleResponse = await fetch(
          `/api/tellers/${selectedTeller}/cashiers/${selectedCashier}/settle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: parseFloat(formData.transactionAmount),
              currency: template?.currency?.code ?? orgCurrency,
              date: formData.transactionDate,
              notes: formData.note || "Credit balance refund",
              transactionType: "CREDIT_BALANCE_REFUND",
            }),
          }
        );

        if (!settleResponse.ok) {
          const settleError = await settleResponse.json().catch(() => null);
          setError(
            `Refund recorded, but cashier balance was not updated: ${
              settleError?.error || settleResponse.statusText
            }`
          );
          return;
        }
      }

      setSuccess(true);

      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        resetForm();
      }, 2000);
    } catch (err) {
      console.error("Error submitting credit balance refund:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit credit balance refund"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transactionDate: "",
      transactionAmount: "",
      paymentTypeId: "",
      note: "",
    });
    setSelectedTeller("");
    setSelectedCashier("");
    setError(null);
    setSuccess(false);
  };

  const { currencyCode: orgCurrency } = useCurrency();
  const normalizeCurrencyCode = (code: string | undefined | null): string => {
    if (!code) return orgCurrency;
    if (code.toUpperCase() === "ZMK") return "ZMW";
    return code;
  };

  const formatCurrency = (amount: number, currencyCode?: string): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizeCurrencyCode(currencyCode),
    }).format(amount);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Credit Balance Refund</DialogTitle>
            <DialogDescription>Loading...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-green-600" />
            Credit Balance Refund
          </DialogTitle>
          <DialogDescription>
            Refund the overpaid credit balance for loan #{loanId}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Credit Balance Refund submitted successfully!
            </AlertDescription>
          </Alert>
        )}

        {template && (
          <div className="space-y-5">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Credit Balance Available
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(template.amount, template.currency?.code)}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="cbr-transaction-date"
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Transaction Date *
              </Label>
              <Input
                id="cbr-transaction-date"
                type="date"
                value={formData.transactionDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transactionDate: e.target.value,
                  }))
                }
                className="w-full"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="cbr-transaction-amount"
                className="flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Transaction Amount *
              </Label>
              <Input
                id="cbr-transaction-amount"
                type="number"
                step="0.01"
                max={template.amount}
                value={formData.transactionAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transactionAmount: e.target.value,
                  }))
                }
                className="bg-muted/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cbr-payment-type">Payment Type *</Label>
              <Select
                value={formData.paymentTypeId}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, paymentTypeId: value }));
                  const option = paymentTypes.find(
                    (paymentType) => paymentType.id.toString() === value
                  );
                  if (!option?.isCashPayment) {
                    setSelectedTeller("");
                    setSelectedCashier("");
                  }
                }}
              >
                <SelectTrigger id="cbr-payment-type">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.length === 0 ? (
                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                      No payment types available
                    </div>
                  ) : (
                    paymentTypes.map((option) => (
                      <SelectItem key={option.id} value={option.id.toString()}>
                        {option.name}
                        {option.isCashPayment ? " (Cash)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a cash payment type when the refund is handed back from a
                cashier till.
              </p>
            </div>

            {selectedPaymentTypeIsCash && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">
                  Cash till location (required for cashier balance)
                </Label>

                <div className="space-y-2">
                  <Label>Teller *</Label>
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
                          {teller.name}
                          {teller.officeName ? ` - ${teller.officeName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cashier *</Label>
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
                          value={String(cashier.id)}
                        >
                          {cashier.staffName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTeller && cashiers.length === 0 && !loadingCashiers && (
                  <p className="text-sm text-amber-600">
                    No cashiers have active sessions. Start a session first.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cbr-note">Note</Label>
              <Textarea
                id="cbr-note"
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Optional note"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !formData.transactionDate ||
              !formData.transactionAmount ||
              !formData.paymentTypeId
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              "Submit Refund"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
