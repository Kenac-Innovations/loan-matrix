import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]/approve
 * Gets loan approval template data
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get template type, default to 'approval'
    const templateType = searchParams.get('templateType') || 'approval';
    
    // Build the endpoint URL
    const endpoint = `/loans/${id}/template?templateType=${templateType}`;
    const data = await fetchFineractAPI(endpoint);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan approval template:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/loans/[id]/approve
 * Submits loan approval
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    
    // Build the endpoint URL with command as query parameter
    const endpoint = `/loans/${id}?command=approve`;
    
    const data = await fetchFineractAPI(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error approving loan:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
