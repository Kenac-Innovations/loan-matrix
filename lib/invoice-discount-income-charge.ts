import type { InvoiceDiscountingCharge } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import {
  CHARGE_PRODUCT_CALC_TO_FINERACT_CODE,
  CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TIME_TO_FINERACT_CODE,
  CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE,
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

async function findExistingInvoiceDiscountIncomeCharge(
  tenantId: string,
  currencyCode?: string | null
) {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  if (normalizedCurrencyCode) {
    return prisma.invoiceDiscountingCharge.findUnique({
      where: {
        tenantId_currencyCode: {
          tenantId,
          currencyCode: normalizedCurrencyCode,
        },
      },
    });
  }

  return prisma.invoiceDiscountingCharge.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
}

async function buildFineractPayload(currencyCode: string) {
  const template = await fetchFineractAPI("/charges/template");
  const appliesToOptions = getChargeAppliesToOptions(template);
  const timeOptions = getChargeTimeOptionsForType(template, "LOAN");
  const calculationOptions = getChargeCalculationOptionsForType(template, "LOAN");
  const paymentModeOptions = getChargePaymentModeOptions(template);

  const chargeAppliesToId = findOptionIdByCode(
    appliesToOptions,
    CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE.LOAN
  );
  const chargeTimeTypeId = findOptionIdByCode(
    timeOptions,
    CHARGE_PRODUCT_TIME_TO_FINERACT_CODE.SPECIFIED_DUE_DATE
  );
  const chargeCalculationTypeId = findOptionIdByCode(
    calculationOptions,
    CHARGE_PRODUCT_CALC_TO_FINERACT_CODE.FLAT
  );
  const chargePaymentModeId = findOptionIdByCode(
    paymentModeOptions,
    CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE.REGULAR
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

  return {
    name: INVOICE_DISCOUNT_INCOME_CHARGE_NAME,
    chargeAppliesTo: chargeAppliesToId,
    currencyCode,
    amount: 1,
    chargeTimeType: chargeTimeTypeId,
    chargeCalculationType: chargeCalculationTypeId,
    chargePaymentMode: chargePaymentModeId,
    active: true,
    penalty: false,
    locale: "en",
  };
}

async function syncInvoiceDiscountIncomeChargeToFineract(params: {
  currencyCode: string;
  existingFineractChargeId?: number | null;
}) {
  const { currencyCode, existingFineractChargeId } = params;
  const fineractPayload = await buildFineractPayload(currencyCode);

  const candidateIds = [
    Number.isFinite(Number(existingFineractChargeId))
      ? Number(existingFineractChargeId)
      : null,
    Number(await (async () => {
      const existing = await findExistingFineractInvoiceIncomeCharge(currencyCode);
      return existing?.id ?? null;
    })()),
  ].filter((value): value is number => value != null && Number.isFinite(value));

  for (const fineractChargeId of candidateIds) {
    try {
      await fetchFineractAPI(`/charges/${fineractChargeId}`, {
        method: "PUT",
        body: JSON.stringify(fineractPayload),
      });
      return fineractChargeId;
    } catch (error) {
      console.warn(
        "[invoice-discount-income-charge] Failed to normalize existing Fineract charge",
        {
          fineractChargeId,
          currencyCode,
          error: getErrorMessage(error),
        }
      );
    }
  }

  const fineractResult = await fetchFineractAPI("/charges", {
    method: "POST",
    body: JSON.stringify(fineractPayload),
  }).catch(async (error) => {
    if (!isDuplicateInvoiceIncomeChargeError(error)) {
      throw error;
    }

    const existingFineractCharge =
      await findExistingFineractInvoiceIncomeCharge(currencyCode);
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

  return fineractChargeId;
}

async function upsertInvoiceDiscountingChargeLookup(params: {
  tenantId: string;
  currencyCode: string;
  fineractChargeId: number;
}) {
  const { tenantId, currencyCode, fineractChargeId } = params;

  return prisma.invoiceDiscountingCharge.upsert({
    where: {
      tenantId_currencyCode: {
        tenantId,
        currencyCode,
      },
    },
    create: {
      tenantId,
      currencyCode,
      fineractChargeId,
      chargeName: INVOICE_DISCOUNT_INCOME_CHARGE_NAME,
    },
    update: {
      fineractChargeId,
      chargeName: INVOICE_DISCOUNT_INCOME_CHARGE_NAME,
    },
  });
}

export function serializeChargeProduct(item: InvoiceDiscountingCharge) {
  return {
    id: item.id,
    name: item.chargeName,
    chargeName: item.chargeName,
    currencyCode: item.currencyCode,
    fineractChargeId: item.fineractChargeId,
    isInvoiceDiscountIncome: true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function ensureInvoiceDiscountIncomeCharge({
  tenantId,
  currencyCode,
}: EnsureInvoiceDiscountIncomeChargeParams) {
  const existing = await findExistingInvoiceDiscountIncomeCharge(
    tenantId,
    currencyCode
  );

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

  const fineractChargeId = await syncInvoiceDiscountIncomeChargeToFineract({
    currencyCode: resolvedCurrencyCode,
    existingFineractChargeId: existing?.fineractChargeId,
  });

  return upsertInvoiceDiscountingChargeLookup({
    tenantId,
    currencyCode: resolvedCurrencyCode,
    fineractChargeId,
  });
}
