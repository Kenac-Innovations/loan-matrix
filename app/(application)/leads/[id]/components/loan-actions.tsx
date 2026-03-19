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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
  Plus,
  Edit,
  UserMinus,
  Trash2,
  Shield,
  Eye,
  UserPlus,
  FileText,
  UserCog,
} from "lucide-react";
import { usePermission } from "@/hooks/use-client-auth";
import { SpecificPermission } from "@/shared/types/auth";

interface LoanActionsProps {
  leadId: string;
  loanStatus?: string | null;
  loanId?: number | null;
  loanPrincipal?: number | null;
  isAssignedToCurrentUser: boolean;
  onActionComplete?: () => void;
}

// Map Fineract loan statuses to primary actions (shown as buttons)
const STATUS_ACTIONS: Record<
  string,
  {
    action: string;
    label: string;
    icon: any;
    variant: "default" | "destructive" | "outline";
  }[]
> = {
  "Submitted and pending approval": [
    {
      action: "approve",
      label: "Approve",
      icon: CheckCircle,
      variant: "default",
    },
    {
      action: "reject",
      label: "Reject",
      icon: XCircle,
      variant: "destructive",
    },
  ],
  Approved: [
    {
      action: "disburse",
      label: "Disburse",
      icon: Banknote,
      variant: "default",
    },
    {
      action: "undo_approval",
      label: "Undo Approval",
      icon: RotateCcw,
      variant: "outline",
    },
  ],
  Active: [
    {
      action: "write_off",
      label: "Write Off",
      icon: AlertCircle,
      variant: "destructive",
    },
  ],
};

// Additional dropdown actions based on status
const STATUS_DROPDOWN_ACTIONS: Record<
  string,
  {
    action: string;
    label: string;
    icon: any;
    destructive?: boolean;
  }[]
> = {
  "Submitted and pending approval": [
    { action: "addLoanCharge", label: "Add Loan Charge", icon: Plus },
    { action: "modifyApplication", label: "Modify Application", icon: Edit },
    {
      action: "withdrawnByClient",
      label: "Withdrawn by Client",
      icon: UserMinus,
    },
    { action: "delete", label: "Delete", icon: Trash2, destructive: true },
    { action: "addCollateral", label: "Add Collateral", icon: Shield },
    { action: "viewGuarantors", label: "View Guarantors", icon: Eye },
    { action: "createGuarantor", label: "Create Guarantor", icon: UserPlus },
    {
      action: "loanScreenReports",
      label: "Loan Screen Reports",
      icon: FileText,
    },
    {
      action: "assignLoanOfficer",
      label: "Assign Loan Officer",
      icon: UserCog,
    },
  ],
  Approved: [
    { action: "addLoanCharge", label: "Add Loan Charge", icon: Plus },
    { action: "addCollateral", label: "Add Collateral", icon: Shield },
    { action: "viewGuarantors", label: "View Guarantors", icon: Eye },
    {
      action: "assignLoanOfficer",
      label: "Assign Loan Officer",
      icon: UserCog,
    },
  ],
  Active: [
    { action: "addLoanCharge", label: "Add Loan Charge", icon: Plus },
    { action: "makeRepayment", label: "Make Repayment", icon: Banknote },
    {
      action: "loanScreenReports",
      label: "Loan Screen Reports",
      icon: FileText,
    },
  ],
};

