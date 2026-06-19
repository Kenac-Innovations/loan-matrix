import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getActiveFacilityForClient, getFacilityLoanLink, updateFacility } from "@/lib/fineract-credit-facility";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    const { fineractClientId, ...fineractBody } = body;

    const data = await fetchFineractAPI(`/loans/${Number(loanId)}?command=undodisbursal`, {
      method: "POST",
      body: JSON.stringify(fineractBody),
    });

    // Deduct from credit facility if this loan was linked to one (non-blocking)
    if (fineractClientId) {
      try {
        const [link, facility] = await Promise.all([
          getFacilityLoanLink(Number(loanId)),
          getActiveFacilityForClient(Number(fineractClientId)),
        ]);
        if (link && facility) {
          const loanDetails = await fetchFineractAPI(`/loans/${loanId}`, {
            authMode: "service",
          });
          const disbursedAmount = loanDetails?.approvedPrincipal ?? loanDetails?.principal ?? 0;
          await updateFacility(Number(fineractClientId), facility.id, {
            utilized_amount: Math.max(0, facility.utilized_amount - disbursedAmount),
            disbursed_tranches: Math.max(0, facility.disbursed_tranches - 1),
          });
        }
      } catch (facilityErr) {
        console.error("[UndoDisbursal] Failed to update credit facility:", facilityErr);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error executing undo disbursal:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to execute undo disbursal" },
      { status: 500 }
    );
  }
}
