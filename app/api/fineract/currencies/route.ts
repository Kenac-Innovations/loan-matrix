// File: app/api/fineract/currencies/route.ts
import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET() {
  const data = await fetchFineractAPI('/currencies');
  return NextResponse.json(data);
}
