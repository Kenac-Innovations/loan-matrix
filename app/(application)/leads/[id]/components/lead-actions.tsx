"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { LoanActions } from "./loan-actions";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LeadActionsProps {
  leadId: string;
  currentStage?: string;
  loanStatus?: string | null;
  loanId?: number | null;
  loanPrincipal?: number | null;
  assignedToUserId?: number | null;
  fineractClientId?: number | null;
  onRefresh?: () => void;
}

export function LeadActions({
  leadId,
  loanStatus,
  loanId,
  loanPrincipal,
  assignedToUserId,
  fineractClientId,
  onRefresh,
}: LeadActionsProps) {
  const { data: session } = useSession();
  const router = useRouter();

  // Get current user's Mifos ID from session - try userId first, then fall back to id
  const sessionUser = session?.user as any;
  const currentMifosUserId =
    sessionUser?.userId ??
    (sessionUser?.id ? parseInt(sessionUser.id) : undefined);
  const isAssignedToCurrentUser = currentMifosUserId === assignedToUserId;

  // Listen for assignment changes and refresh the page
  useEffect(() => {
    const handleAssignmentChange = () => {
      router.refresh();
    };

    window.addEventListener("assignment-change", handleAssignmentChange);
    return () => {
      window.removeEventListener("assignment-change", handleAssignmentChange);
    };
  }, [router]);

  // Only show if there's a loan
  if (!loanId || !fineractClientId) {
    return null;
  }

  // Check if pre-disbursement status (show approve/disburse actions)
  const statusLower = (loanStatus || "").toLowerCase();
  const isPreDisbursement =
    statusLower.includes("submitted") ||
    statusLower.includes("pending") ||
    statusLower === "approved";

  // For pre-disbursement statuses, show LoanActions (approve/disburse)
  if (isPreDisbursement) {
    return (
      <LoanActions
        leadId={leadId}
        loanStatus={loanStatus}
        loanId={loanId}
        loanPrincipal={loanPrincipal}
        isAssignedToCurrentUser={isAssignedToCurrentUser}
        onActionComplete={() => {
          router.refresh();
          onRefresh?.();
        }}
      />
    );
  }

  // For post-disbursement statuses (Active/Disbursed, Closed, etc.), show View Loan button
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="bg-blue-500 hover:bg-blue-600">
        <Link href={`/clients/${fineractClientId}/loans/${loanId}`}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View Loan
        </Link>
      </Button>
    </div>
  );
}
