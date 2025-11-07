import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

// GET /api/fineract/datatables?apptable=m_client
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apptable = searchParams.get('apptable') || 'm_client';
    const query = new URLSearchParams({ apptable });
    const data = await fetchFineractAPI(`/datatables?${query.toString()}`);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch datatables' },
      { status: error?.status || 500 }
    );
  }
}


