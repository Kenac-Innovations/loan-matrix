import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { createAndAdjustLoanCharge } from "@/lib/fineract-loan-charge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    
    const data = await fetchFineractAPI(`/loans/${loanId}/charges`, {
      method: "GET",
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan charges:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch loan charges" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();

    const result = await createAndAdjustLoanCharge(Number(loanId), body, {
      adjustmentNote: "Loan charge adjustment applied immediately after charge creation",
    });

    if (typeof result.createResponse === "object" && result.createResponse !== null) {
      return NextResponse.json({
        ...result.createResponse,
        adjustmentResult: result.adjustmentResponse,
      });
    }

    return NextResponse.json(result.createResponse);
  } catch (error: any) {
    console.error("Error creating loan charge:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to create loan charge" },
      { status: 500 }
    );
  }
}
