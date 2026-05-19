"use client";

import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface RepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  utilizedAmount: number;
  onSuccess: () => void;
}

export function RepaymentModal({
  isOpen,
  onClose,
  leadId,
  utilizedAmount,
  onSuccess,
}: RepaymentModalProps) {
  const { formatAmount } = useCurrency();
  const [displayAmount, setDisplayAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDisplay = (raw: string) => {
    const digits = raw.replace(/[^0-9.]/g, "");
    const parts = digits.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const rawAmount = displayAmount.replace(/,/g, "");

  const handleSubmit = async () => {
    setError(null);
    const parsedAmount = parseFloat(rawAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility/repayment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, transactionDate, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record repayment");
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDisplayAmount("");
    setTransactionDate(new Date().toISOString().split("T")[0]);
    setNote("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Record Repayment
          </DialogTitle>
          <DialogDescription>
            Deposit a repayment into the revolving credit facility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Outstanding Balance</p>
            <p className="text-xl font-bold text-green-600">{formatAmount(utilizedAmount)}</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="repayment-amount">Amount *</Label>
            <Input
              id="repayment-amount"
              inputMode="decimal"
              value={displayAmount}
              onChange={(e) => setDisplayAmount(formatDisplay(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repayment-date">Transaction Date *</Label>
            <Input
              id="repayment-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repayment-note">Note</Label>
            <Textarea
              id="repayment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !rawAmount}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? "Processing..." : "Confirm Repayment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
