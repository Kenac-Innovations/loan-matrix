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
import { AlertCircle, TrendingDown } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface DrawdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  availableBalance: number;
  onSuccess: () => void;
}

export function DrawdownModal({
  isOpen,
  onClose,
  leadId,
  availableBalance,
  onSuccess,
}: DrawdownModalProps) {
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
    if (parsedAmount > availableBalance) {
      setError(`Amount exceeds available balance of ${formatAmount(availableBalance)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility/drawdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, transactionDate, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process drawdown");
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
            <TrendingDown className="h-5 w-5 text-blue-600" />
            Record Drawdown
          </DialogTitle>
          <DialogDescription>
            Withdraw funds from the revolving credit facility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Available Balance</p>
            <p className="text-xl font-bold text-blue-600">{formatAmount(availableBalance)}</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="drawdown-amount">Amount *</Label>
            <Input
              id="drawdown-amount"
              inputMode="decimal"
              value={displayAmount}
              onChange={(e) => setDisplayAmount(formatDisplay(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawdown-date">Transaction Date *</Label>
            <Input
              id="drawdown-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawdown-note">Note</Label>
            <Textarea
              id="drawdown-note"
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? "Processing..." : "Confirm Drawdown"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
