import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * POST /api/fineract/rescheduleloans
 * Proxies to Fineract's reschedule loans endpoint
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const command = searchParams.get('command');

    if (!command) {
      return NextResponse.json(
        { error: 'Command parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = await fetchFineractAPI(`/rescheduleloans?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error submitting reschedule loan request:', error);
    
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
