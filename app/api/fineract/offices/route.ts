// File: app/api/fineract/offices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderBy = searchParams.get('orderBy') || 'id';
    
    const url = `/offices?orderBy=${orderBy}`;
    const response = await fetchFineractAPI(url);
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/fineract/offices error:', error);
    if (error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status || 500 });
    }
    return NextResponse.json(
      {
        defaultUserMessage: 'An unexpected error occurred',
        developerMessage: error.message
      },
      { status: 500 }
    );
  }
}