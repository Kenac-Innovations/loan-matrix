"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Users,
  CheckCircle,
  Edit,
  ArrowDownLeft,
} from "lucide-react";
import Link from "next/link";
import { AllocateCashModal } from "../../components/allocate-cash-modal";
import { EditTellerModal } from "../../components/edit-teller-modal";
import { ReturnToBankModal } from "../../components/return-to-bank-modal";

interface TellerActionsProps {
  tellerId: string;
  tellerName: string;
  teller: {
    name: string;
    description?: string;
    officeId: number;
    officeName: string;
    startDate: string | Date | number[];
    endDate?: string | Date | number[] | null;
    status: string;
    glAccountId?: number | null;
    glAccountName?: string | null;
    glAccountCode?: string | null;
    bankId?: string | null;
    bankName?: string | null;
    bankGlAccountId?: number | null;
    vaultBalance?: number | null;
    vaultBalanceSource?: "fineract_gl" | "unavailable";
    currency?: string | null;
  };
}

export function TellerActions({
  tellerId,
  tellerName,
  teller,
}: TellerActionsProps) {
  const router = useRouter();
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const canReturnToBank =
    !!teller.glAccountId &&
    !!teller.bankId &&
    !!teller.bankGlAccountId &&
    teller.vaultBalanceSource === "fineract_gl" &&
    typeof teller.vaultBalance === "number" &&
    teller.vaultBalance > 0;

  const returnDisabledReason = (() => {
    if (!teller.glAccountId) return "Teller has no GL account configured.";
    if (!teller.bankId) return "Teller is not linked to a parent bank.";
    if (!teller.bankGlAccountId) return "Parent bank has no GL account configured.";
    if (teller.vaultBalanceSource !== "fineract_gl")
      return "Vault balance is unavailable.";
    if (!teller.vaultBalance || teller.vaultBalance <= 0)
      return "Teller vault is empty.";
    return "";
  })();

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowAllocateModal(true)}
      >
        <DollarSign className="h-4 w-4 mr-2" />
        Allocate Cash
      </Button>
      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={() => setShowReturnModal(true)}
        disabled={!canReturnToBank}
        title={canReturnToBank ? undefined : returnDisabledReason}
      >
        <ArrowDownLeft className="h-4 w-4 mr-2" />
        Return to Bank
      </Button>
      <Link href={`/tellers/${tellerId}/cashiers`}>
        <Button variant="outline" className="w-full mt-2">
          <Users className="h-4 w-4 mr-2" />
          Manage Cashiers
        </Button>
      </Link>
      <Link href="/tellers/resolutions">
        <Button variant="outline" className="w-full mt-2">
          <CheckCircle className="h-4 w-4 mr-2" />
          Resolutions
        </Button>
      </Link>
      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={() => setShowEditModal(true)}
      >
        <Edit className="h-4 w-4 mr-2" />
        Edit Teller
      </Button>
      <AllocateCashModal
        tellerId={tellerId}
        tellerName={tellerName}
        open={showAllocateModal}
        onOpenChange={setShowAllocateModal}
      />
      <ReturnToBankModal
        tellerId={tellerId}
        tellerName={tellerName}
        bankName={teller.bankName}
        vaultBalance={teller.vaultBalance ?? null}
        currency={teller.currency ?? null}
        open={showReturnModal}
        onOpenChange={setShowReturnModal}
        onSuccess={() => router.refresh()}
      />
      <EditTellerModal
        tellerId={tellerId}
        teller={teller}
        open={showEditModal}
        onOpenChange={setShowEditModal}
      />
    </>
  );
}
