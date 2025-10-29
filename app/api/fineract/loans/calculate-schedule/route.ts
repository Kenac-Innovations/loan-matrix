import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * POST /api/fineract/loans/calculate-schedule
 * Calculates loan repayment schedule using Fineract calculateLoanSchedule command
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // POST to Fineract /loans?command=calculateLoanSchedule
    const data = await fetchFineractAPI('/loans?command=calculateLoanSchedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error calculating loan schedule:', error);
    
    // Check if it's an API error with status and errorData
    if (error.status && error.errorData) {
      return NextResponse.json(
        { 
          error: error.message,
          status: error.status,
          details: error.errorData 
        },
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

