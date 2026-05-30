import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

type FineractRouteError = Error & {
  status?: number;
  errorData?: unknown;
};

/**
 * GET /api/fineract/rescheduleloans
 * Proxies to Fineract's reschedule loans endpoint for fetching loan reschedules
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();

    if (!searchParams.get('loanId')) {
      return NextResponse.json(
        { error: 'loanId parameter is required' },
        { status: 400 }
      );
    }

    const data = await fetchFineractAPI(
      `/rescheduleloans${query ? `?${query}` : ''}`
    );

    return NextResponse.json(data);
  } catch (error: unknown) {
    const routeError = error as FineractRouteError;
    console.error('Error fetching reschedule loans:', error);

    if (routeError.status && routeError.errorData) {
      return NextResponse.json(
        {
          error: routeError.message,
          status: routeError.status,
          details: routeError.errorData,
        },
        { status: routeError.status }
      );
    }

    return NextResponse.json(
      { error: routeError.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

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
  } catch (error: unknown) {
    const routeError = error as FineractRouteError;
    console.error('Error submitting reschedule loan request:', error);
    
    // Check if it's an API error with status and errorData
    if (routeError.status && routeError.errorData) {
      return NextResponse.json(
        { 
          error: routeError.message,
          status: routeError.status,
          details: routeError.errorData 
        },
        { status: routeError.status }
      );
    }
    
    return NextResponse.json(
      { error: routeError.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
