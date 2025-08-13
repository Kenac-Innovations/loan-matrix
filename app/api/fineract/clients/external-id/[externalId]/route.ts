import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/clients/external-id/[externalId]
 * Fetches client details by external ID (national ID) from Fineract
 */
export async function GET(
  request: Request,
  { params }: { params: { externalId: string } }
) {
  try {
    const { externalId } = params;
    
    if (!externalId) {
      return NextResponse.json(
        { error: 'External ID is required' },
        { status: 400 }
      );
    }

    // Fetch client details by external ID
    const data = await fetchFineractAPI(`/clients/external-id/${externalId}`);
    
    // Return the data as-is to preserve the original structure
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching client by external ID:', error);
    
    // Handle specific error cases
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Client not found with the provided external ID' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
