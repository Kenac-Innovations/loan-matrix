import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/template
 * Fetches loan template data from Fineract including product options and loan officer options
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') || 'true';
    const staffInSelectedOfficeOnly = searchParams.get('staffInSelectedOfficeOnly') || 'true';
    const clientId = searchParams.get('clientId');
    const productId = searchParams.get('productId');
    const templateType = searchParams.get('templateType') || 'individual';

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Build the query string - productId is optional for initial product options
    const queryParams = new URLSearchParams({
      activeOnly,
      staffInSelectedOfficeOnly,
      clientId,
      templateType,
    });

    // Add productId if provided
    if (productId) {
      queryParams.append('productId', productId);
    }

    const data = await fetchFineractAPI(`/loans/template?${queryParams}`);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan template:', error);
    
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
