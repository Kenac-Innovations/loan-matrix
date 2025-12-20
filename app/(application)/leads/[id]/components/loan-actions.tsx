"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Banknote,
  RotateCcw,
  FileCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface LoanActionsProps {
  leadId: string;
  loanStatus?: string | null;
  loanId?: number | null;
  isAssignedToCurrentUser: boolean;
  onActionComplete?: () => void;
}

// Map Fineract loan statuses to available actions
const STATUS_ACTIONS: Record<string, { action: string; label: string; icon: any; variant: "default" | "destructive" | "outline" }[]> = {
  "Submitted and pending approval": [
    { action: "approve", label: "Approve", icon: CheckCircle, variant: "default" },
    { action: "reject", label: "Reject", icon: XCircle, variant: "destructive" },
  ],
  "Approved": [
    { action: "disburse", label: "Disburse", icon: Banknote, variant: "default" },
    { action: "undo_approval", label: "Undo Approval", icon: RotateCcw, variant: "outline" },
  ],
  "Active": [
    { action: "write_off", label: "Write Off", icon: AlertCircle, variant: "destructive" },
  ],
};

export function LoanActions({
  leadId,
  loanStatus,
  loanId,
  isAssignedToCurrentUser,
  onActionComplete,
}: LoanActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [disbursementDate, setDisbursementDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Get available actions based on loan status
  const availableActions = loanStatus ? STATUS_ACTIONS[loanStatus] || [] : [];

  const handleActionClick = (action: string) => {
    setCurrentAction(action);
    setActionDialogOpen(true);
  };

  const handleActionConfirm = async () => {
    if (!currentAction || !loanId) {
      toast.error("Unable to perform action");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentAction,
          note,
          approvedOnDate: disbursementDate,
          approvedLoanAmount: approvedAmount ? parseFloat(approvedAmount) : undefined,
          actualDisbursementDate: disbursementDate,
        }),
      });

      if (response.ok) {
        toast.success(`Loan ${currentAction.replace("_", " ")} successful`);
        setActionDialogOpen(false);
        setNote("");
        onActionComplete?.();
      } else {
        const error = await response.json();
        toast.error(error.error || `Failed to ${currentAction.replace("_", " ")} loan`);
      }
    } catch (error) {
      console.error("Error performing loan action:", error);
      toast.error("Error performing action");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show anything if no loan or no actions available
  if (!loanId || availableActions.length === 0) {
    return null;
  }

  // Show message if not assigned
  if (!isAssignedToCurrentUser) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span>Actions available only for assigned user</span>
      </div>
    );
  }

  const getActionTitle = () => {
    switch (currentAction) {
      case "approve":
        return "Approve Loan";
      case "reject":
        return "Reject Loan";
      case "disburse":
        return "Disburse Loan";
      case "undo_approval":
        return "Undo Loan Approval";
      case "write_off":
        return "Write Off Loan";
      default:
        return "Confirm Action";
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {availableActions.map((actionConfig) => (
          <Button
            key={actionConfig.action}
            variant={actionConfig.variant}
            onClick={() => handleActionClick(actionConfig.action)}
            className={
              actionConfig.variant === "default"
                ? "bg-green-600 hover:bg-green-700"
                : ""
            }
          >
            <actionConfig.icon className="mr-2 h-4 w-4" />
            {actionConfig.label}
          </Button>
        ))}
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getActionTitle()}</DialogTitle>
            <DialogDescription>
              {currentAction === "approve" &&
                "Please confirm the loan approval. This will move the loan to approved status."}
              {currentAction === "reject" &&
                "Please provide a reason for rejecting this loan application."}
              {currentAction === "disburse" &&
                "Please confirm the disbursement details for this loan."}
              {currentAction === "undo_approval" &&
                "This will revert the loan to pending approval status."}
              {currentAction === "write_off" &&
                "This action cannot be undone. Please confirm you want to write off this loan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {currentAction === "approve" && (
              <>
                <div className="space-y-2">
                  <Label>Approved Amount (optional)</Label>
                  <Input
                    type="number"
                    placeholder="Leave empty to use requested amount"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Approval Date</Label>
                  <Input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {currentAction === "disburse" && (
              <div className="space-y-2">
                <Label>Disbursement Date</Label>
                <Input
                  type="date"
                  value={disbursementDate}
                  onChange={(e) => setDisbursementDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {currentAction === "reject" ? "Rejection Reason" : "Note (optional)"}
              </Label>
              <Textarea
                placeholder={
                  currentAction === "reject"
                    ? "Enter reason for rejection..."
                    : "Enter any additional notes..."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant={currentAction === "reject" || currentAction === "write_off" ? "destructive" : "default"}
              onClick={handleActionConfirm}
              disabled={isLoading || (currentAction === "reject" && !note)}
              className={
                currentAction !== "reject" && currentAction !== "write_off"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileCheck className="mr-2 h-4 w-4" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
