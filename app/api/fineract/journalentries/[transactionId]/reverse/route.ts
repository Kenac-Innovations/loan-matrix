import { NextRequest, NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;
    const body = await request.json();
    const { comments } = body;
    
    const url = `/journalentries/${transactionId}?command=reverse`;
    const payload = { comments };
    
    const response = await fetchFineractAPI(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error reverting transaction:', error);
    return buildFineractErrorResponse(error, {
      action: 'reverse',
      resource: 'journal entry',
    });
  }
}
