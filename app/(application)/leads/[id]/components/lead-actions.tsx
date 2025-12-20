"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoanActions } from "./loan-actions";

interface LeadActionsProps {
  leadId: string;
  currentStage?: string;
  loanStatus?: string | null;
  loanId?: number | null;
  loanPrincipal?: number | null;
  assignedToUserId?: number | null;
  onRefresh?: () => void;
}

export function LeadActions({
  leadId,
  currentStage,
  loanStatus,
  loanId,
  loanPrincipal,
  assignedToUserId,
  onRefresh,
}: LeadActionsProps) {
  const { data: session } = useSession();
  const router = useRouter();

  // Get current user's Mifos ID - try userId first, then fall back to id
  const sessionUser = session?.user as any;
  const currentUserId =
    sessionUser?.userId ??
    (sessionUser?.id ? parseInt(sessionUser.id) : undefined);
  const isAssignedToCurrentUser = !!(
    currentUserId &&
    assignedToUserId &&
    currentUserId === assignedToUserId
  );

  // Debug logging
  console.log("Assignment Check:", {
    currentUserId,
    assignedToUserId,
    isAssignedToCurrentUser,
    sessionUserId: sessionUser?.userId,
    sessionId: sessionUser?.id,
  });

  const handleActionComplete = () => {
    // Call the passed onRefresh if provided
    onRefresh?.();
    // Refresh the page to reload server component data
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Loan Actions from Fineract - includes primary buttons and More dropdown */}
      <LoanActions
        leadId={leadId}
        loanStatus={loanStatus}
        loanId={loanId}
        loanPrincipal={loanPrincipal}
        isAssignedToCurrentUser={!!isAssignedToCurrentUser}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
