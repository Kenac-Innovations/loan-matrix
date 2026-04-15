import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const SOURCE_TENANT_SLUG = "omama";
const TARGET_TENANT = {
  name: "Omama Training",
  slug: "omama-training",
  domain: "omama-training.kenac.co.zw",
} as const;

async function main() {
  const sourceTenant = await prisma.tenant.findUnique({
    where: { slug: SOURCE_TENANT_SLUG },
    include: {
      loanContractTemplates: true,
      receiptRanges: true,
    },
  });

  if (!sourceTenant) {
    throw new Error(`Source tenant '${SOURCE_TENANT_SLUG}' was not found.`);
  }

  const targetTenant = await prisma.tenant.upsert({
    where: { slug: TARGET_TENANT.slug },
    update: {
      name: TARGET_TENANT.name,
      domain: TARGET_TENANT.domain,
      settings: sourceTenant.settings ?? undefined,
      logoLinkId: sourceTenant.logoLinkId ?? undefined,
      logoFileUrl: sourceTenant.logoFileUrl ?? undefined,
      isActive: true,
    },
    create: {
      name: TARGET_TENANT.name,
      slug: TARGET_TENANT.slug,
      domain: TARGET_TENANT.domain,
      settings: sourceTenant.settings ?? undefined,
      logoLinkId: sourceTenant.logoLinkId ?? undefined,
      logoFileUrl: sourceTenant.logoFileUrl ?? undefined,
      isActive: true,
    },
  });

  for (const template of sourceTenant.loanContractTemplates) {
    await prisma.loanContractTemplate.upsert({
      where: {
        tenantId_slug: {
          tenantId: targetTenant.id,
          slug: template.slug,
        },
      },
      update: {
        name: template.name,
        content: template.content,
        isDefault: template.isDefault,
      },
      create: {
        tenantId: targetTenant.id,
        name: template.name,
        slug: template.slug,
        content: template.content,
        isDefault: template.isDefault,
      },
    });
  }

  const targetReceiptRangeCount = await prisma.receiptRange.count({
    where: { tenantId: targetTenant.id },
  });

  if (
    targetReceiptRangeCount === 0 &&
    sourceTenant.receiptRanges.length > 0
  ) {
    await prisma.receiptRange.createMany({
      data: sourceTenant.receiptRanges.map((range) => ({
        tenantId: targetTenant.id,
        prefix: range.prefix,
        rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd,
        isActive: range.isActive,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        tenant: {
          id: targetTenant.id,
          slug: targetTenant.slug,
          domain: targetTenant.domain,
        },
        clonedTemplates: sourceTenant.loanContractTemplates.length,
        sourceReceiptRanges: sourceTenant.receiptRanges.length,
        targetReceiptRanges:
          targetReceiptRangeCount === 0
            ? sourceTenant.receiptRanges.length
            : targetReceiptRangeCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Failed to upsert omama-training tenant:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
