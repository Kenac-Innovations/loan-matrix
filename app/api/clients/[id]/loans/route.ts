import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const offset = searchParams.get('offset') || '0';
    const limit = searchParams.get('limit') || '20';

    // Try different possible Fineract endpoints for client loans
    let data;
    let error;
    
    // First try the standard loans endpoint with client filter
    try {
      const endpoint = `/loans?clientId=${clientId}&offset=${offset}&limit=${limit}`;
      data = await fetchFineractAPI(endpoint);
    } catch (e: any) {
      error = e;
      console.log('First endpoint failed, trying alternative...');
      
      // Try alternative endpoint
      try {
        const endpoint = `/clients/${clientId}/loans?offset=${offset}&limit=${limit}`;
        data = await fetchFineractAPI(endpoint);
      } catch (e2: any) {
        error = e2;
        console.log('Second endpoint failed, trying loans endpoint...');
        
        // Try the general loans endpoint
        try {
          const endpoint = `/loans?offset=${offset}&limit=${limit}`;
          data = await fetchFineractAPI(endpoint);
          
          // Filter by client ID if we get all loans
          if (data && Array.isArray(data.pageItems)) {
            data.pageItems = data.pageItems.filter((loan: any) => loan.clientId == clientId);
          }
        } catch (e3: any) {
          error = e3;
          throw e3;
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to get client loans:", error);
    return NextResponse.json(
      { error: "Failed to get client loans" },
      { status: 500 }
    );
  }
}
