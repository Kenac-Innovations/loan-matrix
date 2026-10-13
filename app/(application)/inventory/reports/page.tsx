import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireInventoryReportAccess,
  InventoryAccessError,
} from "@/lib/inventory/inventory-access";
import { InventoryReports } from "../components/inventory-reports";
export default async function InventoryReportsPage() {
  const access = await requireInventoryReportAccess().catch((error) => {
    if (error instanceof InventoryAccessError) notFound();
    throw error;
  });
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      tenantId: access.tenantId,
      fineractOfficeId: { in: access.allowedOfficeIds },
    },
    select: {
      fineractOfficeId: true,
      fineractOfficeName: true,
      currencyCode: true,
      inventoryItem: { select: { id: true, name: true } },
    },
  });
  return (
    <InventoryReports
      offices={[
        ...new Map(
          balances.map((b) => [
            b.fineractOfficeId,
            {
              id: b.fineractOfficeId,
              name: b.fineractOfficeName || `Office ${b.fineractOfficeId}`,
            },
          ]),
        ).values(),
      ]}
      items={[
        ...new Map(
          balances.map((b) => [b.inventoryItem.id, b.inventoryItem]),
        ).values(),
      ]}
      currencies={[...new Set(balances.map((b) => b.currencyCode))].sort()}
    />
  );
}
