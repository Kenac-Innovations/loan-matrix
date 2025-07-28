// File: app/api/fineract/glaccounts/[id]/route.ts

import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // Preserve the ?template=true (or any other) querystring
  const { search } = new URL(request.url);
  const path = `/glaccounts/${params.id}${search}`;
  const data = await fetchFineractAPI(path);
  return NextResponse.json(data);
}

// And keep your PUT here—Fineract 1.11 does support PUT /glaccounts/{id}.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const payload = await request.json();
  // This time we do a real PUT
  const data = await fetchFineractAPI(`/glaccounts/${params.id}`, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
  });
  return NextResponse.json(data);
}
