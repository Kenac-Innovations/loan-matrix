"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface DisburseModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  onSuccess: () => void;
}

export function DisburseModal({ isOpen, onClose, loanId, onSuccess }: DisburseModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [transactionDate, setTransactionDate] = useState<Date | null>(null);
  const [transactionAmount, setTransactionAmount] = useState<number>(0);
  const [currencySymbol, setCurrencySymbol] = useState<string>("$");
  const [externalId, setExternalId] = useState("");
  const [paymentTypeId, setPaymentTypeId] = useState<string>("");
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<any[]>([]);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [routingCode, setRoutingCode] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/fineract/loans/${loanId}/transactions/template?command=disburse`);
        if (!res.ok) throw new Error("Failed to load disbursement template");
        const data = await res.json();

        // Date
        if (Array.isArray(data.date) && data.date.length === 3) {
          const [y, m, d] = data.date;
          setTransactionDate(new Date(y, m - 1, d));
        } else {
          setTransactionDate(new Date());
        }

        // Currency + amount
        setTransactionAmount(typeof data.amount === 'number' ? data.amount : 0);
        if (data.currency?.displaySymbol) setCurrencySymbol(String(data.currency.displaySymbol));

        // Payment types - from template, or fetch from API if not included
        let paymentTypeList = Array.isArray(data.paymentTypeOptions) ? data.paymentTypeOptions : [];
        if (paymentTypeList.length === 0) {
          try {
            const ptRes = await fetch("/api/fineract/paymenttypes");
            if (ptRes.ok) {
              const ptData = await ptRes.json();
              paymentTypeList = Array.isArray(ptData) ? ptData : ptData?.pageItems ?? [];
            }
          } catch (err) {
            console.error("Failed to fetch payment types:", err);
          }
        }
        setPaymentTypeOptions(paymentTypeList);

        // Auto-select payment type: USSD loanMatrixPaymentMethodId, or first cash, or first option
        let selectedPaymentId = "";
        try {
          const loanRes = await fetch(`/api/fineract/loans/${loanId}`);
          if (loanRes.ok) {
            const loan = await loanRes.json();
            const loanExternalId = loan?.externalId;
            if (loanExternalId) {
              setExternalId(loanExternalId);
              const ussdRes = await fetch(`/api/ussd-leads/by-id/${loanExternalId}`);
              if (ussdRes.ok) {
                const ussd = await ussdRes.json();
                const pmId = ussd?.loanMatrixPaymentMethodId;
                if (pmId && paymentTypeList.length > 0) {
                  const match = paymentTypeList.find((p: any) => p.id === pmId);
                  if (match) selectedPaymentId = String(pmId);
                }
              }
            }
          }
        } catch (error) {
          console.error("Error auto-selecting payment type:", error);
        }
        if (!selectedPaymentId && paymentTypeList.length > 0) {
          const firstCash = paymentTypeList.find((p: any) => p.isCashPayment);
          selectedPaymentId = String((firstCash || paymentTypeList[0]).id);
        }
        if (selectedPaymentId) setPaymentTypeId(selectedPaymentId);
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to load disbursement data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [isOpen, loanId]);

  const handleSubmit = async () => {
    if (!transactionDate) {
      toast({ title: "Validation Error", description: "Please select disbursement date.", variant: "destructive" });
      return;
    }
    if (!transactionAmount || transactionAmount <= 0) {
      toast({ title: "Validation Error", description: "Enter a valid transaction amount.", variant: "destructive" });
      return;
    }
    if (!paymentTypeId) {
      toast({ title: "Validation Error", description: "Please select a payment type for this disbursement.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        actualDisbursementDate: format(transactionDate, "dd MMMM yyyy"),
        transactionAmount,
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        note,
      };
      if (externalId) payload.externalId = externalId;
      payload.paymentTypeId = Number(paymentTypeId);
      if (accountNumber) payload.accountNumber = accountNumber;
      if (checkNumber) payload.checkNumber = checkNumber;
      if (routingCode) payload.routingCode = routingCode;
      if (receiptNumber) payload.receiptNumber = receiptNumber;
      if (bankNumber) payload.bankNumber = bankNumber;

      const res = await fetch(`/api/fineract/loans/${loanId}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        let msg = 'Failed to disburse loan';
        if (err?.errorData?.defaultUserMessage) msg = err.errorData.defaultUserMessage;
        else if (err?.errorData?.developerMessage) msg = err.errorData.developerMessage;
        else if (err?.error) msg = err.error;
        throw new Error(msg);
      }

      toast({ title: 'Success', description: 'Loan disbursed successfully.' });
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Disbursement failed.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Disburse Loan</DialogTitle>
          <DialogDescription>Provide disbursement details and submit.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Disbursed On *</Label>
              <Input
                type="date"
                value={transactionDate ? new Date(transactionDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  setTransactionDate(d);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Transaction Amount * {currencySymbol}</Label>
              <Input
                type="number"
                step="0.01"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>External Id</Label>
              <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} />
            </div>

            {/* Payment Methods Section */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-medium">Payment Method</h4>
              <p className="text-xs text-muted-foreground">
                Select how the disbursement will be paid to the client
              </p>
              <div className="space-y-2">
                <Label htmlFor="payment-type">Payment Type</Label>
                <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
                  <SelectTrigger id="payment-type">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypeOptions.length === 0 ? (
                      <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                        No payment methods available
                      </div>
                    ) : (
                      paymentTypeOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                          {p.isCashPayment ? " (Cash)" : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="show-payment-details"
                type="checkbox"
                checked={showPaymentDetails}
                onChange={(e) => setShowPaymentDetails(e.target.checked)}
              />
              <Label htmlFor="show-payment-details">Show Payment Details</Label>
            </div>

            {showPaymentDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account #</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cheque #</Label>
                  <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Routing Code</Label>
                  <Input value={routingCode} onChange={(e) => setRoutingCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Receipt #</Label>
                  <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Bank #</Label>
                  <Input value={bankNumber} onChange={(e) => setBankNumber(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !transactionDate || !transactionAmount}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




