// Pure client-safe utilities for credit facility data.
// No server-only imports — safe to use in client components.

export interface CreditFacilityInfo {
  id: number;
  client_id: number;
  facility_ref: string;
  credit_limit: number;
  tenor_months: number;
  drawdown_tranches: number;
  currency_code: string;
  utilized_amount: number;
  disbursed_tranches: number;
  status: "PENDING" | "ACTIVE" | "CLOSED";
  created_date: string | number[];
}

export interface CreditFacilityLoanInfo {
  id: number;
  loan_id: number;
  facility_ref: string;
}

export interface CreateFacilityData {
  creditLimit: number;
  tenorMonths: number;
  drawdownTranches: number;
  currencyCode: string;
}

export function parseFineractDateField(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}
