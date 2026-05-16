import { fetchFineractAPI } from "./api";

export interface CreateSavingsAccountParams {
  clientId: number;
  productId: number;
  submittedOnDate: string;
  locale?: string;
  dateFormat?: string;
}

export interface SavingsAccountBalance {
  id: number;
  accountNo: string;
  status: { id: number; code: string; value: string };
  accountBalance: number;
  availableBalance: number;
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
    locale = "en",
    dateFormat = "dd MMMM yyyy",
  } = params;
  const result = await fetchFineractAPI("/savingsaccounts", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      productId,
      submittedOnDate,
      locale,
      dateFormat,
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

export async function depositToSavingsAccount(
  savingsId: number,
  amount: number,
  transactionDate: string,
  note?: string
): Promise<{ transactionId: string }> {
  const result = await fetchFineractAPI(
    `/savingsaccounts/${savingsId}/transactions?command=deposit`,
    {
      method: "POST",
      body: JSON.stringify({
        transactionDate,
        transactionAmount: amount,
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
  note?: string
): Promise<{ transactionId: string }> {
  const result = await fetchFineractAPI(
    `/savingsaccounts/${savingsId}/transactions?command=withdrawal`,
    {
      method: "POST",
      body: JSON.stringify({
        transactionDate,
        transactionAmount: amount,
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
  };
}
