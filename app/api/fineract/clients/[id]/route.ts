import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/clients/[id]
 * Gets a specific client by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/clients/${id}`);
    
    // Return the data as-is to preserve the original structure
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fineract/clients/[id]
 * Updates a specific client
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const data = await fetchFineractAPI(`/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/fineract/clients/[id]
 * Deletes a specific client
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/clients/${id}`, {
      method: 'DELETE',
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 