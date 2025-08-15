import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const command = searchParams.get('command');
    const locale = searchParams.get('locale') || 'en';
    const dateFormat = searchParams.get('dateFormat') || 'dd MMMM yyyy';
    const transactionDate = searchParams.get('transactionDate');
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (command) queryParams.append('command', command);
    if (locale) queryParams.append('locale', locale);
    if (dateFormat) queryParams.append('dateFormat', dateFormat);
    if (transactionDate) queryParams.append('transactionDate', transactionDate);
    
    const endpoint = `/loans/${loanId}/transactions/template?${queryParams.toString()}`;
    
    const data = await fetchFineractAPI(endpoint, {
      method: "GET",
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan transaction template:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch loan transaction template" },
      { status: 500 }
    );
  }
}