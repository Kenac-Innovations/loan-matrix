import { NextRequest, NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;
    const url = `/journalentries?transactionId=${transactionId}&transactionDetails=true`;
    
    const response = await fetchFineractAPI(url);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching journal entry details:', error);
    return buildFineractErrorResponse(error, {
      action: 'load',
      resource: 'journal entry details',
    });
  }
}
