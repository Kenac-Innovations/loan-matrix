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

    // Try different possible Fineract endpoints for client transactions
    let data;
    let error;
    
    // First try the standard transactions endpoint with client filter
    try {
      const endpoint = `/loans/transactions?clientId=${clientId}&offset=${offset}&limit=${limit}`;
      data = await fetchFineractAPI(endpoint);
    } catch (e: any) {
      error = e;
      console.log('First endpoint failed, trying alternative...');
      
      // Try alternative endpoint
      try {
        const endpoint = `/clients/${clientId}/transactions?offset=${offset}&limit=${limit}`;
        data = await fetchFineractAPI(endpoint);
      } catch (e2: any) {
        error = e2;
        console.log('Second endpoint failed, trying loans transactions endpoint...');
        
        // Try the general loans transactions endpoint
        try {
          const endpoint = `/loans/transactions?offset=${offset}&limit=${limit}`;
          data = await fetchFineractAPI(endpoint);
          
          // Filter by client ID if we get all transactions
          if (data && Array.isArray(data.pageItems)) {
            data.pageItems = data.pageItems.filter((transaction: any) => transaction.clientId == clientId);
          }
        } catch (e3: any) {
          error = e3;
          throw e3;
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to get client transactions:", error);
    return NextResponse.json(
      { error: "Failed to get client transactions" },
      { status: 500 }
    );
  }
}
