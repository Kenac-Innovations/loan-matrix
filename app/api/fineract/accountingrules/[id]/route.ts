import { NextRequest, NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountingRule = await fetchFineractAPI(`/accountingrules/${params.id}`);
    return NextResponse.json(accountingRule);
  } catch (error: any) {
    console.error('Error fetching accounting rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounting rule' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const accountingRule = await fetchFineractAPI(`/accountingrules/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return NextResponse.json(accountingRule);
  } catch (error: any) {
    console.error('Error updating accounting rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update accounting rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await fetchFineractAPI(`/accountingrules/${params.id}`, {
      method: 'DELETE',
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting accounting rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete accounting rule' },
      { status: 500 }
    );
  }
} 