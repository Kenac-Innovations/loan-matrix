import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET    /api/fineract/glaccounts         - list all GL accounts (optional)
 * POST   /api/fineract/glaccounts         - create a new GL account
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await fetchFineractAPI('/glaccounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating GL account:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const data = await fetchFineractAPI('/glaccounts');
    return NextResponse.json({ chartAccounts: data });
  } catch (error: any) {
    console.error('Error listing GL accounts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}