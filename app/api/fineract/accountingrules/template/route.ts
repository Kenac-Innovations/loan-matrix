import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const template = await fetchFineractAPI('/accountingrules/template');
    return NextResponse.json(template);
  } catch (error: any) {
    console.error('Error fetching accounting rules template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounting rules template' },
      { status: 500 }
    );
  }
} 