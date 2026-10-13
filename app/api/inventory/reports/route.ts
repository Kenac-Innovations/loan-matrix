import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireInventoryReportAccess, InventoryAccessError } from '@/lib/inventory/inventory-access';
import { parseInventoryReportFilters } from '@/lib/inventory/inventory-report-types';
import { getInventoryReport } from '@/lib/inventory/inventory-report-service';
export async function GET(request:NextRequest){
 try{
  const access=await requireInventoryReportAccess();
  const filters=parseInventoryReportFilters(request.nextUrl.searchParams);
  return NextResponse.json(await getInventoryReport(prisma,access,filters),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  if(error instanceof ZodError)return NextResponse.json({error:error.issues.map(i=>i.message).join('; ')},{status:400});
  if(error instanceof InventoryAccessError)return NextResponse.json({error:error.message},{status:error.status});
  console.error('Inventory report failed',error);
  return NextResponse.json({error:'The inventory report could not be generated.'},{status:500});
 }
}
