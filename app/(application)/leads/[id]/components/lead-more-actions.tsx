"use client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  MoreHorizontal,
  ExternalLink,
  Printer,
  FileText,
  Plus,
  Edit,
  UserMinus,
  Trash2,
  Shield,
  Eye,
  UserPlus,
  UserCog,
  Banknote,
  RotateCcw,
  Copy,
} from "lucide-react";
import Link from "next/link";

interface LeadMoreActionsProps {
  leadId: string;
  loanStatus?: string | null;
  loanId?: number | null;
  fineractClientId?: number | null;
  canModifyPendingApplication?: boolean;
  canPrintContract?: boolean;
}

export function LeadMoreActions({
  leadId,
  loanStatus,
  loanId,
  fineractClientId,
  canModifyPendingApplication = false,
  canPrintContract = false,
}: LeadMoreActionsProps) {
  const statusLower = (loanStatus || "").toLowerCase();
  const isPending =
    statusLower.includes("submitted") || statusLower.includes("pending");
  const isApproved =
    statusLower === "approved" ||
    (statusLower.includes("approved") && !isPending);
  const isDisbursed = statusLower.includes("active");
  const hasLoan = !!loanId;

  const handleCopyId = () => {
    navigator.clipboard.writeText(leadId);
    toast.success("Lead ID copied to clipboard");
  };

  const handleComingSoon = (label: string) => {
    toast.info(`${label} — coming soon`);
  };

  const handleModifyApplication = () => {
    if (!canModifyPendingApplication) {
      toast.error(
        "This action is only available on Omama for loans that are still pending approval and users with loan update access."
      );
      return;
    }

    window.dispatchEvent(new Event("open-pending-loan-terms-editor"));
  };

  const handlePrintContract = async () => {
    if (!canPrintContract) {
      toast.error(
        "Loan contracts can only be printed after the application has reached final approval."
      );
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      toast.error("Please allow pop-ups to print the contract.");
      return;
    }

    printWindow.document.write(
      "<html><body style='font-family:sans-serif;padding:24px'>Preparing contract for printing...</body></html>"
    );
    printWindow.document.close();

    try {
      const response = await fetch(`/api/leads/${leadId}/print-contract`, {
        cache: "no-store",
      });

      if (!response.ok) {
        let message = "Failed to prepare the loan contract for printing.";

        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            message = data.error;
          }
        } catch {
          const text = await response.text().catch(() => "");
          if (text.trim()) {
            message = text;
          }
        }

        printWindow.close();
        toast.error(message);
        return;
      }

      const html = await response.text();
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      printWindow.close();
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to prepare the loan contract for printing."
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* General actions */}
        <DropdownMenuLabel>General</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleCopyId}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Lead ID
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrintContract}>
          <Printer className="mr-2 h-4 w-4" />
          Print Contract
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleComingSoon("Export PDF")}>
          <FileText className="mr-2 h-4 w-4" />
          Export PDF
        </DropdownMenuItem>

        {/* Fineract actions — only if loan exists */}
        {hasLoan && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Loan Actions</DropdownMenuLabel>

            {fineractClientId && (
              <DropdownMenuItem asChild>
                <Link href={`/clients/${fineractClientId}/loans/${loanId}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Loan
                </Link>
              </DropdownMenuItem>
            )}

            {/* Pending approval actions */}
            {isPending && (
              <>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Add Loan Charge")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Loan Charge
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleModifyApplication}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Modify Application
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Add Collateral")}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Add Collateral
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("View Guarantors")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Guarantors
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Create Guarantor")}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Guarantor
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Assign Loan Officer")}
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  Assign Loan Officer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Withdrawn by Client")}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Withdrawn by Client
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Delete Application")}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Application
                </DropdownMenuItem>
              </>
            )}

            {/* Approved actions */}
            {isApproved && (
              <>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Add Loan Charge")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Loan Charge
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Add Collateral")}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Add Collateral
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Undo Approval")}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Undo Approval
                </DropdownMenuItem>
              </>
            )}

            {/* Disbursed actions */}
            {isDisbursed && (
              <>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Make Repayment")}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Make Repayment
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Add Loan Charge")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Loan Charge
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleComingSoon("Loan Screen Reports")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Loan Screen Reports
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
