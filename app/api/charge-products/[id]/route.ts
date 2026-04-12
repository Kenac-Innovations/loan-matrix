import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import type { ChargeProduct } from "@/app/generated/prisma";
import {
  CHARGE_PRODUCT_CALC_TO_FINERACT_CODE,
  CHARGE_PRODUCT_CALCULATION_TYPES,
  CHARGE_PRODUCT_PAYMENT_MODES,
  CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TIME_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TIME_TYPES,
  CHARGE_PRODUCT_TYPES,
  CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE,
  computeEffectiveFineractChargeValues,
} from "@/shared/types/charge-product";
import {
  findOptionIdByCode,
  getChargeAppliesToOptions,
  getChargeCalculationOptionsForType,
  getChargePaymentModeOptions,
  getChargeTimeOptionsForType,
} from "@/lib/charge-product-fineract";

const updateChargeProductSchema = z.object({
  name: z.string().min(1, "Charge name is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  currencyCode: z.string().min(1, "Currency is required"),
  isInvoiceDiscountIncome: z.boolean().optional(),
  type: z.enum(CHARGE_PRODUCT_TYPES),
  chargeTimeType: z.enum(CHARGE_PRODUCT_TIME_TYPES),
  chargeCalculationType: z.enum(CHARGE_PRODUCT_CALCULATION_TYPES),
  chargePaymentMode: z.enum(CHARGE_PRODUCT_PAYMENT_MODES),
  active: z.boolean().default(true).optional(),
});

function toChargeProductResponse(item: ChargeProduct) {
  return {
    ...item,
    amount: item.amount?.toString?.() ?? String(item.amount),
    fineractAmount:
      item.fineractAmount == null
        ? null
        : item.fineractAmount?.toString?.() ?? String(item.fineractAmount),
  };
}

function extractErrorMessage(error: unknown): string {
  const candidate = error as {
    errorData?: { errors?: Array<{ defaultUserMessage?: string }>; defaultUserMessage?: string };
    message?: string;
  };

  return (
    candidate?.errorData?.errors?.[0]?.defaultUserMessage ||
    candidate?.errorData?.defaultUserMessage ||
    candidate?.message ||
    "Unknown error"
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let debugContext: Record<string, unknown> | null = null;

  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await prisma.chargeProduct.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Charge product not found" }, { status: 404 });
    }

    if (!existing.fineractChargeId) {
      return NextResponse.json(
        {
          error:
            "Charge product is not synced with Fineract yet. Please recreate or resync this charge.",
        },
        { status: 409 }
      );
    }

    const body = await request.json();
    const payload = updateChargeProductSchema.parse(body);

    const template = await fetchFineractAPI("/charges/template");
    const appliesToOptions = getChargeAppliesToOptions(template);
    const timeOptions = getChargeTimeOptionsForType(template, payload.type);
    const calculationOptions = getChargeCalculationOptionsForType(
      template,
      payload.type
    );
    const paymentModeOptions = getChargePaymentModeOptions(template);

    const effective = computeEffectiveFineractChargeValues(
      payload.chargeTimeType,
      payload.chargeCalculationType,
      payload.chargePaymentMode
    );

    const chargeAppliesToId = findOptionIdByCode(
      appliesToOptions,
      CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE[payload.type]
    );
    const chargeTimeTypeId = findOptionIdByCode(
      timeOptions,
      CHARGE_PRODUCT_TIME_TO_FINERACT_CODE[effective.effectiveTimeType]
    );
    const chargeCalculationTypeId = findOptionIdByCode(
      calculationOptions,
      CHARGE_PRODUCT_CALC_TO_FINERACT_CODE[effective.effectiveCalculationType]
    );
    const chargePaymentModeId = findOptionIdByCode(
      paymentModeOptions,
      CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE[effective.effectivePaymentMode]
    );

    debugContext = {
      chargeProductId: existing.id,
      fineractChargeId: existing.fineractChargeId,
      localInput: {
        name: payload.name.trim(),
        amount: payload.amount,
        currencyCode: payload.currencyCode.trim().toUpperCase(),
        isInvoiceDiscountIncome: payload.isInvoiceDiscountIncome ?? false,
        type: payload.type,
        chargeTimeType: payload.chargeTimeType,
        chargeCalculationType: payload.chargeCalculationType,
        chargePaymentMode: payload.chargePaymentMode,
        active: payload.active ?? true,
      },
      effectiveValues: effective,
      expectedCodes: {
        chargeAppliesTo: CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE[payload.type],
        chargeTimeType:
          CHARGE_PRODUCT_TIME_TO_FINERACT_CODE[effective.effectiveTimeType],
        chargeCalculationType:
          CHARGE_PRODUCT_CALC_TO_FINERACT_CODE[effective.effectiveCalculationType],
        chargePaymentMode:
          CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE[effective.effectivePaymentMode],
      },
      templateCodes: {
        chargeAppliesTo: appliesToOptions.map((option) => option.code),
        chargeTimeType: timeOptions.map((option) => option.code),
        chargeCalculationType: calculationOptions.map((option) => option.code),
        chargePaymentMode: paymentModeOptions.map((option) => option.code),
      },
      resolvedIds: {
        chargeAppliesToId,
        chargeTimeTypeId,
        chargeCalculationTypeId,
        chargePaymentModeId,
      },
    };

    if (
      chargeAppliesToId == null ||
      chargeTimeTypeId == null ||
      chargeCalculationTypeId == null ||
      chargePaymentModeId == null
    ) {
      const missingMappings = [
        chargeAppliesToId == null ? "chargeAppliesToId" : null,
        chargeTimeTypeId == null ? "chargeTimeTypeId" : null,
        chargeCalculationTypeId == null ? "chargeCalculationTypeId" : null,
        chargePaymentModeId == null ? "chargePaymentModeId" : null,
      ].filter((item): item is string => item !== null);

      throw new Error(
        `Could not map selected charge options to Fineract template IDs. Missing: ${missingMappings.join(
          ", "
        )}`
      );
    }

    const fineractPayload = {
      name: payload.name.trim(),
      chargeAppliesTo: chargeAppliesToId,
      currencyCode: payload.currencyCode.trim().toUpperCase(),
      amount: effective.effectiveAmount,
      chargeTimeType: chargeTimeTypeId,
      chargeCalculationType: chargeCalculationTypeId,
      chargePaymentMode: chargePaymentModeId,
      active: payload.active ?? true,
      penalty: false,
      locale: "en",
    };
    debugContext.fineractPayload = fineractPayload;
    console.info("Fineract charge update payload:", fineractPayload);

    await fetchFineractAPI(`/charges/${existing.fineractChargeId}`, {
      method: "PUT",
      body: JSON.stringify(fineractPayload),
    });

    // Only persist locally after Fineract update succeeds.
    const syncedProduct = await prisma.chargeProduct.update({
      where: { id: existing.id },
      data: {
        name: payload.name.trim(),
        amount: payload.amount,
        currencyCode: payload.currencyCode.trim().toUpperCase(),
        type: payload.type,
        chargeTimeType: payload.chargeTimeType,
        chargeCalculationType: payload.chargeCalculationType,
        chargePaymentMode: payload.chargePaymentMode,
        active: payload.active ?? true,
        fineractChargeTimeType: effective.effectiveTimeType,
        fineractChargeCalculationType: effective.effectiveCalculationType,
        fineractAmount: effective.effectiveAmount,
        syncStatus: "SYNCED",
        syncError: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: toChargeProductResponse(syncedProduct),
    });
  } catch (error: unknown) {
    console.error("Error updating charge product:", error);
    if (debugContext) {
      console.error("Charge product update debug context:", debugContext);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: extractErrorMessage(error), debug: debugContext },
      { status: 500 }
    );
  }
}
