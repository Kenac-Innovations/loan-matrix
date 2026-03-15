import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get('officeId');
    
    let url = '/glclosures';
    if (officeId) {
      url += `?officeId=${officeId}`;
    }
    
    const response = await fetchFineractAPI(url);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/fineract/glclosures error:', error);
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

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const response = await fetchFineractAPI('/glclosures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('POST /api/fineract/glclosures error:', error);
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