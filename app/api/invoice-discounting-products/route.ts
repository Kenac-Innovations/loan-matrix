import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/invoice-discounting-products?fineractProductId=123
 * Returns { isInvoiceDiscounting: boolean }
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("fineractProductId");
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ isInvoiceDiscounting: false });
  }

  try {
    const record = await prisma.invoiceDiscountingProduct.findUnique({
      where: { fineractProductId: Number(id) },
    });
    return NextResponse.json({ isInvoiceDiscounting: Boolean(record) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[invoice-discounting-products] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/invoice-discounting-products
 * Body: { fineractProductId: number; productName: string }
 * Upserts the record (safe to call multiple times).
 */
export async function POST(request: NextRequest) {
  try {
    const { fineractProductId, productName } = await request.json();

    if (!fineractProductId || typeof fineractProductId !== "number") {
      return NextResponse.json(
        { error: "fineractProductId is required and must be a number" },
        { status: 400 }
      );
    }

    const record = await prisma.invoiceDiscountingProduct.upsert({
      where: { fineractProductId },
      create: { fineractProductId, productName: productName ?? "" },
      update: { productName: productName ?? "" },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/invoice-discounting-products?fineractProductId=123
 * Removes the invoice discounting flag from a product.
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("fineractProductId");
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "fineractProductId is required" }, { status: 400 });
  }

  try {
    await prisma.invoiceDiscountingProduct.delete({
      where: { fineractProductId: Number(id) },
    });
    return NextResponse.json({ success: true });
  } catch {
    // Record may not exist — treat as success
    return NextResponse.json({ success: true });
  }
}
