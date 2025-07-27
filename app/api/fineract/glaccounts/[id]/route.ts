// File: app/api/fineract/glaccounts/[id]/route.ts

import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.toString();                // capture 'template=true'
    const endpoint = `/glaccounts/${params.id}` + (query ? `?${query}` : '');
    const data = await fetchFineractAPI(endpoint);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Error fetching account template:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const data = await fetchFineractAPI(
      `/glaccounts/${params.id}`,     // Fineract now supports PUT /glaccounts/{id}
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Error updating GL account:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
