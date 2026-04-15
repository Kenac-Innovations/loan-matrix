import type { ChargeProduct } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import {
  CHARGE_PRODUCT_CALC_TO_FINERACT_CODE,
  CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TIME_TO_FINERACT_CODE,
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

export const INVOICE_DISCOUNT_INCOME_CHARGE_NAME = "INVOICE_INCOME";

type EnsureInvoiceDiscountIncomeChargeParams = {
  tenantId: string;
  currencyCode?: string | null;
};

type FineractChargeSummary = {
  id: number;
  name?: string;
  currency?: {
    code?: string;
  };
  chargeAppliesTo?: {
    code?: string;
  };
};

function normalizeCurrencyCode(currencyCode?: string | null) {
  const normalized = currencyCode?.trim().toUpperCase();
  return normalized || null;
}

function buildDesiredChargeValues(currencyCode: string) {
  return {
    name: INVOICE_DISCOUNT_INCOME_CHARGE_NAME,
    amount: 1,
    currencyCode,
    isInvoiceDiscountIncome: true,
    type: "LOAN" as const,
    chargeTimeType: "SPECIFIED_DUE_DATE" as const,
    chargeCalculationType: "FLAT" as const,
    chargePaymentMode: "REGULAR" as const,
    active: true,
  };
}

function getErrorMessage(error: unknown) {
  const candidate = error as {
    errorData?: {
      errors?: Array<{ defaultUserMessage?: string }>;
      defaultUserMessage?: string;
    };
    message?: string;
  };

  return (
    candidate?.errorData?.errors?.[0]?.defaultUserMessage ||
    candidate?.errorData?.defaultUserMessage ||
    candidate?.message ||
    "Unknown error"
  );
}

function isDuplicateInvoiceIncomeChargeError(error: unknown) {
  const message = getErrorMessage(error);
  return (
    message.includes("Charge with name") &&
    message.includes(INVOICE_DISCOUNT_INCOME_CHARGE_NAME) &&
    message.includes("already exists")
  );
}

async function findExistingFineractInvoiceIncomeCharge(currencyCode: string) {
  const charges = (await fetchFineractAPI("/charges", {
    method: "GET",
  })) as FineractChargeSummary[];

  return charges.find((charge) => {
    const appliesToLoan = charge.chargeAppliesTo?.code === "chargeAppliesTo.loan";
    const sameName = charge.name === INVOICE_DISCOUNT_INCOME_CHARGE_NAME;
    const sameCurrency = charge.currency?.code === currencyCode;
    return sameName && appliesToLoan && sameCurrency;
  });
}

function needsInvoiceDiscountIncomeNormalization(
  charge: ChargeProduct,
  desiredCurrencyCode: string
) {
  return (
    charge.name !== INVOICE_DISCOUNT_INCOME_CHARGE_NAME ||
    Number(charge.amount) !== 1 ||
    charge.currencyCode !== desiredCurrencyCode ||
    charge.isInvoiceDiscountIncome !== true ||
    charge.type !== "LOAN" ||
    charge.chargeTimeType !== "SPECIFIED_DUE_DATE" ||
    charge.chargeCalculationType !== "FLAT" ||
    charge.chargePaymentMode !== "REGULAR" ||
    charge.active !== true
  );
}

async function findExistingInvoiceDiscountIncomeCharge(tenantId: string) {
  const flagged = await prisma.chargeProduct.findFirst({
    where: { tenantId, isInvoiceDiscountIncome: true },
    orderBy: { createdAt: "asc" },
  });
  if (flagged) {
    return flagged;
  }

  const byName = await prisma.chargeProduct.findFirst({
    where: { tenantId, name: INVOICE_DISCOUNT_INCOME_CHARGE_NAME },
    orderBy: { createdAt: "asc" },
  });
  if (!byName) {
    return null;
  }

  return prisma.chargeProduct.update({
    where: { id: byName.id },
    data: { isInvoiceDiscountIncome: true },
  });
}

async function syncChargeProductToFineract(charge: ChargeProduct) {
  const template = await fetchFineractAPI("/charges/template");
  const appliesToOptions = getChargeAppliesToOptions(template);
  const timeOptions = getChargeTimeOptionsForType(template, charge.type);
  const calculationOptions = getChargeCalculationOptionsForType(
    template,
    charge.type
  );
  const paymentModeOptions = getChargePaymentModeOptions(template);

  const effective = computeEffectiveFineractChargeValues(
    charge.chargeTimeType,
    charge.chargeCalculationType,
    charge.chargePaymentMode
  );

  const chargeAppliesToId = findOptionIdByCode(
    appliesToOptions,
    CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE[charge.type]
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

  if (
    chargeAppliesToId == null ||
    chargeTimeTypeId == null ||
    chargeCalculationTypeId == null ||
    chargePaymentModeId == null
  ) {
    throw new Error(
      "Could not map invoice discount income charge options to Fineract template IDs"
    );
  }

  const fineractPayload = {
    name: charge.name,
    chargeAppliesTo: chargeAppliesToId,
    currencyCode: charge.currencyCode,
    amount: effective.effectiveAmount,
    chargeTimeType: chargeTimeTypeId,
    chargeCalculationType: chargeCalculationTypeId,
    chargePaymentMode: chargePaymentModeId,
    active: true,
    penalty: false,
    locale: "en",
  };

  if (charge.fineractChargeId) {
    await fetchFineractAPI(`/charges/${charge.fineractChargeId}`, {
      method: "PUT",
      body: JSON.stringify(fineractPayload),
    });

    return prisma.chargeProduct.update({
      where: { id: charge.id },
      data: {
        fineractChargeTimeType: effective.effectiveTimeType,
        fineractChargeCalculationType: effective.effectiveCalculationType,
        fineractAmount: effective.effectiveAmount,
        syncStatus: "SYNCED",
        syncError: null,
      },
    });
  }

  const fineractResult = await fetchFineractAPI("/charges", {
    method: "POST",
    body: JSON.stringify(fineractPayload),
  }).catch(async (error) => {
    if (!isDuplicateInvoiceIncomeChargeError(error)) {
      throw error;
    }

    const existingFineractCharge =
      await findExistingFineractInvoiceIncomeCharge(charge.currencyCode);
    const fineractChargeId = Number(existingFineractCharge?.id);

    if (!Number.isFinite(fineractChargeId)) {
      throw new Error(
        "INVOICE_INCOME already exists in Fineract but its charge ID could not be resolved"
      );
    }

    return { resourceId: fineractChargeId };
  });

  const fineractChargeId = Number(
    fineractResult?.resourceId ?? fineractResult?.subResourceId
  );
  if (!Number.isFinite(fineractChargeId)) {
    throw new Error("Fineract did not return a valid invoice discount income charge ID");
  }

  return prisma.chargeProduct.update({
    where: { id: charge.id },
    data: {
      fineractChargeId,
      fineractChargeTimeType: effective.effectiveTimeType,
      fineractChargeCalculationType: effective.effectiveCalculationType,
      fineractAmount: effective.effectiveAmount,
      syncStatus: "SYNCED",
      syncError: null,
    },
  });
}

export function serializeChargeProduct(item: ChargeProduct) {
  return {
    ...item,
    amount: item.amount?.toString?.() ?? String(item.amount),
    fineractAmount:
      item.fineractAmount == null
        ? null
        : item.fineractAmount?.toString?.() ?? String(item.fineractAmount),
  };
}

export async function ensureInvoiceDiscountIncomeCharge({
  tenantId,
  currencyCode,
}: EnsureInvoiceDiscountIncomeChargeParams) {
  const existing = await findExistingInvoiceDiscountIncomeCharge(tenantId);

  if (!existing && !normalizeCurrencyCode(currencyCode)) {
    throw new Error(
      "A currency code is required to create the INVOICE_INCOME charge for this tenant"
    );
  }

  const resolvedCurrencyCode =
    normalizeCurrencyCode(currencyCode) ||
    normalizeCurrencyCode(existing?.currencyCode);

  if (!resolvedCurrencyCode) {
    throw new Error("Unable to resolve a currency code for INVOICE_INCOME");
  }

  const desiredValues = buildDesiredChargeValues(resolvedCurrencyCode);

  let charge = existing;
  if (!charge) {
    charge = await prisma.chargeProduct.create({
      data: {
        tenantId,
        ...desiredValues,
        syncStatus: "PENDING",
      },
    });
  } else if (needsInvoiceDiscountIncomeNormalization(charge, resolvedCurrencyCode)) {
    charge = await prisma.chargeProduct.update({
      where: { id: charge.id },
      data: {
        ...desiredValues,
        syncStatus: charge.fineractChargeId ? charge.syncStatus : "PENDING",
        syncError: null,
      },
    });
  }

  if (
    charge.syncStatus !== "SYNCED" ||
    !charge.fineractChargeId ||
    charge.fineractChargeTimeType !== "SPECIFIED_DUE_DATE" ||
    charge.fineractChargeCalculationType !== "FLAT" ||
    Number(charge.fineractAmount ?? 0) !== 1
  ) {
    try {
      charge = await syncChargeProductToFineract(charge);
    } catch (error) {
      const message = getErrorMessage(error);

      charge = await prisma.chargeProduct.update({
        where: { id: charge.id },
        data: {
          syncStatus: "FAILED",
          syncError: message,
        },
      });

      throw error;
    }
  }

  return charge;
}
