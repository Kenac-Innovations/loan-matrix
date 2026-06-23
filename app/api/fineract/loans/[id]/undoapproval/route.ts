import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json().catch(() => ({}));

    const data = await fetchFineractAPI(
      `/loans/${Number(loanId)}?command=undoapproval`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return NextResponse.json(data);
  } catch (error: unknown) {
    const loanActionError = error as {
      status?: number;
      errorData?: unknown;
      message?: string;
    };

    console.error("Error executing undo approval:", error);
    if (loanActionError.status && loanActionError.errorData) {
      return NextResponse.json(loanActionError.errorData, {
        status: loanActionError.status,
      });
    }

    return NextResponse.json(
      { error: loanActionError.message || "Failed to execute undo approval" },
      { status: 500 }
    );
  }
}
