// File: app/api/fineract/journalentries/route.ts
import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';
import { buildJournalEntriesEndpoint } from '@/lib/journalentries-endpoint';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await fetchFineractAPI(
      buildJournalEntriesEndpoint(searchParams)
    );
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return buildFineractErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await fetchFineractAPI('/journalentries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return buildFineractErrorResponse(error);
  }
}
