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
import { RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface ReversePayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  clientName?: string;
  onSuccess: () => void;
}

/**
 * Reverse payout only (not the disbursement). Marks the LoanPayout as REVERSED
 * so the cashier gets the money back in their transaction history.
 */
export function ReversePayoutModal({
  isOpen,
  onClose,
  loanId,
  clientName,
  onSuccess,
}: ReversePayoutModalProps) {
  const [reversedBy, setReversedBy] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/reverse-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reversedBy: reversedBy.trim() || undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to reverse payout");
      }

      toast({
        title: "Payout reversed",
        description:
          "Cash will show as returned in the cashier's transaction history.",
      });
      onSuccess();
      onClose();
      setReversedBy("");
      setReason("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reverse payout";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reverse payout
          </DialogTitle>
          <DialogDescription>
            Reverse the cash payout for this loan only. The disbursement in
            Fineract is not changed. The amount will show as returned to the
            cashier in their transaction history.
            {clientName && (
              <span className="block mt-2 font-medium text-foreground">
                Loan / client: {clientName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="reversedBy">Reversed by (optional)</Label>
            <Input
              id="reversedBy"
              placeholder="e.g. Cashier name or your name"
              value={reversedBy}
              onChange={(e) => setReversedBy(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g. Wrong amount paid; cash returned to cashier"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Reverse payout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
