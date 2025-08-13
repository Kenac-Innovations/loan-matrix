// File: app/api/fineract/journalentries/route.ts
import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return NextResponse.json(
    await fetchFineractAPI(`/journalentries${search}`)
  );
}

export async function POST(request: Request) {
  const payload = await request.json();
  const data = await fetchFineractAPI('/journalentries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return NextResponse.json(data, { status: 201 });
}
