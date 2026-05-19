import { fetchFineractAPI } from "./api";

export interface CreateSavingsAccountParams {
  clientId: number;
  productId: number;
  submittedOnDate: string;
  fieldOfficerId?: number;
  locale?: string;
  dateFormat?: string;
  // Extended fields — required for RCF savings accounts
  nominalAnnualInterestRate?: number;
  interestCompoundingPeriodType?: number;
  interestPostingPeriodType?: number;
  interestCalculationType?: number;
  interestCalculationDaysInYearType?: number;
  withdrawalFeeForTransfers?: boolean;
  allowOverdraft?: boolean;
  enforceMinRequiredBalance?: boolean;
  nominalAnnualInterestRateOverdraft?: number;
  overdraftLimit?: number;
  charges?: any[];
}

export interface SavingsAccountBalance {
  id: number;
  accountNo: string;
  status: { id: number; code: string; value: string };
  accountBalance: number;
  availableBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
}

export function formatFineractDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export async function createSavingsAccount(
  params: CreateSavingsAccountParams
): Promise<{ savingsId: number; resourceId: number }> {
  const {
    clientId,
    productId,
    submittedOnDate,
    fieldOfficerId,
    locale = "en",
    dateFormat = "dd MMMM yyyy",
    nominalAnnualInterestRate,
    interestCompoundingPeriodType,
    interestPostingPeriodType,
    interestCalculationType,
    interestCalculationDaysInYearType,
    withdrawalFeeForTransfers,
    allowOverdraft,
    enforceMinRequiredBalance,
    nominalAnnualInterestRateOverdraft,
    overdraftLimit,
    charges,
  } = params;
  const result = await fetchFineractAPI("/savingsaccounts", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      productId,
      submittedOnDate,
      locale,
      dateFormat,
      ...(fieldOfficerId ? { fieldOfficerId } : {}),
      ...(nominalAnnualInterestRate !== undefined ? { nominalAnnualInterestRate } : {}),
      ...(interestCompoundingPeriodType !== undefined ? { interestCompoundingPeriodType } : {}),
      ...(interestPostingPeriodType !== undefined ? { interestPostingPeriodType } : {}),
      ...(interestCalculationType !== undefined ? { interestCalculationType } : {}),
      ...(interestCalculationDaysInYearType !== undefined ? { interestCalculationDaysInYearType } : {}),
      ...(withdrawalFeeForTransfers !== undefined ? { withdrawalFeeForTransfers } : {}),
      ...(allowOverdraft !== undefined ? { allowOverdraft } : {}),
      ...(enforceMinRequiredBalance !== undefined ? { enforceMinRequiredBalance } : {}),
      ...(nominalAnnualInterestRateOverdraft !== undefined ? { nominalAnnualInterestRateOverdraft } : {}),
      ...(overdraftLimit !== undefined ? { overdraftLimit } : {}),
      ...(charges !== undefined ? { charges } : {}),
    }),
  });
  return { savingsId: result.savingsId, resourceId: result.resourceId };
}

export async function approveSavingsAccount(
  savingsId: number,
  approvedOnDate: string
): Promise<void> {
  await fetchFineractAPI(`/savingsaccounts/${savingsId}?command=approve`, {
    method: "POST",
    body: JSON.stringify({
      approvedOnDate,
      locale: "en",
      dateFormat: "dd MMMM yyyy",
    }),
  });
}

export async function activateSavingsAccount(
  savingsId: number,
  activatedOnDate: string
): Promise<void> {
  await fetchFineractAPI(`/savingsaccounts/${savingsId}?command=activate`, {
    method: "POST",
    body: JSON.stringify({
      activatedOnDate,
      locale: "en",
      dateFormat: "dd MMMM yyyy",
    }),
  });
}

export async function getDefaultPaymentTypeId(): Promise<number> {
  try {
    const types = await fetchFineractAPI("/paymenttypes");
    const list: any[] = Array.isArray(types) ? types : (types?.pageItems ?? []);
    // Prefer cash payment type, fall back to first available
    const cash = list.find((t: any) => String(t.name).toLowerCase().includes("cash"));
    const first = list[0];
    const chosen = cash ?? first;
    if (chosen?.id) return Number(chosen.id);
  } catch {
    // ignore — caller will handle
  }
  return 1; // Fineract default cash payment type
}

export async function depositToSavingsAccount(
  savingsId: number,
  amount: number,
  transactionDate: string,
  note?: string,
  paymentTypeId?: number
): Promise<{ transactionId: string }> {
  const result = await fetchFineractAPI(
    `/savingsaccounts/${savingsId}/transactions?command=deposit`,
    {
      method: "POST",
      body: JSON.stringify({
        transactionDate,
        transactionAmount: amount,
        paymentTypeId: paymentTypeId ?? 1,
        locale: "en",
        dateFormat: "dd MMMM yyyy",
        ...(note ? { note } : {}),
      }),
    }
  );
  return { transactionId: String(result.resourceId) };
}

export async function withdrawFromSavingsAccount(
  savingsId: number,
  amount: number,
  transactionDate: string,
  note?: string,
  paymentTypeId?: number
): Promise<{ transactionId: string }> {
  const result = await fetchFineractAPI(
    `/savingsaccounts/${savingsId}/transactions?command=withdrawal`,
    {
      method: "POST",
      body: JSON.stringify({
        transactionDate,
        transactionAmount: amount,
        paymentTypeId: paymentTypeId ?? 1,
        locale: "en",
        dateFormat: "dd MMMM yyyy",
        ...(note ? { note } : {}),
      }),
    }
  );
  return { transactionId: String(result.resourceId) };
}

export async function getSavingsAccountBalance(
  savingsId: number
): Promise<SavingsAccountBalance> {
  const result = await fetchFineractAPI(`/savingsaccounts/${savingsId}`);
  return {
    id: result.id,
    accountNo: result.accountNo,
    status: result.status,
    accountBalance: result.summary?.accountBalance ?? 0,
    availableBalance: result.summary?.availableBalance ?? 0,
    totalDeposits: result.summary?.totalDeposits ?? 0,
    totalWithdrawals: result.summary?.totalWithdrawals ?? 0,
  };
}
