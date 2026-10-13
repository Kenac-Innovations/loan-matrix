import { StockControlError } from "./stock-errors";
import { createHash } from "node:crypto";
import {
  Prisma,
  type PrismaClient,
  type StockActionOperation,
} from "@/app/generated/prisma";
import {
  isArdaInventoryFeatureEnabled,
  type InventoryTenant,
} from "./inventory-access";
import { lockInventoryTenant } from "./inventory-lock";
import {
  reserveStockInTransaction,
  verifyReservation,
  consumeStockInTransaction,
} from "./stock-reservation-service";
import {
  parseStockSelection,
  storedStockSelection,
  type StockSelection,
} from "./stock-product-policy";
export class StockActionPendingError extends StockControlError {
  constructor(public operationId: string) {
    super(
      "This stock action is awaiting reconciliation. Stock remains reserved; do not repeat the payout.", 409, operationId,
    );
  }
}
export type StockActionInput<T> = {
  tenant: InventoryTenant;
  leadId: string;
  loanId: number;
  command: "approve" | "disburse";
  actorUserId: string;
  selection: StockSelection;
  payload: Record<string, unknown>;
  execute: (externalId?: string) => Promise<T>;
  reconcile: (operation: StockActionOperation) => Promise<T | null>;
};
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}
export function createStockActionService(db: PrismaClient) {
  async function finalize<T>(
    op: StockActionOperation,
    input: StockActionInput<T>,
    response: T,
  ): Promise<T> {
    // Persist external success independently, so local failure is recoverable.
    await db.stockActionOperation.updateMany({
      where: { id: op.id, status: { not: "FINALIZED" } },
      data: { status: "CONFIRMED", result: json(response) },
    });
    await db.$transaction(
      async (tx) => {
        await lockInventoryTenant(tx, input.tenant.id);
        const current = await tx.stockActionOperation.findUniqueOrThrow({
          where: { id: op.id },
        });
        if (current.status === "FINALIZED") return;
        if (input.command === "disburse")
          await consumeStockInTransaction(tx, {
            tenantId: input.tenant.id,
            leadId: input.leadId,
            actorUserId: input.actorUserId,
            operationId: op.id,
          });
        await tx.stockActionOperation.update({
          where: { id: op.id },
          data: { status: "FINALIZED", failureReason: null },
        });
      },
      { timeout: 15000 },
    );
    return response;
  }
  return {
    run: async <T>(input: StockActionInput<T>): Promise<T> => {
      if (
        !isArdaInventoryFeatureEnabled(input.tenant, "enforceStockAvailability")
      )
        return input.execute();
      const prepared = await db.$transaction(
        async (tx) => {
          await lockInventoryTenant(tx, input.tenant.id);
          const lead = await tx.lead.findFirstOrThrow({where: {id: input.leadId, tenantId: input.tenant.id}});
          if (JSON.stringify(parseStockSelection(storedStockSelection(lead.stateMetadata))) !== JSON.stringify(parseStockSelection(input.selection))) throw new StockControlError("Stock selection changed. Reload the loan before approving or disbursing.");
          const active = await tx.stockActionOperation.findFirst({
            where: {
              tenantId: input.tenant.id,
              leadId: input.leadId,
              status: { in: ["PREPARED", "UNCERTAIN", "CONFIRMED"] },
            },
          });
          if (active) {
            if (active.command !== input.command)
              throw new StockActionPendingError(active.id);
            return { op: active, owner: false };
          }
          let issue = await tx.stockLoanIssue.findFirst({
            where: { tenantId: input.tenant.id, leadId: input.leadId },
          });
          // A finalized command is replayed by reservation generation, not request timestamps.
          if (issue) {
            const done = await tx.stockActionOperation.findFirst({
              where: {
                tenantId: input.tenant.id,
                leadId: input.leadId,
                command: input.command,
                generation: issue.reservationGeneration,
                status: "FINALIZED",
              },
              orderBy: { createdAt: "desc" },
            });
            if (
              done &&
              (input.command === "disburse" || issue.status === "RESERVED")
            ) {
              const snapshot = done.requestSnapshot as {
                selection?: StockSelection;
              };
              if (
                JSON.stringify(parseStockSelection(snapshot.selection)) !==
                JSON.stringify(parseStockSelection(input.selection))
              )
                throw new StockControlError(
                  "Stock selection changed after the confirmed action; reconcile before retrying.",
                );
              return { op: done, owner: false };
            }
          }
          if (input.command === "approve") {
            await reserveStockInTransaction(tx, {
              tenantId: input.tenant.id,
              leadId: input.leadId,
              actorUserId: input.actorUserId,
              selection: input.selection,
            });
            issue = await tx.stockLoanIssue.findFirstOrThrow({
              where: { tenantId: input.tenant.id, leadId: input.leadId },
            });
          } else
            issue = await verifyReservation(tx, {
              tenantId: input.tenant.id,
              leadId: input.leadId,
              selection: input.selection,
            });
          if (!issue) throw new StockControlError("Stock reservation missing.");
          const operationKey = `${input.loanId}:${input.command}:${issue.reservationGeneration}:${createHash("sha256").update(JSON.stringify(input.payload)).digest("hex")}`;
          const old = await tx.stockActionOperation.findUnique({
            where: {
              tenantId_operationKey: {
                tenantId: input.tenant.id,
                operationKey,
              },
            },
          });
          const data = {
            tenantId: input.tenant.id,
            leadId: input.leadId,
            loanId: input.loanId,
            command: input.command,
            operationKey,
            generation: issue.reservationGeneration,
            status: "PREPARED",
            requestSnapshot: json({
              payload: input.payload,
              selection: input.selection,
            }),
            failureReason: null,
          };
          const op = old
            ? await tx.stockActionOperation.update({
                where: { id: old.id },
                data,
              })
            : await tx.stockActionOperation.create({ data });
          return { op, owner: true };
        },
        { timeout: 15000 },
      );
      const op = prepared.op;
      if (op.status === "FINALIZED") return op.result as T;
      if (!prepared.owner) {
        if (op.status === "CONFIRMED")
          return finalize(op, input, op.result as T);
        const confirmed = await input.reconcile(op);
        if (confirmed !== null) return finalize(op, input, confirmed);
        throw new StockActionPendingError(op.id);
      }
      let response: T;
      try {
        response = await input.execute(
          input.command === "disburse"
            ? String(input.payload.externalId || `stock-op-${op.id}`)
            : undefined,
        );
      } catch (error) {
        const e = error as {
          status?: number;
          response?: { status?: number };
          message?: string;
        };
        const status = e.status ?? e.response?.status;
        const definite = Boolean(
          status && [400, 401, 403, 404, 422].includes(status),
        );
        await db.stockActionOperation.updateMany({
          where: { id: op.id, status: { in: ["PREPARED", "UNCERTAIN"] } },
          data: {
            status: definite ? "FAILED" : "UNCERTAIN",
            failureReason: e.message || "External request failed",
          },
        });
        const durable = await db.stockActionOperation.findUniqueOrThrow({ where: { id: op.id } });
        if (durable.status === "FINALIZED") return durable.result as T;
        if (durable.status === "CONFIRMED") {
          try { return await finalize(durable, input, durable.result as T); }
          catch { throw new StockActionPendingError(op.id); }
        }
        if (definite) throw error;
        throw new StockActionPendingError(op.id);
      }
      try {
        return await finalize(op, input, response);
      } catch {
        throw new StockActionPendingError(op.id);
      }
    },
  };
}
