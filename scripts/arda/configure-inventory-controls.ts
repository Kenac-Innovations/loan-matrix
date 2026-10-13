import { prisma } from "../../lib/prisma";
async function main() {
  const apply = process.argv.includes("--apply");
  const ids = (
    process.argv
      .find((a) => a.startsWith("--stock-product-ids="))
      ?.split("=")[1] ?? ""
  )
    .split(",")
    .filter(Boolean)
    .map(Number);
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0))
    throw new Error(
      "Supply verified ARDA --stock-product-ids=1,2 before enabling stock enforcement.",
    );
  await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { slug: "arda" },
      });
      const settings = (tenant.settings ?? {}) as Record<string, unknown>;
      const merged = {
        ...settings,
        features: {
          ...((settings.features as object) ?? {}),
          hasInventoryReports: true,
          enforceStockAvailability: true,
        },
        inventory: {
          ...((settings.inventory as object) ?? {}),
          stockProductIds: [...new Set(ids)],
        },
      };
      console.log(
        JSON.stringify({
          tenantId: tenant.id,
          tenant: tenant.slug,
          apply,
          changes: {
            hasInventoryReports: true,
            enforceStockAvailability: true,
            stockProductIds: ids,
          },
        }),
      );
      if (apply)
        await tx.tenant.update({
          where: { id: tenant.id, slug: "arda" },
          data: { settings: merged },
        });
    },
    { isolationLevel: "Serializable" },
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
