import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]
 * Gets a specific loan by ID with optional associations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add associations parameter if provided, otherwise default to 'all'
    const associations = searchParams.get('associations') || 'all';
    queryParams.append('associations', associations);
    
    // Add exclude parameter if provided
    const exclude = searchParams.get('exclude');
    if (exclude) {
      queryParams.append('exclude', exclude);
    }
    
    // Build the endpoint URL with query parameters
    const endpoint = `/loans/${id}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const data = await fetchFineractAPI(endpoint);
    
    // Return the data as-is to preserve the original structure
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fineract/loans/[id]
 * Updates a specific loan
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const data = await fetchFineractAPI(`/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating loan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/fineract/loans/[id]
 * Deletes a specific loan
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/loans/${id}`, {
      method: 'DELETE',
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting loan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 