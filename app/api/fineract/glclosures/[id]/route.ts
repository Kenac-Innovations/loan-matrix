import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetchFineractAPI(`/glclosures/${id}`);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/fineract/glclosures/[id] error:', error);
    return buildFineractErrorResponse(error, {
      action: 'load',
      resource: 'GL closure',
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const response = await fetchFineractAPI(`/glclosures/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('PUT /api/fineract/glclosures/[id] error:', error);
    return buildFineractErrorResponse(error, {
      action: 'update',
      resource: 'GL closure',
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetchFineractAPI(`/glclosures/${id}`, {
      method: 'DELETE',
    });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('DELETE /api/fineract/glclosures/[id] error:', error);
    return buildFineractErrorResponse(error, {
      action: 'delete',
      resource: 'GL closure',
    });
  }
}
