export interface RepaymentScheduleItem {
  paymentNumber: number;
  dueDate: string;
  paymentAmount: number;
  principal: number;
  interestAndFees: number;
  remainingBalance: number;
}

export interface ContractCharge {
  name: string;
  amount: number;
  chargeTimeType?: {
    id?: number;
    [key: string]: any;
  } | null;
}

export interface FamilyMember {
  firstname: string;
  lastname: string;
  middlename?: string | null;
  relationship?: string | null;
  dateOfBirth?: string | Date | null;
  mobileNo?: string | null;
  emailAddress?: string | null;
}

export interface ContractData {
  // Client Information
  clientName: string;
  nrc: string;
  dateOfBirth: string;
  gender: string;
  employeeNo?: string;
  employer?: string;
  gflNo?: string;
  loanId?: string;

  // Loan Information
  loanAmount: number;
  disbursedAmount: number;
  tenure: string;
  numberOfPayments: number;
  paymentFrequency: string;
  firstPaymentDate: string;

  // Financial Information
  interest: number;
  fees: number;
  totalCostOfCredit: number;
  totalRepayment: number;
  paymentPerPeriod: number;
  monthlyPercentageRate: number;

  // Schedule
  repaymentSchedule: RepaymentScheduleItem[];

  // Charges breakdown
  charges: ContractCharge[];

  // Other
  currency: string;
  branch: string;
  loanOfficer?: string;
  loanPurpose?: string;
  nominalInterestRate?: number;
  executionPlace?: string;
  executionDate?: string;
  executionDay?: string;
  executionMonth?: string;
  executionYear?: string;

  // Optional extra fields for tenant templates
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
  mobileNo?: string | null;
  countryCode?: string | null;
  accountNumber?: string | null;
  loanDate?: string | null;
  requestedAmount?: number | null;
  annualIncome?: number | null;
  monthlyIncome?: number | null;
  grossMonthlyIncome?: number | null;
  monthlyExpenses?: number | null;
  employmentStatus?: string | null;
  employerName?: string | null;
  yearsEmployed?: number | string | null;
  yearsAtCurrentJob?: string | null;
  businessType?: string | null;
  businessOwnership?: boolean | null;
  collateralType?: string | null;
  collateralValue?: number | null;
  bankName?: string | null;
  existingLoans?: number | null;
  hasExistingLoans?: boolean | null;
  nationality?: string | null;
  residentialAddress?: string | null;
  workAddress?: string | null;
  spouseName?: string | null;
  spousePhone?: string | null;
  closestRelativeName?: string | null;
  closestRelativePhone?: string | null;
  closestRelativeRelationship?: string | null;
  referees?: Array<{ name?: string; phone?: string }> | null;
  familyMembers?: FamilyMember[] | null;
  stateContext?: Record<string, any> | null;
  stateMetadata?: Record<string, any> | null;
}
