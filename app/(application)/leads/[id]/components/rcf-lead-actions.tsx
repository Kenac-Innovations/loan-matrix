"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface RcfLeadActionsProps {
  leadId: string;
  fineractClientId?: number | null;
  fineractSavingsAccountId?: number | null;
  rcfApproved?: boolean;
}

export function RcfLeadActions({ fineractClientId, fineractSavingsAccountId, rcfApproved }: RcfLeadActionsProps) {
  if (!rcfApproved || !fineractSavingsAccountId || !fineractClientId) return null;

  return (
    <Button asChild className="bg-blue-500 hover:bg-blue-600">
      <Link href={`/clients/${fineractClientId}/savings/${fineractSavingsAccountId}`}>
        <CreditCard className="mr-2 h-4 w-4" />
        RCF Details
      </Link>
    </Button>
  );
}