export function LoanActions({
  leadId,
  loanStatus,
  loanId,
  loanPrincipal,
  isAssignedToCurrentUser,
  onActionComplete,
}: LoanActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [approvedAmount, setApprovedAmount] = useState(
    loanPrincipal ? loanPrincipal.toString() : ""
  );
  const [disbursementDate, setDisbursementDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const canApprove = usePermission(SpecificPermission.APPROVE_LOAN);
  const canDisburse = usePermission(SpecificPermission.DISBURSE_LOAN);

  const PERMISSION_GATED_ACTIONS: Record<string, boolean> = {
    approve: canApprove,
    disburse: canDisburse,
  };

  // Get available actions based on loan status, filtered by permissions
  const availableActions = (loanStatus ? STATUS_ACTIONS[loanStatus] || [] : [])
    .filter((a) => PERMISSION_GATED_ACTIONS[a.action] ?? true);
  const dropdownActions = loanStatus
    ? STATUS_DROPDOWN_ACTIONS[loanStatus] || []
    : [];

  const handleActionClick = (action: string) => {
    setCurrentAction(action);
    setActionDialogOpen(true);
  };

  const handleDropdownAction = (action: string) => {
    // Some actions open dialogs, others may navigate or show toast
    switch (action) {
      case "addLoanCharge":
        toast.info("Add Loan Charge feature coming soon");
        break;
      case "modifyApplication":
        toast.info("Modify Application feature coming soon");
        break;
      case "withdrawnByClient":
        setCurrentAction("withdrawnByClient");
        setActionDialogOpen(true);
        break;
      case "delete":
        setCurrentAction("delete");
        setActionDialogOpen(true);
        break;
      case "addCollateral":
        toast.info("Add Collateral feature coming soon");
        break;
      case "viewGuarantors":
        toast.info("View Guarantors feature coming soon");
        break;
      case "createGuarantor":
        toast.info("Create Guarantor feature coming soon");
        break;
      case "loanScreenReports":
        toast.info("Loan Screen Reports feature coming soon");
        break;
      case "assignLoanOfficer":
        toast.info("Assign Loan Officer feature coming soon");
        break;
      case "makeRepayment":
        toast.info("Make Repayment feature coming soon");
        break;
      default:
        toast.info(`${action} feature coming soon`);
    }
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
          approvedLoanAmount: approvedAmount
            ? parseFloat(approvedAmount)
            : undefined,
          actualDisbursementDate: disbursementDate,
        }),
      });

      if (response.ok) {
        toast.success(`Loan ${currentAction.replace("_", " ")} successful`);
        setActionDialogOpen(false);
        setNote("");
        // Dispatch custom event to notify other components to refresh
        window.dispatchEvent(
          new CustomEvent("loan-action-complete", {
            detail: { leadId, loanId, action: currentAction },
          })
        );
        onActionComplete?.();
      } else {
        const error = await response.json();
        toast.error(
          error.error || `Failed to ${currentAction.replace("_", " ")} loan`
        );
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
      case "withdrawnByClient":
        return "Withdrawn by Client";
      case "delete":
        return "Delete Loan Application";
      default:
        return "Confirm Action";
    }
  };

  const getActionDescription = () => {
    switch (currentAction) {
      case "approve":
        return "Please confirm the loan approval. This will move the loan to approved status.";
      case "reject":
        return "Please provide a reason for rejecting this loan application.";
      case "disburse":
        return "Please confirm the disbursement details for this loan.";
      case "undo_approval":
        return "This will revert the loan to pending approval status.";
      case "write_off":
        return "This action cannot be undone. Please confirm you want to write off this loan.";
      case "withdrawnByClient":
        return "This will mark the loan application as withdrawn by the client. Please provide a reason.";
      case "delete":
        return "This will permanently delete the loan application. This action cannot be undone.";
      default:
        return "Please confirm this action.";
    }
  };

  const isDestructiveAction = [
    "reject",
    "write_off",
    "withdrawnByClient",
    "delete",
  ].includes(currentAction || "");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Primary action buttons */}
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

        {/* More Actions Dropdown */}
        {dropdownActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                More
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Loan Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {dropdownActions.map((actionConfig) => (
                <DropdownMenuItem
                  key={actionConfig.action}
                  onClick={() => handleDropdownAction(actionConfig.action)}
                  className={
                    actionConfig.destructive
                      ? "text-destructive focus:text-destructive"
                      : ""
                  }
                >
                  <actionConfig.icon className="mr-2 h-4 w-4" />
                  {actionConfig.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getActionTitle()}</DialogTitle>
            <DialogDescription>{getActionDescription()}</DialogDescription>
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

            {(currentAction === "withdrawnByClient" ||
              currentAction === "delete") && (
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={disbursementDate}
                  onChange={(e) => setDisbursementDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {currentAction === "reject" ||
                currentAction === "withdrawnByClient"
                  ? "Reason"
                  : currentAction === "delete"
                  ? "Confirmation Note"
                  : "Note (optional)"}
              </Label>
              <Textarea
                placeholder={
                  currentAction === "reject"
                    ? "Enter reason for rejection..."
                    : currentAction === "withdrawnByClient"
                    ? "Enter reason for withdrawal..."
                    : currentAction === "delete"
                    ? "Enter reason for deletion..."
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
              variant={isDestructiveAction ? "destructive" : "default"}
              onClick={handleActionConfirm}
              disabled={
                isLoading ||
                ((currentAction === "reject" ||
                  currentAction === "withdrawnByClient" ||
                  currentAction === "delete") &&
                  !note)
              }
              className={
                !isDestructiveAction ? "bg-green-600 hover:bg-green-700" : ""
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
