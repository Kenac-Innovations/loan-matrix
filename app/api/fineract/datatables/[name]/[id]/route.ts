import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

// GET /api/fineract/datatables/[name]/[id]?genericResultSet=true
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    const { searchParams } = new URL(request.url);
    const genericResultSet = searchParams.get('genericResultSet') || 'true';
    const query = new URLSearchParams({ genericResultSet });
    const data = await fetchFineractAPI(`/datatables/${encodeURIComponent(name)}/${encodeURIComponent(id)}?${query.toString()}`);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch datatable data' },
      { status: error?.status || 500 }
    );
  }
}


