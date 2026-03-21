"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink, CheckCircle } from "lucide-react";
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
  fineractClientId,
}: LeadActionsProps) {
  const router = useRouter();

  const { data: payoutData, mutate: mutatePayoutStatus } = useSWR(
    loanId ? `/api/loans/${loanId}/payout` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const payoutStatus = payoutData?.status;

  useEffect(() => {
    const handleRefresh = () => {
      router.refresh();
      mutatePayoutStatus();
    };

    window.addEventListener("assignment-change", handleRefresh);
    window.addEventListener("stage-transition-complete", handleRefresh);
    return () => {
      window.removeEventListener("assignment-change", handleRefresh);
      window.removeEventListener("stage-transition-complete", handleRefresh);
    };
  }, [router, mutatePayoutStatus]);

  const statusLower = (loanStatus || "").toLowerCase();
  const isDisbursed = statusLower.includes("active");

  if (!loanId || !fineractClientId || !isDisbursed) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {payoutStatus === "PAID" && (
        <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Paid Out
        </Badge>
      )}

      <Button asChild className="bg-blue-500 hover:bg-blue-600">
        <Link href={`/clients/${fineractClientId}/loans/${loanId}`}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View Loan
        </Link>
      </Button>
    </div>
  );
}
