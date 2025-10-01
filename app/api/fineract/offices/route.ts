// File: app/api/fineract/offices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFineractServiceWithSession } from '@/lib/fineract-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderBy = searchParams.get('orderBy') || 'id';
    
    const fineractService = await getFineractServiceWithSession();
    const response = await fineractService.getOffices();
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/fineract/offices error:', error);
    
    // Better error handling for different error types
    const errorMessage = error?.message || error?.errorData?.defaultUserMessage || 'Unknown error';
    const statusCode = error?.status || 500;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error?.errorData || null
      },
      { status: statusCode }
    );
  }
}