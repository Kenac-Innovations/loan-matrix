import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

type FineractRouteError = Error & {
  status?: number;
  errorData?: unknown;
};

/**
 * GET /api/fineract/rescheduleloans/[id]
 * Proxies to Fineract's single reschedule loan request endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();

    const data = await fetchFineractAPI(
      `/rescheduleloans/${id}${query ? `?${query}` : ''}`,
      {
        authMode: "service",
      }
    );

    return NextResponse.json(data);
  } catch (error: unknown) {
    const routeError = error as FineractRouteError;
    console.error('Error fetching reschedule loan request:', error);

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
 * POST /api/fineract/rescheduleloans/[id]
 * Proxies approve/reject actions for a loan reschedule request
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const command = searchParams.get('command');

    if (!command) {
      return NextResponse.json(
        { error: 'Command parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = await fetchFineractAPI(`/rescheduleloans/${id}?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const routeError = error as FineractRouteError;
    console.error('Error submitting reschedule loan action:', error);

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
