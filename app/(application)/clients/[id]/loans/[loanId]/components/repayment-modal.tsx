"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Coins, DollarSign, Percent, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export function RepaymentModal({ isOpen, onClose, loanId, onSuccess }: RepaymentModalProps) {
  const [template, setTemplate] = useState<RepaymentTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
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

  const fetchRepaymentTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/fineract/loans/${loanId}/transactions/template?command=repayment`);
      if (!response.ok) {
        throw new Error(`Failed to fetch repayment template: ${response.statusText}`);
      }
      
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

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      
      // Validate required fields
      if (!formData.transactionDate || !formData.transactionAmount) {
        setError("Transaction Date and Transaction Amount are required");
        return;
      }

      // Format date for Fineract - ISO format
      const dateObj = new Date(formData.transactionDate);
      const formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Prepare payload
      const payload: any = {
        command: "repayment",
        transactionDate: formattedDate,
        transactionAmount: parseFloat(formData.transactionAmount),
        dateFormat: "yyyy-MM-dd",
        locale: "en",
      };

      // Add optional fields if provided
      if (formData.externalId) payload.externalId = formData.externalId;
      if (formData.paymentTypeId) payload.paymentTypeId = parseInt(formData.paymentTypeId);
      if (formData.note) payload.note = formData.note;

      // Add payment details if enabled
      if (formData.showPaymentDetails) {
        if (formData.accountNumber) payload.accountNumber = formData.accountNumber;
        if (formData.checkNumber) payload.checkNumber = formData.checkNumber;
        if (formData.routingCode) payload.routingCode = formData.routingCode;
        if (formData.receiptNumber) payload.receiptNumber = formData.receiptNumber;
        if (formData.bankNumber) payload.bankNumber = formData.bankNumber;
      }

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to submit repayment: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Repayment submitted successfully:", result);
      
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
    setError(null);
    setSuccess(false);
  };

  const formatCurrency = (amount: number, currencyCode: string = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
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
              <Select value={formData.paymentTypeId} onValueChange={(value) => setFormData(prev => ({ ...prev, paymentTypeId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {template.paymentTypeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id.toString()}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  <div className="space-y-2">
                    <Label htmlFor="receipt-number">Receipt #</Label>
                    <Input
                      id="receipt-number"
                      value={formData.receiptNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                      placeholder="Enter receipt number"
                    />
                  </div>
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
            disabled={submitting || !formData.transactionDate || !formData.transactionAmount}
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
