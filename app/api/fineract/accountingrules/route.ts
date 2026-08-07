import { NextRequest, NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get('officeId');
    const associations = searchParams.get('associations');
    
    let endpoint = '/accountingrules';
    const queryParams = new URLSearchParams();
    
    if (officeId) {
      queryParams.append('officeId', officeId);
    }
    
    if (associations) {
      queryParams.append('associations', associations);
    }
    
    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }
    
    const accountingRules = await fetchFineractAPI(endpoint);
    return NextResponse.json(accountingRules);
  } catch (error: any) {
    console.error('Error fetching accounting rules:', error);
    return buildFineractErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const accountingRule = await fetchFineractAPI('/accountingrules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(accountingRule, { status: 201 });
  } catch (error: any) {
    console.error('Error creating accounting rule:', error);
    return buildFineractErrorResponse(error);
  }
} 