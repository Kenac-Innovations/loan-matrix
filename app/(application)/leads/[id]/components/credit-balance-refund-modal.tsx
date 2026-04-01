"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Coins,
  DollarSign,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useReceiptValidation } from "@/hooks/use-receipt-validation";

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
  paymentTypeOptions?: Array<{
    id: number;
    name: string;
    description?: string;
    isCashPayment?: boolean;
  }>;
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

interface CreditBalanceRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  onSuccess: () => void;
}

export function CreditBalanceRefundModal({
  isOpen,
  onClose,
  loanId,
  onSuccess,
}: CreditBalanceRefundModalProps) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [template, setTemplate] = useState<RefundTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);

  const {
    receiptRangesEnabled,
    isValidating: isValidatingReceipt,
    validationResult: receiptValidation,
    validate: validateReceipt,
    validateDebounced: validateReceiptDebounced,
    markUsed: markReceiptUsed,
    clearValidation: clearReceiptValidation,
  } = useReceiptValidation();

  const [tellers, setTellers] = useState<Teller[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedTeller, setSelectedTeller] = useState<string>("");
  const [selectedCashier, setSelectedCashier] = useState<string>("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);

  const [formData, setFormData] = useState({
    transactionDate: "",
    transactionAmount: "",
    paymentTypeId: "",
    note: "",
    receiptNumber: "",
  });

  useEffect(() => {
    if (isOpen && loanId) {
      fetchTemplate();
    }
  }, [isOpen, loanId]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPaymentTypes = async () => {
      try {
        const res = await fetch("/api/fineract/paymenttypes");
        if (!res.ok) throw new Error("Failed to load payment types");
        const data = await res.json();
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
    fetchPaymentTypes();
  }, [isOpen]);

  const fetchTellers = async () => {
    setLoadingTellers(true);
    try {
      const response = await fetch("/api/tellers");
      if (response.ok) {
        const data = await response.json();
        setTellers(data || []);
      }
    } catch (e) {
      console.error("Error fetching tellers:", e);
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
          (c: Cashier) => c.sessionStatus === "ACTIVE"
        );
        setCashiers(activeCashiers);
      }
    } catch (e) {
      console.error("Error fetching cashiers:", e);
    } finally {
      setLoadingCashiers(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchTellers();
  }, [isOpen]);

  useEffect(() => {
    if (selectedTeller) {
      fetchCashiers(selectedTeller);
    } else {
      setCashiers([]);
      setSelectedCashier("");
    }
  }, [selectedTeller]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/fineract/loans/${loanId}/transactions/credit-balance-refund-template`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }

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
  };

  const mergedPaymentTypeOptions = useMemo(() => {
    const templateOptions = template?.paymentTypeOptions ?? [];
    if (templateOptions.length === 0) return paymentTypes;
    const paymentTypeMap = new Map(paymentTypes.map((pt) => [pt.id, pt]));
    return templateOptions.map((option) => {
      const mapped = paymentTypeMap.get(option.id);
      return {
        ...option,
        isCashPayment: option.isCashPayment ?? mapped?.isCashPayment ?? false,
      };
    });
  }, [template, paymentTypes]);

  const selectedPaymentTypeIsCash = useMemo(() => {
    if (!formData.paymentTypeId) return false;
    const option = mergedPaymentTypeOptions.find(
      (o) => o.id.toString() === formData.paymentTypeId
    );
    return !!option?.isCashPayment;
  }, [formData.paymentTypeId, mergedPaymentTypeOptions]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!formData.transactionDate || !formData.transactionAmount) {
        setError("Transaction Date and Transaction Amount are required");
        return;
      }
      if (!formData.paymentTypeId) {
        setError("Payment type is required.");
        return;
      }

      if (selectedPaymentTypeIsCash) {
        if (!selectedTeller) {
          setError("Please select a teller for cash refunds.");
          return;
        }
        if (!selectedCashier) {
          setError(
            "Please select a cashier with an active session for cash refunds."
          );
          return;
        }
        if (receiptRangesEnabled) {
          if (!formData.receiptNumber.trim()) {
            setError("Receipt number is required for cash transactions.");
            return;
          }
          const result = await validateReceipt(formData.receiptNumber);
          if (!result.valid) {
            setError(result.error || "Invalid receipt number");
            return;
          }
        }
      }

      const dateObj = new Date(formData.transactionDate);
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const payload: Record<string, unknown> = {
        transactionDate: formattedDate,
        transactionAmount: parseFloat(formData.transactionAmount),
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        paymentTypeId: parseInt(formData.paymentTypeId, 10),
      };

      if (formData.note) payload.note = formData.note;

      const response = await fetch(
        `/api/fineract/loans/${loanId}/transactions/credit-balance-refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.defaultUserMessage ||
            errorData.error ||
            `Failed to submit credit balance refund: ${response.statusText}`
        );
      }

      const result = (await response.json()) as { resourceId?: number };

      if (receiptRangesEnabled && formData.receiptNumber.trim()) {
        await markReceiptUsed({
          receiptNumber: formData.receiptNumber.trim(),
          transactionType: "CREDIT_BALANCE_REFUND",
          fineractTxnId: result.resourceId?.toString(),
          loanId,
        });
      }

      if (selectedPaymentTypeIsCash && selectedTeller && selectedCashier) {
        const amount = parseFloat(formData.transactionAmount);
        const currency =
          template?.currency?.code ?? orgCurrency;
        const date = formData.transactionDate;

        const settleRes = await fetch(
          `/api/tellers/${selectedTeller}/cashiers/${selectedCashier}/settle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount,
              currency,
              date,
              notes: formData.note || undefined,
              transactionType: "CREDIT_BALANCE_REFUND",
              fineractLoanId: loanId,
            }),
          }
        );

        if (!settleRes.ok) {
          const errData = await settleRes.json();
          setError(
            `Refund recorded in Fineract, but the cashier till was not updated: ${errData.error || errData.details || settleRes.statusText}`
          );
          setSubmitting(false);
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
      receiptNumber: "",
    });
    setSelectedTeller("");
    setSelectedCashier("");
    setError(null);
    setSuccess(false);
  };

  const normalizeCurrencyCode = (code: string | undefined | null): string => {
    if (!code) return orgCurrency;
    if (code.toUpperCase() === "ZMK") return "ZMW";
    return code;
  };

  const formatCurrency = (
    amount: number,
    currencyCode?: string
  ): string => {
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
              <Label htmlFor="cbr-payment-type">Payment type *</Label>
              <Select
                value={formData.paymentTypeId}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, paymentTypeId: value }));
                  const option = mergedPaymentTypeOptions.find(
                    (o) => o.id.toString() === value
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
                  {mergedPaymentTypeOptions.length === 0 ? (
                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                      No payment types available
                    </div>
                  ) : (
                    mergedPaymentTypeOptions.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id.toString()}
                      >
                        {option.name}
                        {option.isCashPayment ? " (Cash)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For cash, choose the till that pays the customer; the cashier
                balance will be reduced after the Fineract refund is posted.
              </p>
            </div>

            {selectedPaymentTypeIsCash && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">
                  Cash till (pays customer — required for till balance)
                </Label>
                <div className="space-y-2">
                  <Label>Teller *</Label>
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
                            teller.fineractTellerId?.toString() ||
                            teller.id
                          }
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
                          {cashier.sessionStatus === "ACTIVE" && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (Active)
                            </span>
                          )}
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

            {receiptRangesEnabled && selectedPaymentTypeIsCash && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <Label htmlFor="cbr-receipt-number">
                  Receipt number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cbr-receipt-number"
                  value={formData.receiptNumber}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      receiptNumber: e.target.value,
                    }));
                    clearReceiptValidation();
                    if (e.target.value.trim()) {
                      validateReceiptDebounced(e.target.value);
                    }
                  }}
                  placeholder="Enter receipt number"
                  className={
                    receiptValidation
                      ? receiptValidation.valid
                        ? "border-green-500"
                        : "border-red-500"
                      : ""
                  }
                />
                {isValidatingReceipt && (
                  <p className="text-xs text-muted-foreground">Validating…</p>
                )}
                {receiptValidation && !receiptValidation.valid && (
                  <p className="text-xs text-red-600">
                    {receiptValidation.error}
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
