"use client";

import { useEffect, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PendingApprovalLoanTermsEditorProps {
  leadId: string;
  canEdit: boolean;
  loan: {
    id: number;
    principal?: number | null;
    termFrequency?: number | null;
    termPeriodLabel?: string | null;
    numberOfRepayments?: number | null;
    interestRatePerPeriod?: number | null;
    interestRateFrequencyLabel?: string | null;
  };
  onSaved?: () => void;
}

export function PendingApprovalLoanTermsEditor({
  leadId,
  canEdit,
  loan,
  onSaved,
}: PendingApprovalLoanTermsEditorProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [loanTermFrequency, setLoanTermFrequency] = useState("");
  const [numberOfRepayments, setNumberOfRepayments] = useState("");
  const [interestRatePerPeriod, setInterestRatePerPeriod] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setPrincipal(String(loan.principal ?? ""));
    setLoanTermFrequency(String(loan.termFrequency ?? ""));
    setNumberOfRepayments(String(loan.numberOfRepayments ?? ""));
    setInterestRatePerPeriod(String(loan.interestRatePerPeriod ?? ""));
  }, [
    open,
    loan.interestRatePerPeriod,
    loan.numberOfRepayments,
    loan.principal,
    loan.termFrequency,
  ]);

  useEffect(() => {
    if (!canEdit) {
      return;
    }

    const handleOpenRequest = () => {
      setOpen(true);
    };

    window.addEventListener("open-pending-loan-terms-editor", handleOpenRequest);

    return () => {
      window.removeEventListener(
        "open-pending-loan-terms-editor",
        handleOpenRequest
      );
    };
  }, [canEdit]);

  if (!canEdit) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/leads/${leadId}/pending-approval-loan-terms`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            principal,
            loanTermFrequency,
            numberOfRepayments,
            interestRatePerPeriod,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Failed to update pending loan terms");
      }

      toast.success("Loan application updated");
      setOpen(false);
      onSaved?.();
      window.dispatchEvent(new Event("lead-data-changed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update pending loan terms"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Loan Terms</DialogTitle>
          <DialogDescription>
            These fields stay editable only while the application is pending
            approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pending-loan-principal">Loan Amount</Label>
            <Input
              id="pending-loan-principal"
              inputMode="decimal"
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pending-loan-term">
              Loan Term{loan.termPeriodLabel ? ` (${loan.termPeriodLabel})` : ""}
            </Label>
            <Input
              id="pending-loan-term"
              inputMode="numeric"
              value={loanTermFrequency}
              onChange={(event) => setLoanTermFrequency(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pending-loan-repayments">Number of Repayments</Label>
            <Input
              id="pending-loan-repayments"
              inputMode="numeric"
              value={numberOfRepayments}
              onChange={(event) => setNumberOfRepayments(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pending-loan-interest">
              Interest Rate
              {loan.interestRateFrequencyLabel
                ? ` (per ${loan.interestRateFrequencyLabel})`
                : ""}
            </Label>
            <Input
              id="pending-loan-interest"
              inputMode="decimal"
              value={interestRatePerPeriod}
              onChange={(event) => setInterestRatePerPeriod(event.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
