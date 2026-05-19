"use server";

import { fetchFineractAPI } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  createSavingsAccount,
  formatFineractDate,
} from "@/lib/fineract-savings-service";

export interface SavingsProductTemplate {
  nominalAnnualInterestRate: number;
  nominalAnnualInterestRateOverdraft: number;
  interestCompoundingPeriodType: { id: number; value: string };
  interestPostingPeriodType: { id: number; value: string };
  interestCalculationType: { id: number; value: string };
  interestCalculationDaysInYearType: { id: number; value: string };
  allowOverdraft: boolean;
  overdraftLimit: number;
  enforceMinRequiredBalance: boolean;
  withdrawalFeeForTransfers: boolean;
  currency: { code: string; name: string; displaySymbol: string };
  fieldOfficerOptions: { id: number; displayName: string }[];
  charges: any[];
}

export async function submitRcfApplication(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      fineractClientId: true,
      savingsProductId: true,
      requestedAmount: true,
      tenantId: true,
      fineractSavingsAccountId: true,
      loanSubmittedToFineract: true,
      stateMetadata: true,
    },
  });

  if (!lead) return { success: false, error: "Lead not found" };
  if (!lead.fineractClientId) return { success: false, error: "Client not yet registered in Fineract" };
  if (!lead.savingsProductId) return { success: false, error: "No savings product selected — complete facility terms first" };

  const creditLimit = lead.requestedAmount;
  if (!creditLimit || creditLimit <= 0) return { success: false, error: "Credit limit must be greater than 0 — complete facility terms first" };

  // Skip if already submitted
  if (lead.fineractSavingsAccountId && lead.loanSubmittedToFineract) {
    return { success: true };
  }

  const meta = (lead.stateMetadata as Record<string, any>) || {};

  // Fetch template to get required interest/compounding fields
  let template: SavingsProductTemplate | null = null;
  try {
    template = await getSavingsProductTemplate(lead.fineractClientId, lead.savingsProductId);
  } catch {
    // proceed with defaults if template fetch fails
  }

  const today = formatFineractDate(new Date());

  const { savingsId } = await createSavingsAccount({
    clientId: lead.fineractClientId,
    productId: lead.savingsProductId,
    submittedOnDate: today,
    nominalAnnualInterestRate: template?.nominalAnnualInterestRate ?? 0,
    interestCompoundingPeriodType: template?.interestCompoundingPeriodType.id ?? 4,
    interestPostingPeriodType: template?.interestPostingPeriodType.id ?? 4,
    interestCalculationType: template?.interestCalculationType.id ?? 2,
    interestCalculationDaysInYearType: template?.interestCalculationDaysInYearType.id ?? 365,
    withdrawalFeeForTransfers: template?.withdrawalFeeForTransfers ?? false,
    allowOverdraft: template?.allowOverdraft ?? true,
    enforceMinRequiredBalance: template?.enforceMinRequiredBalance ?? false,
    nominalAnnualInterestRateOverdraft: meta.nominalInterestRate ?? template?.nominalAnnualInterestRateOverdraft ?? 0,
    overdraftLimit: creditLimit,
    charges: template?.charges ?? [],
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      fineractSavingsAccountId: savingsId,
      loanSubmittedToFineract: true,
    },
  });

  return { success: true };
}

export async function getSavingsProductTemplate(
  clientId: number,
  productId: number
): Promise<SavingsProductTemplate> {
  const data = await fetchFineractAPI(
    `/savingsaccounts/template?clientId=${clientId}&productId=${productId}`
  );
  return {
    nominalAnnualInterestRate: data.nominalAnnualInterestRate ?? 0,
    nominalAnnualInterestRateOverdraft: data.nominalAnnualInterestRateOverdraft ?? 0,
    interestCompoundingPeriodType: data.interestCompoundingPeriodType ?? { id: 4, value: "Monthly" },
    interestPostingPeriodType: data.interestPostingPeriodType ?? { id: 4, value: "Monthly" },
    interestCalculationType: data.interestCalculationType ?? { id: 2, value: "Average Daily Balance" },
    interestCalculationDaysInYearType: data.interestCalculationDaysInYearType ?? { id: 365, value: "365 Days" },
    allowOverdraft: data.allowOverdraft ?? false,
    overdraftLimit: data.overdraftLimit ?? 0,
    enforceMinRequiredBalance: data.enforceMinRequiredBalance ?? false,
    withdrawalFeeForTransfers: data.withdrawalFeeForTransfers ?? false,
    currency: data.currency ?? { code: "USD", name: "US Dollar", displaySymbol: "$" },
    fieldOfficerOptions: data.fieldOfficerOptions ?? [],
    charges: data.charges ?? [],
  };
}
