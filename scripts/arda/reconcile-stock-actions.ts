import { prisma } from "../../lib/prisma";
import { createStockActionService } from "../../lib/inventory/stock-action-service";
import type { StockSelection } from "../../lib/inventory/stock-product-policy";
import { Prisma } from "../../app/generated/prisma";
async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "arda" },
  });
  const apply = process.argv.includes("--apply");
  const operations = await prisma.stockActionOperation.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ["PREPARED", "UNCERTAIN", "CONFIRMED"] },
    },
  });
  const base = process.env.ARDA_FINERACT_BASE_URL;
  if (!base || !process.env.FINERACT_USERNAME || !process.env.FINERACT_PASSWORD)
    throw new Error(
      "Set ARDA_FINERACT_BASE_URL to the verified API v1 URL and provide Fineract credentials.",
    );
  for (const op of operations) {
    if (!["approve", "disburse"].includes(op.command)) {
      console.log(
        JSON.stringify({
          operation: op.id,
          status: "MANUAL_REVIEW",
          command: op.command,
        }),
      );
      continue;
    }
    const snapshot = op.requestSnapshot as {
      selection: StockSelection;
      payload: Record<string, unknown>;
    };
    const reconcile = async () => {
      if (op.status === "CONFIRMED") return op.result;
      if (op.command !== "disburse") return null;
      const response = await fetch(
        `${base.replace(/\/$/, "")}/loans/${op.loanId}?associations=transactions`,
        {
          headers: {
            "Fineract-Platform-TenantId": "arda",
            Authorization:
              "Basic " +
              Buffer.from(
                `${process.env.FINERACT_USERNAME}:${process.env.FINERACT_PASSWORD}`,
              ).toString("base64"),
          },
        },
      );
      if (!response.ok)
        throw new Error(`Fineract read failed (${response.status})`);
      const loan = await response.json();
      const expected = String(
        snapshot.payload.externalId || `stock-op-${op.id}`,
      );
      const tx = loan.transactions?.find(
        (t: {
          id: number;
          externalId?: string | { value?: string };
          reversed?: boolean;
          type?: { id?: number };
          amount: number;
        }) =>
          (typeof t.externalId === "string"
            ? t.externalId
            : t.externalId?.value) === expected &&
          !t.reversed &&
          t.type?.id === 1 &&
          new Prisma.Decimal(t.amount).equals(
            new Prisma.Decimal(snapshot.selection.quantity).mul(
              snapshot.selection.unitValue,
            ),
          ),
      );
      return tx ? { resourceId: op.loanId, transactionId: tx.id } : null;
    };
    const confirmation = await reconcile();
    console.log(
      JSON.stringify({
        operation: op.id,
        command: op.command,
        confirmed: confirmation !== null,
        apply,
      }),
    );
    if (apply && confirmation !== null)
      await createStockActionService(prisma).run({
        tenant,
        leadId: op.leadId,
        loanId: op.loanId,
        command: op.command as "approve" | "disburse",
        actorUserId: "stock-reconciliation",
        selection: snapshot.selection,
        payload: snapshot.payload,
        execute: async () => {
          throw new Error(
            "Reconciliation must never initiate a financial action",
          );
        },
        reconcile: async () => confirmation,
      });
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
