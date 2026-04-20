import { prisma } from "@/lib/prisma";

type UpsertRepaymentCashLinkInput = {
  tenantId: string;
  fineractTransactionId: number;
  loanId: number;
  transactionType?: string;
  amount: number;
  currency: string;
  tellerId?: string | null;
  cashierId?: string | null;
  fineractAllocationId?: number | null;
  isCash: boolean;
};

export async function upsertRepaymentCashLink(
  input: UpsertRepaymentCashLinkInput
) {
  return prisma.repaymentCashLink.upsert({
    where: {
      tenantId_fineractTransactionId: {
        tenantId: input.tenantId,
        fineractTransactionId: input.fineractTransactionId,
      },
    },
    create: {
      tenantId: input.tenantId,
      fineractTransactionId: input.fineractTransactionId,
      loanId: input.loanId,
      transactionType: input.transactionType ?? "REPAYMENT",
      amount: input.amount,
      currency: input.currency,
      tellerId: input.tellerId ?? null,
      cashierId: input.cashierId ?? null,
      fineractAllocationId: input.fineractAllocationId ?? null,
      isCash: input.isCash,
    },
    update: {
      loanId: input.loanId,
      transactionType: input.transactionType ?? "REPAYMENT",
      amount: input.amount,
      currency: input.currency,
      tellerId: input.tellerId ?? null,
      cashierId: input.cashierId ?? null,
      fineractAllocationId: input.fineractAllocationId ?? null,
      isCash: input.isCash,
      reversedAt: null,
      reversalNotes: null,
    },
  });
}

export async function getRepaymentCashLink(
  tenantId: string,
  fineractTransactionId: number
) {
  console.log(`[tenantId]: ${tenantId}`)
  console.log(`[fineractTransactionId]: ${fineractTransactionId}`)
  return prisma.repaymentCashLink.findUnique({
    where: {
      tenantId_fineractTransactionId: {
        tenantId,
        fineractTransactionId,
      },
    },
    include: {
      teller: {
        select: {
          id: true,
          name: true,
          fineractTellerId: true,
          officeName: true,
        },
      },
      cashier: {
        select: {
          id: true,
          staffName: true,
          fineractCashierId: true,
        },
      },
    },
  });
}

export async function markRepaymentCashLinkReversed(
  tenantId: string,
  fineractTransactionId: number,
  reversalNotes?: string | null
) {
  return prisma.repaymentCashLink.update({
    where: {
      tenantId_fineractTransactionId: {
        tenantId,
        fineractTransactionId,
      },
    },
    data: {
      reversedAt: new Date(),
      reversalNotes: reversalNotes ?? null,
    },
  });
}
