import { NextRequest, NextResponse } from 'next/server';
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
    
    if (error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status || 500 });
    }
    
    return NextResponse.json(
      { 
        defaultUserMessage: 'Failed to fetch journal entry details',
        developerMessage: error.message || 'Unknown error occurred'
      }, 
      { status: 500 }
    );
  }
} 