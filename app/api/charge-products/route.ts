import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import type { ChargeProduct } from "@/app/generated/prisma";
import {
  computeEffectiveFineractChargeValues,
  CHARGE_PRODUCT_CALC_TO_FINERACT_CODE,
  CHARGE_PRODUCT_CALCULATION_TYPES,
  CHARGE_PRODUCT_PAYMENT_MODES,
  CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TIME_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TIME_TYPES,
  CHARGE_PRODUCT_TYPES,
  CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE,
} from "@/shared/types/charge-product";
import {
  findOptionIdByCode,
  getChargeAppliesToOptions,
  getChargeCalculationOptionsForType,
  getChargePaymentModeOptions,
  getChargeTimeOptionsForType,
} from "@/lib/charge-product-fineract";

const createChargeProductSchema = z.object({
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

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const products = await prisma.chargeProduct.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: products.map(toChargeProductResponse),
    });
  } catch (error) {
    console.error("Error fetching charge products:", error);
    return NextResponse.json(
      { error: "Failed to fetch charge products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let localProduct: ChargeProduct | null = null;
  let debugContext: Record<string, unknown> | null = null;

  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const payload = createChargeProductSchema.parse(body);

    localProduct = await prisma.chargeProduct.create({
      data: {
        tenantId: tenant.id,
        name: payload.name.trim(),
        amount: payload.amount,
        currencyCode: payload.currencyCode.trim().toUpperCase(),
        isInvoiceDiscountIncome: payload.isInvoiceDiscountIncome ?? false,
        type: payload.type,
        chargeTimeType: payload.chargeTimeType,
        chargeCalculationType: payload.chargeCalculationType,
        chargePaymentMode: payload.chargePaymentMode,
        active: payload.active ?? true,
        syncStatus: "PENDING",
      },
    });

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
      localInput: {
        name: payload.name.trim(),
        amount: payload.amount,
        currencyCode: payload.currencyCode.trim().toUpperCase(),
        type: payload.type,
        chargeTimeType: payload.chargeTimeType,
        chargeCalculationType: payload.chargeCalculationType,
        chargePaymentMode: payload.chargePaymentMode,
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
      active: true,
      penalty: false,
      locale: "en",
    };
    debugContext.fineractPayload = fineractPayload;
    console.info("Fineract charge create payload:", fineractPayload);

    const fineractResult = await fetchFineractAPI("/charges", {
      method: "POST",
      body: JSON.stringify(fineractPayload),
    });

    const fineractChargeId = Number(
      fineractResult?.resourceId ?? fineractResult?.subResourceId
    );
    if (!Number.isFinite(fineractChargeId)) {
      throw new Error("Fineract did not return a valid charge ID");
    }

    const syncedProduct = await prisma.chargeProduct.update({
      where: { id: localProduct.id },
      data: {
        fineractChargeId,
        fineractChargeTimeType: effective.effectiveTimeType,
        fineractChargeCalculationType: effective.effectiveCalculationType,
        fineractAmount: effective.effectiveAmount,
        syncStatus: "SYNCED",
        syncError: null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: toChargeProductResponse(syncedProduct),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating charge product:", error);
    if (debugContext) {
      console.error("Charge product create debug context:", debugContext);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 }
      );
    }

    if (localProduct?.id) {
      const failedProduct = await prisma.chargeProduct.update({
        where: { id: localProduct.id },
        data: (() => {
          const fallbackEffective = computeEffectiveFineractChargeValues(
            localProduct.chargeTimeType,
            localProduct.chargeCalculationType,
            localProduct.chargePaymentMode
          );
          return {
            syncStatus: "FAILED" as const,
            syncError: extractErrorMessage(error),
            fineractChargeTimeType: fallbackEffective.effectiveTimeType,
            fineractChargeCalculationType:
              fallbackEffective.effectiveCalculationType,
            fineractAmount: fallbackEffective.effectiveAmount,
          };
        })(),
      });

      return NextResponse.json(
        {
          success: false,
          error: extractErrorMessage(error),
          localSaved: true,
          debug: debugContext,
          data: toChargeProductResponse(failedProduct),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: extractErrorMessage(error), debug: debugContext },
      { status: 500 }
    );
  }
}
