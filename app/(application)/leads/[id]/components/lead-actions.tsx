"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink, Banknote, CheckCircle } from "lucide-react";
import { LoanActions } from "./loan-actions";
import { PayoutModal } from "./payout-modal";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LeadActionsProps {
  leadId: string;
  currentStage?: string;
  loanStatus?: string | null;
  loanId?: number | null;
  loanPrincipal?: number | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
  assignedToUserId?: number | null;
  fineractClientId?: number | null;
  currency?: string | null;
  onRefresh?: () => void;
}

export function LeadActions({
  leadId,
  loanStatus,
  loanId,
  loanPrincipal,
  loanAccountNo,
  clientName,
  assignedToUserId,
  fineractClientId,
  currency,
  onRefresh,
}: LeadActionsProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { currencyCode: orgCurrency } = useCurrency();
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Get current user's Mifos ID from session
  const sessionUser = session?.user as any;
  const currentMifosUserId =
    sessionUser?.userId ??
    (sessionUser?.id ? parseInt(sessionUser.id) : undefined);
  const isAssignedToCurrentUser = currentMifosUserId === assignedToUserId;

  // Fetch payout status for this loan
  const { data: payoutData, mutate: mutatePayoutStatus } = useSWR(
    loanId ? `/api/loans/${loanId}/payout` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const payoutStatus = payoutData?.status;

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

  // Check if pre-disbursement status (show approve/disburse actions)
  const statusLower = (loanStatus || "").toLowerCase();
  const isPreDisbursement =
    statusLower.includes("submitted") ||
    statusLower.includes("pending") ||
    statusLower === "approved";

  // Check if loan is active/disbursed (show payout option)
  const isDisbursed = statusLower.includes("active");

  // For pre-disbursement, only loanId is needed (fineractClientId not required for approve/reject)
  // For post-disbursement, both loanId and fineractClientId are needed (View Loan link, Payout)
  if (!loanId) {
    return null;
  }

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

  // For post-disbursement statuses, fineractClientId is needed for View Loan link and Payout
  if (!fineractClientId) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        {/* Payout Status Badge */}
        {isDisbursed && payoutStatus === "PAID" && (
          <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Paid Out
          </Badge>
        )}

        {/* Payout Button (only for disbursed loans that haven't been paid) */}
        {isDisbursed && payoutStatus !== "PAID" && (
          <Button
            onClick={() => setShowPayoutModal(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Banknote className="mr-2 h-4 w-4" />
            Payout
          </Button>
        )}

        {/* View Loan Button */}
        <Button asChild className="bg-blue-500 hover:bg-blue-600">
          <Link href={`/clients/${fineractClientId}/loans/${loanId}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View Loan
          </Link>
        </Button>
      </div>

      {/* Payout Modal */}
      {loanId && fineractClientId && (
        <PayoutModal
          open={showPayoutModal}
          onOpenChange={setShowPayoutModal}
          loanId={loanId}
          clientId={fineractClientId}
          clientName={clientName || "Client"}
          loanAccountNo={loanAccountNo || undefined}
          principal={loanPrincipal || 0}
          currency={currency || orgCurrency}
          onSuccess={() => {
            mutatePayoutStatus();
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}
