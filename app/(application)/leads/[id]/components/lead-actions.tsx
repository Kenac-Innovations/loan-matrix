"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

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
  fineractClientId,
}: LeadActionsProps) {
  // Only show the View Loan button if there's a loan
  if (!loanId || !fineractClientId) {
    return null;
  }

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
