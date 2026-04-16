import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetchFineractAPI('/runaccruals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error running accruals:', error);
    
    if (error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status || 500 });
    }
    
    return NextResponse.json(
      { error: 'Failed to run accruals' },
      { status: 500 }
    );
  }
} 