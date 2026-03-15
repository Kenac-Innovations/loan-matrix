"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, CheckCircle, Edit } from "lucide-react";
import Link from "next/link";
import { AllocateCashModal } from "../../components/allocate-cash-modal";
import { EditTellerModal } from "../../components/edit-teller-modal";

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
  };
}

export function TellerActions({ tellerId, tellerName, teller }: TellerActionsProps) {
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
      <Link href={`/tellers/${tellerId}/cashiers`}>
        <Button variant="outline" className="w-full">
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
      <EditTellerModal
        tellerId={tellerId}
        teller={teller}
        open={showEditModal}
        onOpenChange={setShowEditModal}
      />
    </>
  );
}
