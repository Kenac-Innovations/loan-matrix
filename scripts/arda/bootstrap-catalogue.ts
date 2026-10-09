#!/usr/bin/env tsx

import { buildArdaCataloguePlan } from "@/lib/arda-catalogue-plan";
import { FineractAPIService } from "@/lib/fineract-api";
import { getFineractBaseUrl } from "@/lib/fineract-base-url";
import { prisma } from "@/lib/prisma";

const APPLY_FLAG = "--apply";
const ARDA_TENANT_SLUG = "arda";

function productPayload(product: ReturnType<typeof buildArdaCataloguePlan>["products"][number]) {
  return {
    locale: "en",
    dateFormat: "yyyy-MM-dd",
    name: product.name,
    shortName: product.shortName,
    description: product.description,
    externalId: product.externalId,
    useBorrowerCycle: false,
    currencyCode: product.currencyCode,
    digitsAfterDecimal: 2,
    principal: 100,
    minPrincipal: 1,
    maxPrincipal: 1000000,
    numberOfRepayments: product.repayments,
    minNumberOfRepayments: product.repayments,
    maxNumberOfRepayments: product.repayments,
    repaymentEvery: 1,
    repaymentFrequencyType: 2,
    interestRatePerPeriod: product.interestRatePerPeriod,
    minInterestRatePerPeriod: product.interestRatePerPeriod,
    maxInterestRatePerPeriod: product.interestRatePerPeriod,
    interestRateFrequencyType: 2,
    amortizationType: 1,
    interestType: 1,
    interestCalculationPeriodType: 1,
    transactionProcessingStrategyCode: "mifos-standard-strategy",
    accountingRule: 1,
    allowVariableInstallments: false,
    daysInMonthType: 1,
    daysInYearType: 1,
    isInterestRecalculationEnabled: false,
    charges: [],
    multiDisburseLoan: false,
    holdGuaranteeFunds: false,
  };
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const plan = buildArdaCataloguePlan();
  const tenant = await prisma.tenant.findUnique({
    where: { slug: ARDA_TENANT_SLUG },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new Error("ARDA Loan Matrix tenant is missing. Run bootstrap-loan-matrix-tenant.ts first.");
  }

  const fineract = new FineractAPIService({
    baseUrl: getFineractBaseUrl(),
    username: process.env.FINERACT_USERNAME || "mifos",
    password: process.env.FINERACT_PASSWORD || "password",
    tenantId: ARDA_TENANT_SLUG,
  });
  const existingProducts = await fineract.getLoanProducts();

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          tenant: tenant.name,
          productsToCreate: plan.products.filter(
            (product) => !existingProducts.some((existing) => existing.externalId === product.externalId),
          ),
          inventoryItemsToCreate: plan.inventoryItems,
          openingStockReceipts: plan.initialReceipts,
        },
        null,
        2,
      ),
    );
    console.log("Dry run only. Re-run with --apply to create the ARDA catalogue.");
    return;
  }

  for (const product of plan.products) {
    const existing = existingProducts.find(
      (candidate) => candidate.externalId === product.externalId,
    );
    if (existing) {
      console.log(`Fineract product already exists: ${product.name} (ID ${existing.id})`);
      continue;
    }

    const created = await fineract.createLoanProduct(productPayload(product));
    console.log(`Created Fineract product: ${product.name} (ID ${created.resourceId})`);
  }

  for (const item of plan.inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: item.sku } },
      create: { tenantId: tenant.id, ...item },
      update: { ...item, isActive: true },
    });
    console.log(`Created or confirmed inventory item: ${item.name}`);
  }

  console.log("ARDA catalogue complete. No opening stock was created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
