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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export type ReverseCashierEntryInitial = {
  amount?: string;
  transactionDate?: string;
  notes?: string;
  originalCashDirection: "cashIn" | "cashOut";
  sourceTxnTypeCode?: string;
  sourceTxnTypeValue?: string;
  sourceNotes?: string;
  sourceFineractTransactionId?: number;
  lockDirection?: boolean;
};

interface ReverseCashierEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  currencyCode: string;
  onSuccess: () => void;
  /** From a table row; omit for header “manual” entry */
  initial?: ReverseCashierEntryInitial | null;
}

export function ReverseCashierEntryModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  currencyCode,
  onSuccess,
  initial,
}: ReverseCashierEntryModalProps) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [originalCashDirection, setOriginalCashDirection] = useState<
    "cashIn" | "cashOut"
  >("cashIn");
  const [sourcePayload, setSourcePayload] = useState<{
    sourceTxnTypeCode?: string;
    sourceTxnTypeValue?: string;
    sourceNotes?: string;
    sourceFineractTransactionId?: number;
  }>({});
  const [lockDirection, setLockDirection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setAmount(initial.amount ?? "");
      setNotes(initial.notes ?? "");
      setTransactionDate(
        initial.transactionDate ?? new Date().toISOString().split("T")[0]
      );
      setOriginalCashDirection(initial.originalCashDirection);
      setLockDirection(!!initial.lockDirection);
      setSourcePayload({
        sourceTxnTypeCode: initial.sourceTxnTypeCode,
        sourceTxnTypeValue: initial.sourceTxnTypeValue,
        sourceNotes: initial.sourceNotes,
        sourceFineractTransactionId: initial.sourceFineractTransactionId,
      });
    } else {
      setAmount("");
      setNotes("");
      setTransactionDate(new Date().toISOString().split("T")[0]);
      setOriginalCashDirection("cashIn");
      setLockDirection(false);
      setSourcePayload({});
    }
  }, [open, initial]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    const n = Number.parseFloat(amount);
    if (!amount.trim() || Number.isNaN(n) || n <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (!currencyCode) {
      setError("Select a currency on the page first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "reverseCashierEntry",
            originalCashDirection,
            amount: n,
            currencyCode,
            transactionDate,
            notes: notes.trim() || undefined,
            ...sourcePayload,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || data.details || `Request failed (${res.status})`
        );
      }
      const desc =
        data.opposingMovement === "allocate"
          ? "Fineract allocate posted on the cashier (reverse cash-out)."
          : "Fineract settle posted on the cashier (reverse cash-in).";
      toast({
        title: "Cashier counter-entry posted",
        description: desc,
      });
      handleOpenChange(false);
      onSuccess();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      toast({
        variant: "destructive",
        title: "Could not post counter-entry",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = initial?.lockDirection
    ? "Reverse on cashier"
    : "Reverse cashier movement";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <span className="block">
              Posts the <strong>opposing</strong> cashier entry only (Fineract{" "}
              {originalCashDirection === "cashIn" ? "settle" : "allocate"}) —{" "}
              <strong>does not change the loan</strong>.
            </span>
            <span className="block text-muted-foreground">
              Loan <strong>repayment</strong> and <strong>disbursement</strong>{" "}
              lines cannot be reversed here; use the loan transaction Undo / Undo
              disbursal.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label>Original movement on till</Label>
            {lockDirection ? (
              <p className="text-sm text-muted-foreground">
                {originalCashDirection === "cashIn"
                  ? "Cash in — counter-entry will settle (cash out to teller)."
                  : "Cash out — counter-entry will allocate (cash in from teller)."}
              </p>
            ) : (
              <RadioGroup
                value={originalCashDirection}
                onValueChange={(v) =>
                  setOriginalCashDirection(v as "cashIn" | "cashOut")
                }
                className="flex flex-col gap-2"
                disabled={submitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cashIn" id="dir-in" />
                  <Label htmlFor="dir-in" className="font-normal cursor-pointer">
                    Cash in (reverse with settle to teller)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cashOut" id="dir-out" />
                  <Label htmlFor="dir-out" className="font-normal cursor-pointer">
                    Cash out (reverse with allocate from teller)
                  </Label>
                </div>
              </RadioGroup>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rc-amount">Amount ({currencyCode || "—"})</Label>
            <Input
              id="rc-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting || !currencyCode}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rc-date">Transaction date</Label>
            <Input
              id="rc-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rc-notes">Notes (optional)</Label>
            <Textarea
              id="rc-notes"
              placeholder="Reason for this cashier-only correction…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting…
              </>
            ) : (
              "Post counter-entry"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
