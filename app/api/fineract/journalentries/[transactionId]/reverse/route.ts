import { NextRequest, NextResponse } from 'next/server';
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
    
    if (error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status || 500 });
    }
    
    return NextResponse.json(
      { 
        defaultUserMessage: 'Failed to revert transaction',
        developerMessage: error.message || 'Unknown error occurred'
      }, 
      { status: 500 }
    );
  }
} 