import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';

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
    return buildFineractErrorResponse(error, {
      action: 'run',
      resource: 'accruals',
    });
  }
}
