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
import { Input } from "@/components/ui/input";
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

  const [formData, setFormData] = useState({
    transactionDate: "",
    transactionAmount: "",
    note: "",
  });

  useEffect(() => {
    if (isOpen && loanId) {
      fetchTemplate();
    }
  }, [isOpen, loanId]);

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

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!formData.transactionDate || !formData.transactionAmount) {
        setError("Transaction Date and Transaction Amount are required");
        return;
      }

      const dateObj = new Date(formData.transactionDate);
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const payload: any = {
        transactionDate: formattedDate,
        transactionAmount: parseFloat(formData.transactionAmount),
        dateFormat: "dd MMMM yyyy",
        locale: "en",
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
      note: "",
    });
    setError(null);
    setSuccess(false);
  };

  const { currencyCode: orgCurrency } = useCurrency();
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
      <DialogContent className="max-w-md">
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
              !formData.transactionAmount
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
