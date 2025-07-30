// File: app/api/fineract/paymenttypes/route.ts
import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET() {
  const data = await fetchFineractAPI('/paymenttypes');
  return NextResponse.json(data);
}
