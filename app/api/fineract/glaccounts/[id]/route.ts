// File: app/api/fineract/glaccounts/[id]/route.ts

import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;

    // Preserve the ?template=true (or any other) querystring
    const { search } = new URL(request.url);
    const path = `/glaccounts/${resolvedParams.id}${search}`;
    const data = await fetchFineractAPI(path);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('GET /api/fineract/glaccounts/[id] error:', error);
    return buildFineractErrorResponse(error, {
      action: 'load',
      resource: 'GL account',
    });
  }
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
    return buildFineractErrorResponse(error, {
      action: 'update',
      resource: 'GL account',
    });
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
    return buildFineractErrorResponse(error, {
      action: 'delete',
      resource: 'GL account',
    });
  }
}
