export interface RcfDrawdownSummary {
  count: number;
  totalDisbursed: number;
  totalRepaid: number;
}

export interface RcfContractData {
  // Client information
  clientName: string;
  dateOfBirth: string;
  gender: string;
  mobileNo: string;
  nationalId: string;

  // Facility terms
  accountNo: string;
  creditLimit: number;
  availableBalance: number;
  utilizedAmount: number;
  tenorMonths: number | null;
  nominalInterestRate: number | null;
  maxDrawdowns: number;
  activationDate: string;

  // Drawdown activity
  drawdownSummary: RcfDrawdownSummary;

  // Meta
  branch: string;
  currency: string;
  currencySymbol: string;
  lenderName: string;
  fieldOfficerName?: string | null;
  executionDate: string;
  executionDay: string;
  executionMonth: string;
  executionYear: string;
}
