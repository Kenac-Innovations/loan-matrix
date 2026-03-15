// File: app/api/fineract/glaccounts/[id]/route.ts

import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  // Preserve the ?template=true (or any other) querystring
  const { search } = new URL(request.url);
  const path = `/glaccounts/${resolvedParams.id}${search}`;
  const data = await fetchFineractAPI(path);
  return NextResponse.json(data);
}

// And keep your PUT here—Fineract 1.11 does support PUT /glaccounts/{id}.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const payload = await request.json();
    // This time we do a real PUT
    const data = await fetchFineractAPI(`/glaccounts/${resolvedParams.id}`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('PUT /api/fineract/glaccounts/[id] error:', error);
    
    // If it's our custom error with backend data, return it
    if (error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status || 500 });
    }
    
    // Fallback error response
    return NextResponse.json(
      { 
        defaultUserMessage: 'An unexpected error occurred',
        developerMessage: error.message 
      }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const data = await fetchFineractAPI(`/glaccounts/${resolvedParams.id}`, {
      method: 'DELETE',
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('DELETE /api/fineract/glaccounts/[id] error:', error);
    
    // If it's our custom error with backend data, return it
    if (error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status || 500 });
    }
    
    // Fallback error response
    return NextResponse.json(
      { 
        defaultUserMessage: 'An unexpected error occurred',
        developerMessage: error.message 
      }, 
      { status: 500 }
    );
  }
}
