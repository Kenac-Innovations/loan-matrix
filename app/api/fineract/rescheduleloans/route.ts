import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get("loanId");
    const command = searchParams.get("command");
    
    if (!loanId) {
      return NextResponse.json(
        { error: "loanId is required" },
        { status: 400 }
      );
    }

    const data = await fetchFineractAPI(`/rescheduleloans?loanId=${loanId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan reschedules:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch loan reschedules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const command = searchParams.get("command");
    
    if (command !== "reschedule") {
      return NextResponse.json(
        { error: "Invalid command. Expected 'reschedule'" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    const data = await fetchFineractAPI(`/rescheduleloans?command=reschedule`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating loan reschedule:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to create loan reschedule" },
      { status: 500 }
    );
  }
}
