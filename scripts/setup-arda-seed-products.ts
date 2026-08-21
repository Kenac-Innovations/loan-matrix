import { prisma } from "@/lib/prisma";
import { getFineractBaseUrl } from "@/lib/fineract-base-url";
import { FineractAPIService } from "@/lib/fineract-api";
import {
  ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
  ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
} from "@/lib/inventory/arda-stock-loan";
import { receiveInventory, type InventoryDb } from "@/lib/inventory/inventory-ledger-service";

const FINERACT_TENANT_ID = "omama";
const LOCAL_TENANT_SLUG = "omama";

type SeedLoanProduct = {
  name: string;
  shortName: string;
  description: string;
  externalId: string;
  repayments: number;
};

const products: SeedLoanProduct[] = [
  {
    name: "ARDA Maize Seed Seasonal Loan",
    shortName: "ARDM",
    description:
      "In-kind maize seed credit. The principal is the agreed value of issued seed and is repaid in six equal monthly instalments.",
    externalId: ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
    repayments: 6,
  },
  {
    name: "ARDA Groundnut Seed Quick Loan",
    shortName: "ARDG",
    description:
      "In-kind groundnut seed credit. The principal is the agreed value of issued seed and is repaid in one monthly instalment.",
    externalId: ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
    repayments: 1,
  },
];

function productPayload(product: SeedLoanProduct): Record<string, unknown> {
  return {
    locale: "en",
    dateFormat: "yyyy-MM-dd",
    name: product.name,
    shortName: product.shortName,
    description: product.description,
    externalId: product.externalId,
    useBorrowerCycle: false,
    currencyCode: "USD",
    digitsAfterDecimal: 2,
    principal: 100,
    minPrincipal: 1,
    maxPrincipal: 1000000,
    numberOfRepayments: product.repayments,
    minNumberOfRepayments: product.repayments,
    maxNumberOfRepayments: product.repayments,
    repaymentEvery: 1,
    repaymentFrequencyType: 2,
    interestRatePerPeriod: 2,
    minInterestRatePerPeriod: 2,
    maxInterestRatePerPeriod: 2,
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
  const tenant = await prisma.tenant.findUnique({
    where: { slug: LOCAL_TENANT_SLUG },
  });

  if (!tenant) throw new Error(`Local tenant ${LOCAL_TENANT_SLUG} was not found.`);

  const fineract = new FineractAPIService({
    baseUrl: getFineractBaseUrl(),
    username: process.env.FINERACT_USERNAME || "mifos",
    password: process.env.FINERACT_PASSWORD || "password",
    tenantId: FINERACT_TENANT_ID,
  });

  const existingProducts = await fineract.getLoanProducts();
  for (const product of products) {
    const existing = existingProducts.find(
      (candidate) => candidate.externalId === product.externalId
    );
    if (existing) {
      console.log(`Fineract product already exists: ${product.name} (ID ${existing.id})`);
      continue;
    }

    const created = await fineract.createLoanProduct(productPayload(product));
    console.log(`Created Fineract product: ${product.name} (ID ${created.resourceId})`);
  }

  const groundnutSeed = await prisma.inventoryItem.upsert({
    where: {
      tenantId_sku: {
        tenantId: tenant.id,
        sku: "GROUNDNUT-SEED-10KG",
      },
    },
    create: {
      tenantId: tenant.id,
      sku: "GROUNDNUT-SEED-10KG",
      name: "Groundnut Seed 10kg",
      description: "Certified groundnut seed for ARDA in-kind agricultural input credit.",
      unitOfMeasure: "bag",
      defaultUnitValue: "45.00",
      currencyCode: "USD",
    },
    update: {
      name: "Groundnut Seed 10kg",
      description: "Certified groundnut seed for ARDA in-kind agricultural input credit.",
      unitOfMeasure: "bag",
      defaultUnitValue: "45.00",
      currencyCode: "USD",
      isActive: true,
    },
  });

  const offices = await fineract.getOffices();
  const headOffice = offices.find((office) => office.name === "Head Office") ?? offices[0];
  if (!headOffice?.id) throw new Error("No Fineract office is available for the initial seed receipt.");

  const receipt = await receiveInventory(prisma as unknown as InventoryDb, {
    tenantId: tenant.id,
    inventoryItemId: groundnutSeed.id,
    fineractOfficeId: Number(headOffice.id),
    fineractOfficeName: String(headOffice.name ?? "Head Office"),
    quantity: "300",
    value: "13500.00",
    currencyCode: "USD",
    idempotencyKey: `setup-arda-groundnut-seed-initial-stock:${tenant.id}`,
    actorUserId: "arda-initial-setup",
    actorUserName: "ARDA Initial Setup",
    reason: "Initial groundnut seed stock for ARDA product demonstration",
  });

  console.log(
    `${receipt.idempotentReplay ? "Confirmed" : "Received"} 300 bags of Groundnut Seed 10kg at ${headOffice.name}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
