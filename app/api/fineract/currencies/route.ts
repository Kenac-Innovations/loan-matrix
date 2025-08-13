// File: app/api/fineract/currencies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const response = await fetchFineractAPI('/currencies');
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/fineract/currencies error:', error);
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
