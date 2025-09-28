import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    
    const data = await fetchFineractAPI(`/loans/${loanId}/transactions?command=charge-off`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error executing charge-off:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json({ error: error.message || "Failed to execute charge-off" }, { status: 500 });
  }
}
