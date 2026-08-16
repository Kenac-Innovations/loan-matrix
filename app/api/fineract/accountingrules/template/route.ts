import { NextRequest, NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const template = await fetchFineractAPI('/accountingrules/template');
    return NextResponse.json(template);
  } catch (error: any) {
    console.error('Error fetching accounting rules template:', error);
    return buildFineractErrorResponse(error);
  }
} 