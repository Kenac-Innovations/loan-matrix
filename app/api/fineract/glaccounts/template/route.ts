// File: app/api/fineract/glaccounts/template/route.ts
import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET() {
  const data = await fetchFineractAPI('/glaccounts/template');
  return NextResponse.json(data);
}
