"use client";

import { useCurrency } from "@/contexts/currency-context";
import { fineractFetch } from "@/lib/fineract-fetch";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Coins, DollarSign, Percent, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useReceiptValidation } from "@/hooks/use-receipt-validation";

interface RepaymentTemplate {
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
    displaySymbol: string;
  };
  amount: number;
  principalPortion: number;
  interestPortion: number;
  feeChargesPortion: number;
  penaltyChargesPortion: number;
  paymentTypeOptions: Array<{
    id: number;
    name: string;
    description: string;
    isCashPayment: boolean;
  }>;
}

interface RepaymentModalProps {
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

export function RepaymentModal({ isOpen, onClose, loanId, onSuccess }: RepaymentModalProps) {
  const [template, setTemplate] = useState<RepaymentTemplate | null>(null);
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

  // Teller and cashier selection (for cash payments - stored but not sent to Fineract repayment)
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedTeller, setSelectedTeller] = useState<string>("");
  const [selectedCashier, setSelectedCashier] = useState<string>("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    transactionDate: "",
    transactionAmount: "",
    externalId: "",
    paymentTypeId: "",
    showPaymentDetails: false,
    note: "",
    // Payment details (only shown when showPaymentDetails is true)
    accountNumber: "",
    checkNumber: "",
    routingCode: "",
    receiptNumber: "",
    bankNumber: "",
  });

  // Fetch repayment template when modal opens
  useEffect(() => {
    if (isOpen && loanId) {
      fetchRepaymentTemplate();
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

  const fetchRepaymentTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fineractFetch(`/api/fineract/loans/${loanId}/transactions/template?command=repayment`);
      const data = await response.json();
      setTemplate(data);
      
      // Pre-populate form with template data
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        transactionDate: formattedDate,
        transactionAmount: data.amount?.toString() || "",
      }));
      
    } catch (err) {
      console.error("Error fetching repayment template:", err);
      setError(err instanceof Error ? err.message : "Failed to load repayment template");
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
      
      // Validate required fields
      if (!formData.transactionDate || !formData.transactionAmount) {
        setError("Transaction Date and Transaction Amount are required");
        return;
      }
      if (!formData.paymentTypeId) {
        setError("Payment type is required so the teller balance can be updated.");
        return;
      }

      if (selectedPaymentTypeIsCash) {
        if (!selectedTeller) {
          setError("Please select a teller for cash repayments.");
          return;
        }
        if (!selectedCashier) {
          setError("Please select a cashier with an active session for cash repayments.");
          return;
        }
        // Validate receipt number if receipt ranges are enabled
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

      // Format date for Fineract - ISO format
      const dateObj = new Date(formData.transactionDate);
      const formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Prepare payload
      const payload: any = {
        transactionDate: formattedDate,
        transactionAmount: parseFloat(formData.transactionAmount),
        dateFormat: "yyyy-MM-dd",
        locale: "en",
      };

      // Add optional fields if provided
      if (formData.externalId) payload.externalId = formData.externalId;
      payload.paymentTypeId = parseInt(formData.paymentTypeId, 10);
      if (formData.note) payload.note = formData.note;

      // Do NOT send tellerId/cashierId in repayment - Fineract returns 400. Store only; use for allocate after 200.

      // Add payment details if enabled
      if (formData.showPaymentDetails) {
        if (formData.accountNumber) payload.accountNumber = formData.accountNumber;
        if (formData.checkNumber) payload.checkNumber = formData.checkNumber;
        if (formData.routingCode) payload.routingCode = formData.routingCode;
        if (formData.receiptNumber) payload.receiptNumber = formData.receiptNumber;
        if (formData.bankNumber) payload.bankNumber = formData.bankNumber;
      }

      const response = await fineractFetch(`/api/fineract/loans/${loanId}/transactions?command=repayment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Repayment submitted successfully:", result);

      // Mark receipt number as used
      if (receiptRangesEnabled && formData.receiptNumber.trim()) {
        await markReceiptUsed({
          receiptNumber: formData.receiptNumber.trim(),
          transactionType: "REPAYMENT",
          fineractTxnId: result.resourceId?.toString(),
          loanId,
        });
      }

      // After 200: call allocate with stored teller/cashier (never sent in repayment payload)
      if (selectedPaymentTypeIsCash && selectedTeller && selectedCashier) {
        const amount = parseFloat(formData.transactionAmount);
        const currency = template?.currency?.code ?? orgCurrency;
        const normalizedCurrency = currency?.toUpperCase() === "ZMK" ? "ZMW" : currency ?? orgCurrency;
        const date = formData.transactionDate || new Date().toISOString().split("T")[0];

        try {
          const allocRes = await fetch(
            `/api/tellers/${selectedTeller}/cashiers/${selectedCashier}/allocate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount,
                currency,
                date,
                notes: "Loan repayment",
                source: "repayment",
              }),
            }
          );
          if (!allocRes.ok) {
            const errData = await allocRes.json();
            setError(
              `Repayment recorded, but till balance was not updated: ${errData.error || allocRes.statusText}`
            );
            setSubmitting(false);
            return;
          }
        } catch (allocErr) {
          console.error("Allocate after repayment failed:", allocErr);
          setError(
            "Repayment recorded, but till balance was not updated. Please allocate manually."
          );
          setSubmitting(false);
          return;
        }
      }

      setSuccess(true);

      // Close modal after a short delay
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        resetForm();
      }, 2000);
      
    } catch (err) {
      console.error("Error submitting repayment:", err);
      setError(err instanceof Error ? err.message : "Failed to submit repayment");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transactionDate: "",
      transactionAmount: "",
      externalId: "",
      paymentTypeId: "",
      showPaymentDetails: false,
      note: "",
      accountNumber: "",
      checkNumber: "",
      routingCode: "",
      receiptNumber: "",
      bankNumber: "",
    });
    setSelectedTeller("");
    setSelectedCashier("");
    setError(null);
    setSuccess(false);
  };

  // Normalize currency code - converts deprecated ZMK to current code
  const { currencyCode: orgCurrency } = useCurrency();
  const normalizeCurrencyCode = (code: string | undefined | null): string => {
    if (!code) return orgCurrency;
    if (code.toUpperCase() === "ZMK") return "ZMW";
    return code;
  };

  const formatCurrency = (amount: number, currencyCode: string = orgCurrency): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizeCurrencyCode(currencyCode),
    }).format(amount);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Make Repayment</DialogTitle>
            <DialogDescription>Loading repayment template...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            <Coins className="h-5 w-5 text-blue-600" />
            Make Repayment
          </DialogTitle>
          <DialogDescription>
            Record a loan repayment for loan #{loanId}
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
              Repayment submitted successfully!
            </AlertDescription>
          </Alert>
        )}

        {template && (
          <div className="space-y-6">
            {/* Transaction Date */}
            <div className="space-y-2">
              <Label htmlFor="transaction-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Transaction Date *
              </Label>
              <Input
                id="transaction-date"
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData(prev => ({ ...prev, transactionDate: e.target.value }))}
                className="w-full"
                required
              />
            </div>

            {/* Loan Component Breakdown */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">Loan Component Breakdown</Label>
              <div className="grid gap-2">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">Principal</span>
                  <span className="font-medium">
                    {formatCurrency(template.principalPortion, template.currency.code)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">Interest</span>
                  <span className="font-medium">
                    {formatCurrency(template.interestPortion, template.currency.code)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">Fees</span>
                  <span className="font-medium">
                    {formatCurrency(template.feeChargesPortion, template.currency.code)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">Penalties</span>
                  <span className="font-medium">
                    {formatCurrency(template.penaltyChargesPortion, template.currency.code)}
                  </span>
                </div>
              </div>
            </div>

            {/* Transaction Amount */}
            <div className="space-y-2">
              <Label htmlFor="transaction-amount" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Transaction Amount *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  {template.currency.code}
                </span>
                <Input
                  id="transaction-amount"
                  type="number"
                  step="0.01"
                  value={formData.transactionAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, transactionAmount: e.target.value }))}
                  className="pl-12 bg-muted/50"
                  required
                />
              </div>
            </div>

            {/* External Id */}
            <div className="space-y-2">
              <Label htmlFor="external-id">External Id</Label>
              <Input
                id="external-id"
                value={formData.externalId}
                onChange={(e) => setFormData(prev => ({ ...prev, externalId: e.target.value }))}
                placeholder="Enter external ID"
              />
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label htmlFor="payment-type">Payment Type</Label>
              <Select
                value={formData.paymentTypeId}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, paymentTypeId: value }));
                  const option = mergedPaymentTypeOptions.find((o) => o.id.toString() === value);
                  if (!option?.isCashPayment) {
                    setSelectedTeller("");
                    setSelectedCashier("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {mergedPaymentTypeOptions.length === 0 ? (
                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                      No payment types available
                    </div>
                  ) : (
                    mergedPaymentTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id.toString()}>
                        {option.name}
                        {option.isCashPayment ? " (Cash)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Required. Select a cash payment method to update the teller balance.
              </p>
            </div>

            {/* Teller and Cashier selection (for cash payments) */}
            {selectedPaymentTypeIsCash && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">
                  Cash till location (required for teller balance)
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

            {/* Receipt Number — shown prominently for tenants with receipt ranges on cash payments */}
            {receiptRangesEnabled && selectedPaymentTypeIsCash && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <Label htmlFor="receipt-number-top">
                  Receipt Number <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="receipt-number-top"
                    value={formData.receiptNumber}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, receiptNumber: e.target.value }));
                      clearReceiptValidation();
                      if (e.target.value.trim()) validateReceiptDebounced(e.target.value);
                    }}
                    placeholder="Enter receipt number"
                    className={
                      receiptValidation
                        ? receiptValidation.valid
                          ? "border-green-500 pr-8"
                          : "border-red-500 pr-8"
                        : ""
                    }
                  />
                  {isValidatingReceipt && (
                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!isValidatingReceipt && receiptValidation?.valid && (
                    <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />
                  )}
                  {!isValidatingReceipt && receiptValidation && !receiptValidation.valid && (
                    <AlertCircle className="absolute right-2 top-2.5 h-4 w-4 text-red-500" />
                  )}
                </div>
                {receiptValidation && !receiptValidation.valid && (
                  <p className="text-xs text-red-500">{receiptValidation.error}</p>
                )}
              </div>
            )}

            {/* Show Payment Details Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="show-payment-details"
                checked={formData.showPaymentDetails}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showPaymentDetails: checked }))}
              />
              <Label htmlFor="show-payment-details">Show Payment Details</Label>
            </div>

            {/* Payment Details (conditional) */}
            {formData.showPaymentDetails && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Payment Details</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="account-number">Account #</Label>
                    <Input
                      id="account-number"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      placeholder="Enter account number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="check-number">Cheque #</Label>
                    <Input
                      id="check-number"
                      value={formData.checkNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, checkNumber: e.target.value }))}
                      placeholder="Enter cheque number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="routing-code">Routing Code</Label>
                    <Input
                      id="routing-code"
                      value={formData.routingCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, routingCode: e.target.value }))}
                      placeholder="Enter routing code"
                    />
                  </div>
                  {!receiptRangesEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="receipt-number">Receipt #</Label>
                      <Input
                        id="receipt-number"
                        value={formData.receiptNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                        placeholder="Enter receipt number"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="bank-number">Bank #</Label>
                    <Input
                      id="bank-number"
                      value={formData.bankNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankNumber: e.target.value }))}
                      placeholder="Enter bank number"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Enter any additional notes"
                rows={3}
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
              !formData.paymentTypeId ||
              (selectedPaymentTypeIsCash && (!selectedTeller || !selectedCashier))
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
