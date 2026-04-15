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
        "This action is only available on Omama while the loan is still pending approval."
      );
      return;
    }

    window.dispatchEvent(new Event("open-pending-loan-terms-editor"));
  };

  const getContractRouteError = async (response: Response) => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null) as
        | { error?: string }
        | null;
      return payload?.error || "Failed to prepare the contract.";
    }

    const text = await response.text().catch(() => "");
    return text || "Failed to prepare the contract.";
  };

  const renderContractActionInIframe = async (action: "print" | "pdf") => {
    const response = await fetch(
      `/api/leads/${leadId}/print-contract?action=${action}&embedded=1`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );

    if (!response.ok) {
      throw new Error(await getContractRouteError(response));
    }

    const html = await response.text();
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, action === "pdf" ? 60000 : 10000);
    };

    iframe.onload = () => {
      if (action !== "print") {
        return;
      }

      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (error) {
          console.error("Failed to print contract from iframe:", error);
          toast.error("Failed to open the print dialog for this contract.");
        }
      }, 300);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    cleanup();
  };

  const handlePrintContract = async () => {
    if (!canPrintContract) {
      toast.error(
        "Loan contracts can only be printed after the application has reached final approval."
      );
      return;
    }

    try {
      await renderContractActionInIframe("print");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to prepare the contract for printing."
      );
    }
  };

  const handleExportPdf = async () => {
    if (!canPrintContract) {
      toast.error(
        "Loan contracts can only be exported after the application has reached final approval."
      );
      return;
    }

    try {
      await renderContractActionInIframe("pdf");
      toast.success("Preparing contract PDF download...");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to prepare the contract PDF."
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
        <DropdownMenuItem onClick={handleExportPdf}>
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
