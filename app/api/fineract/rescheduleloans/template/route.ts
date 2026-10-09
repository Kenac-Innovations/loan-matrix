import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/rescheduleloans/template
 * Proxies to Fineract's reschedule loans template endpoint
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI('/rescheduleloans/template', {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching reschedule loan template:', error);
    return buildFineractErrorResponse(error);
  }
}
