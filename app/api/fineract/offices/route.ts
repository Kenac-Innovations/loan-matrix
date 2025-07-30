// File: app/api/fineract/offices/route.ts
import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const data = await fetchFineractAPI(`/offices${search}`);
  return NextResponse.json(data);
}