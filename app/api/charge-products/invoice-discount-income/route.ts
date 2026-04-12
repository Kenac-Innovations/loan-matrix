import { NextRequest, NextResponse } from "next/server";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  ensureInvoiceDiscountIncomeCharge,
  serializeChargeProduct,
} from "@/lib/invoice-discount-income-charge";

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const charge = await ensureInvoiceDiscountIncomeCharge({
      tenantId: tenant.id,
      currencyCode:
        typeof body?.currencyCode === "string" ? body.currencyCode : undefined,
    });

    return NextResponse.json({
      success: true,
      data: serializeChargeProduct(charge),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to ensure invoice discount income charge";
    console.error("[invoice-discount-income-charge] POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
