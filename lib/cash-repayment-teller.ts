/**
 * Records a cash loan repayment to the teller/cashier balance.
 * Called after a successful Fineract repayment when payment type is cash.
 * Uses Fineract allocateCashToCashier to increase the cashier's till.
 */
import { fetchFineractAPI } from "@/lib/api";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import prisma from "@/lib/prisma";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";

/** Format YYYY-MM-DD to "dd MMMM yyyy" for Fineract */
function formatDateForFineract(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Check if the given payment type ID corresponds to a cash payment.
 */
export async function isPaymentTypeCash(paymentTypeId: number): Promise<boolean> {
  try {
    const paymentTypes = await fetchFineractAPI("/paymenttypes");
    const list = Array.isArray(paymentTypes) ? paymentTypes : paymentTypes?.pageItems ?? [];
    const found = list.find((pt: any) => pt.id === paymentTypeId);
    return !!found?.isCashPayment;
  } catch (err) {
    console.error("Error checking payment type:", err);
    return false;
  }
}

export interface RecordCashRepaymentOptions {
  loanId: number;
  amount: number;
  currency?: string;
  transactionDate: string; // ISO format YYYY-MM-DD
  tenantId: string;
  paymentTypeId?: number;
  cashierId?: number; // Optional: Fineract cashier ID from frontend
  tellerId?: number; // Optional: Fineract teller ID from frontend
}

/**
 * Record a cash repayment to the teller/cashier balance.
 * Resolves loan office → teller → cashier, then calls Fineract allocateCashToCashier.
 * Does not throw - logs errors and returns success/failure.
 */
export async function recordCashRepaymentToTeller(
  options: RecordCashRepaymentOptions
): Promise<{ success: boolean; error?: string }> {
  const {
    loanId,
    amount,
    currency,
    transactionDate,
    tenantId,
    paymentTypeId,
    cashierId: providedCashierId,
    tellerId: providedTellerId,
  } = options;

  try {
    // If paymentTypeId provided, verify it's cash
    if (paymentTypeId != null) {
      const isCash = await isPaymentTypeCash(paymentTypeId);
      if (!isCash) {
        return { success: true }; // Not cash - nothing to do, not an error
      }
    } else {
      // No payment type - skip (conservative)
      return { success: true };
    }

    if (amount <= 0) {
      return { success: true };
    }

    const fineractService = await getFineractServiceWithSession();

    // Resolve loan and office
    const loan = await fineractService.getLoan(loanId);
    if (!loan) {
      console.warn(`[CashRepayment] Loan ${loanId} not found`);
      return { success: false, error: "Loan not found" };
    }

    const officeId = loan.clientOfficeId ?? (loan as any).officeId;
    if (officeId == null) {
      console.warn(`[CashRepayment] Loan ${loanId} has no office`);
      return { success: false, error: "Loan has no office" };
    }

    const orgCurrency = await getOrgDefaultCurrencyCode();
    const loanCurrency = loan.currency?.code ?? currency ?? orgCurrency;
    const normalizedCurrency =
      loanCurrency?.toUpperCase() === "ZMK" ? "ZMW" : loanCurrency;

    let fineractTellerId: number;
    let fineractCashierId: number;

    if (providedTellerId != null && providedCashierId != null) {
      fineractTellerId = providedTellerId;
      fineractCashierId = providedCashierId;
    } else {
      // Resolve teller from office
      const dbTeller = await prisma.teller.findFirst({
        where: {
          tenantId,
          officeId,
          isActive: true,
          fineractTellerId: { not: null },
        },
      });

      if (!dbTeller?.fineractTellerId) {
        console.warn(
          `[CashRepayment] No teller found for office ${officeId}, tenant ${tenantId}`
        );
        return { success: false, error: "No teller for office" };
      }

      fineractTellerId = dbTeller.fineractTellerId;

      // Resolve cashier - first active from Fineract
      const cashiers = await fineractService.getCashiers(fineractTellerId);
      const activeCashier = cashiers.find(
        (c: any) => c.isRunning || c.tellerId
      );
      const fc = activeCashier ?? cashiers[0];

      if (!fc?.id) {
        console.warn(
          `[CashRepayment] No cashier found for teller ${fineractTellerId}`
        );
        return { success: false, error: "No cashier for teller" };
      }

      fineractCashierId =
        typeof fc.id === "number" ? fc.id : parseInt(String(fc.id), 10);
    }

    const txnDate = formatDateForFineract(transactionDate);
    const txnAmount = String(amount);

    await fineractService.allocateCashToCashier(
      fineractTellerId,
      fineractCashierId,
      {
        txnDate,
        currencyCode: normalizedCurrency,
        txnAmount,
        txnNote: `Loan repayment #${loanId}`,
      }
    );

    // Optional: create local CashAllocation for audit/fallback
    const dbCashier = await prisma.cashier.findFirst({
      where: {
        tenantId,
        fineractCashierId,
      },
    });
    const dbTellerForAlloc = await prisma.teller.findFirst({
      where: { tenantId, fineractTellerId },
    });
    if (dbCashier && dbTellerForAlloc) {
      await prisma.cashAllocation.create({
        data: {
          tenantId,
          tellerId: dbTellerForAlloc.id,
          cashierId: dbCashier.id,
          amount,
          currency: normalizedCurrency,
          allocatedBy: "system",
          notes: `Loan repayment #${loanId}`,
          status: "ACTIVE",
        },
      });
    }

    console.log(
      `[CashRepayment] Recorded ${amount} ${normalizedCurrency} for loan ${loanId} to cashier ${fineractCashierId}`
    );
    return { success: true };
  } catch (err: any) {
    console.error("[CashRepayment] Error recording cash repayment:", err);
    return {
      success: false,
      error: err?.message ?? "Unknown error",
    };
  }
}
