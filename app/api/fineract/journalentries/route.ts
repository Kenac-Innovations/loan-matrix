// File: app/api/fineract/journalentries/route.ts
import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    const transactionDetails = searchParams.get('transactionDetails');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const queryParams = new URLSearchParams({
      transactionId,
    });

    if (transactionDetails) {
      queryParams.append('transactionDetails', transactionDetails);
    }

    const data = await fetchFineractAPI(`/journalentries?${queryParams}`);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
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
