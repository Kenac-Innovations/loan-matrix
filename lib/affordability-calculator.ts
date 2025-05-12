// Affordability calculator utility functions

// Calculate maximum affordable loan amount based on income and expenditure
export function calculateMaxLoanAmount(
  monthlyIncome: number,
  monthlyExpenditure: number,
  interestRate = 0.07, // 7% default interest rate
  loanTermYears = 5, // 5 years default term
  debtToIncomeRatio = 0.36 // 36% maximum DTI ratio
): number {
  // Ensure inputs are numbers
  const numMonthlyIncome = Number(monthlyIncome) || 0;
  const numMonthlyExpenditure = Number(monthlyExpenditure) || 0;

  // Calculate disposable income
  const disposableIncome = numMonthlyIncome - numMonthlyExpenditure;

  // Calculate maximum monthly payment based on DTI ratio
  const maxMonthlyPaymentByDTI =
    numMonthlyIncome * debtToIncomeRatio - numMonthlyExpenditure;

  // Use the higher of disposable income or DTI-based max payment (with a buffer)
  // This is more lenient to ensure offers are generated
  const maxMonthlyPayment = Math.max(
    disposableIncome * 0.7,
    maxMonthlyPaymentByDTI
  );

  // If max monthly payment is negative or too small, use a minimum value
  // This ensures some offers are always generated for demonstration purposes
  if (maxMonthlyPayment < 100) {
    return 50000; // Minimum loan amount for demonstration
  }

  // Calculate maximum loan amount based on monthly payment
  const monthlyInterestRate = interestRate / 12;
  const totalPayments = loanTermYears * 12;

  // Present value formula: PV = PMT * ((1 - (1 + r)^-n) / r)
  // Handle edge case where interest rate is 0
  let maxLoanAmount;
  if (monthlyInterestRate === 0) {
    maxLoanAmount = maxMonthlyPayment * totalPayments;
  } else {
    maxLoanAmount =
      maxMonthlyPayment *
      ((1 - Math.pow(1 + monthlyInterestRate, -totalPayments)) /
        monthlyInterestRate);
  }

  // Round down to nearest 1000
  return Math.floor(maxLoanAmount / 1000) * 1000;
}

// Calculate monthly payment for a loan
export function calculateMonthlyPayment(
  loanAmount: number,
  interestRate: number,
  loanTermYears: number
): number {
  const monthlyInterestRate = interestRate / 12;
  const totalPayments = loanTermYears * 12;

  // Monthly payment formula: PMT = PV * r * (1 + r)^n / ((1 + r)^n - 1)
  const monthlyPayment =
    (loanAmount *
      monthlyInterestRate *
      Math.pow(1 + monthlyInterestRate, totalPayments)) /
    (Math.pow(1 + monthlyInterestRate, totalPayments) - 1);

  return Math.round(monthlyPayment * 100) / 100;
}

// Generate loan offers based on affordability
export function generateLoanOffers(
  maxLoanAmount: number,
  requestedAmount: number,
  creditScore: number
): LoanOffer[] {
  // Always generate at least some offers for demonstration purposes
  if (maxLoanAmount <= 0) {
    maxLoanAmount = 50000; // Minimum loan amount for demonstration
  }

  const offers: LoanOffer[] = [];
  // Use the requested amount, but cap it at the maximum affordable amount
  // Ensure a minimum loan amount of 10000 for demonstration
  const loanAmount = Math.max(
    10000,
    Math.min(maxLoanAmount, requestedAmount || 50000)
  );

  // Base interest rate adjusted by credit score
  let baseRate = 0.07; // 7% base rate

  // Adjust rate based on credit score
  if (creditScore >= 800) {
    baseRate -= 0.02; // Excellent credit: -2%
  } else if (creditScore >= 740) {
    baseRate -= 0.015; // Very good credit: -1.5%
  } else if (creditScore >= 670) {
    baseRate -= 0.005; // Good credit: -0.5%
  } else if (creditScore < 580) {
    baseRate += 0.03; // Poor credit: +3%
  } else if (creditScore < 670) {
    baseRate += 0.01; // Fair credit: +1%
  }

  // Generate offers with different terms
  const terms = [3, 5, 7, 10];

  terms.forEach((term) => {
    // Adjust rate based on term
    let termAdjustedRate = baseRate;
    if (term <= 3) {
      termAdjustedRate -= 0.005; // Short term discount
    } else if (term >= 7) {
      termAdjustedRate += 0.01; // Long term premium
    }

    const monthlyPayment = calculateMonthlyPayment(
      loanAmount,
      termAdjustedRate,
      term
    );

    offers.push({
      loanAmount,
      interestRate: termAdjustedRate,
      termYears: term,
      monthlyPayment,
      totalRepayment: monthlyPayment * term * 12,
      productName: `${term}-Year ${
        loanAmount >= 100000 ? "Premium" : "Standard"
      } Loan`,
      productCode: `LOAN-${term}Y-${loanAmount >= 100000 ? "PREM" : "STD"}`,
    });
  });

  return offers;
}

// Types
export interface LoanOffer {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  monthlyPayment: number;
  totalRepayment: number;
  productName: string;
  productCode: string;
}

// DTI Model Configuration
export interface DtiModelConfig {
  maxDtiRatio: number;
  warningDtiRatio: number;
  includeMortgage: boolean;
  includeExistingLoans: boolean;
  includeProposedLoan: boolean;
  includeMinimumCreditCardPayments: boolean;
  includeAutoLoans?: boolean;
  includeStudentLoans?: boolean;
}

// Net Disposable Income Model Configuration
export interface DisposableIncomeModelConfig {
  minDisposableIncome: number;
  disposableIncomePercentage: number;
  includeBasicNeeds: boolean;
  includeTransportation: boolean;
  includeUtilities: boolean;
  includeEducation?: boolean;
  includeHealthcare?: boolean;
}

// Employer-Based Model Configuration
export interface EmployerBasedModelConfig {
  governmentMultiplier: number;
  corporateMultiplier: number;
  smeMultiplier: number;
  startupMultiplier?: number;
  selfEmployedMultiplier: number;
  maxTermYears: number;
  minEmploymentYears: number;
}

// Expenditure Estimation Model Configuration
export interface ExpenditureEstimationModelConfig {
  estimationMethod: string;
  lowerIncomePercentage: number;
  middleIncomePercentage: number;
  upperIncomePercentage: number;
  lowerIncomeThreshold: number;
  upperIncomeThreshold: number;
  urbanAdjustmentFactor: number;
  ruralAdjustmentFactor: number;
}

// Unified affordability model
export interface AffordabilityModel {
  id: string;
  name: string;
  description: string;
  type: "dti" | "disposableIncome" | "employerBased" | "expenditureEstimation";
  isActive: boolean;
  isDefault: boolean;
  config:
    | DtiModelConfig
    | DisposableIncomeModelConfig
    | EmployerBasedModelConfig
    | ExpenditureEstimationModelConfig;
}

// Extended IncomeDetails
export interface IncomeDetails {
  primaryIncome: number;
  secondaryIncome: number;
  otherIncome: number;
  employerType?:
    | "government"
    | "corporate"
    | "sme"
    | "startup"
    | "selfEmployed";
  yearsEmployed?: number;
}

// Extended ExpenditureDetails
export interface ExpenditureDetails {
  housingCost: number;
  utilitiesCost: number;
  loanRepayments: number;
  otherExpenses: number;
  basicNeeds?: number;
  transportation?: number;
  education?: number;
  healthcare?: number;
  location?: "urban" | "rural" | "suburban";
}

export interface AffordabilityResult {
  totalMonthlyIncome: number;
  totalMonthlyExpenditure: number;
  disposableIncome: number;
  maxLoanAmount: number;
  debtToIncomeRatio: number;
  offers: LoanOffer[];
}

// Calculate full affordability and generate offers
export function calculateAffordability(
  income: IncomeDetails,
  expenditure: ExpenditureDetails,
  requestedAmount: number,
  creditScore: number
): AffordabilityResult {
  // Ensure all values are numbers
  const totalMonthlyIncome =
    Number(income.primaryIncome) +
    Number(income.secondaryIncome) +
    Number(income.otherIncome);
  const totalMonthlyExpenditure =
    Number(expenditure.housingCost) +
    Number(expenditure.utilitiesCost) +
    Number(expenditure.loanRepayments) +
    Number(expenditure.otherExpenses);

  const disposableIncome = totalMonthlyIncome - totalMonthlyExpenditure;

  // Calculate debt-to-income ratio (prevent division by zero)
  const debtToIncomeRatio =
    totalMonthlyIncome > 0
      ? (Number(expenditure.loanRepayments) + Number(expenditure.housingCost)) /
        totalMonthlyIncome
      : 1;

  // Calculate max loan amount
  const maxLoanAmount = calculateMaxLoanAmount(
    totalMonthlyIncome,
    totalMonthlyExpenditure,
    0.07, // Default interest rate
    5, // Default term
    0.36 // Default max DTI
  );

  // Ensure requested amount is a number
  const numRequestedAmount = Number(requestedAmount) || 0;

  // Ensure credit score is a number
  const numCreditScore = Number(creditScore) || 650;

  // Generate offers
  const offers = generateLoanOffers(
    maxLoanAmount,
    numRequestedAmount,
    numCreditScore
  );

  console.log("Affordability calculation:", {
    totalMonthlyIncome,
    totalMonthlyExpenditure,
    disposableIncome,
    debtToIncomeRatio,
    maxLoanAmount,
    requestedAmount: numRequestedAmount,
    creditScore: numCreditScore,
    offersGenerated: offers.length,
  });

  console.log("Generated offers:", {
    totalMonthlyIncome,
    totalMonthlyExpenditure,
    disposableIncome,
    debtToIncomeRatio,
    maxLoanAmount,
    requestedAmount: numRequestedAmount,
    creditScore: numCreditScore,
    offersGenerated: offers.length,
    offers: offers.map((o) => ({
      amount: o.loanAmount,
      term: o.termYears,
      rate: o.interestRate,
      payment: o.monthlyPayment,
    })),
  });

  return {
    totalMonthlyIncome,
    totalMonthlyExpenditure,
    disposableIncome,
    maxLoanAmount,
    debtToIncomeRatio,
    offers,
  };
}

// Calculate affordability using DTI model
export function calculateDtiAffordability(
  income: IncomeDetails,
  expenditure: ExpenditureDetails,
  config: DtiModelConfig,
  interestRate = 0.07,
  loanTermYears = 5
): { maxLoanAmount: number; dtiRatio: number; monthlyDebt: number } {
  // Calculate total monthly income
  const totalMonthlyIncome =
    Number(income.primaryIncome) +
    Number(income.secondaryIncome) +
    Number(income.otherIncome);

  // Calculate existing monthly debt
  let totalMonthlyDebt = 0;

  if (config.includeMortgage) {
    totalMonthlyDebt += Number(expenditure.housingCost);
  }

  if (config.includeExistingLoans) {
    totalMonthlyDebt += Number(expenditure.loanRepayments);
  }

  // Current DTI ratio (without proposed loan)
  const currentDtiRatio = totalMonthlyDebt / totalMonthlyIncome;

  // Calculate maximum additional debt allowed
  const maxAdditionalDebt =
    config.maxDtiRatio * totalMonthlyIncome - totalMonthlyDebt;

  // If max additional debt is negative, no loan can be offered
  if (maxAdditionalDebt <= 0) {
    return {
      maxLoanAmount: 0,
      dtiRatio: currentDtiRatio,
      monthlyDebt: totalMonthlyDebt,
    };
  }

  // Calculate maximum loan amount based on the additional debt capacity
  const monthlyInterestRate = interestRate / 12;
  const totalPayments = loanTermYears * 12;

  // Present value formula: PV = PMT * ((1 - (1 + r)^-n) / r)
  let maxLoanAmount;
  if (monthlyInterestRate === 0) {
    maxLoanAmount = maxAdditionalDebt * totalPayments;
  } else {
    maxLoanAmount =
      maxAdditionalDebt *
      ((1 - Math.pow(1 + monthlyInterestRate, -totalPayments)) /
        monthlyInterestRate);
  }

  // Round down to nearest 1000
  maxLoanAmount = Math.floor(maxLoanAmount / 1000) * 1000;

  // Calculate new total monthly debt and DTI ratio if loan is taken
  const proposedLoanPayment = calculateMonthlyPayment(
    maxLoanAmount,
    interestRate,
    loanTermYears
  );
  const newTotalMonthlyDebt = totalMonthlyDebt + proposedLoanPayment;
  const newDtiRatio = newTotalMonthlyDebt / totalMonthlyIncome;

  return {
    maxLoanAmount,
    dtiRatio: newDtiRatio,
    monthlyDebt: newTotalMonthlyDebt,
  };
}

// Calculate affordability using Net Disposable Income model
export function calculateDisposableIncomeAffordability(
  income: IncomeDetails,
  expenditure: ExpenditureDetails,
  config: DisposableIncomeModelConfig,
  interestRate = 0.07,
  loanTermYears = 5
): {
  maxLoanAmount: number;
  disposableIncome: number;
  requiredDisposableIncome: number;
} {
  // Calculate total monthly income
  const totalMonthlyIncome =
    Number(income.primaryIncome) +
    Number(income.secondaryIncome) +
    Number(income.otherIncome);

  // Calculate total monthly expenditure
  let totalMonthlyExpenditure =
    Number(expenditure.housingCost) +
    Number(expenditure.loanRepayments) +
    Number(expenditure.otherExpenses);

  // Add specific expenses if included in the model
  if (config.includeBasicNeeds && expenditure.basicNeeds) {
    totalMonthlyExpenditure += Number(expenditure.basicNeeds);
  }

  if (config.includeTransportation && expenditure.transportation) {
    totalMonthlyExpenditure += Number(expenditure.transportation);
  }

  if (config.includeUtilities) {
    totalMonthlyExpenditure += Number(expenditure.utilitiesCost);
  }

  if (config.includeEducation && expenditure.education) {
    totalMonthlyExpenditure += Number(expenditure.education);
  }

  if (config.includeHealthcare && expenditure.healthcare) {
    totalMonthlyExpenditure += Number(expenditure.healthcare);
  }

  // Calculate current disposable income
  const currentDisposableIncome = totalMonthlyIncome - totalMonthlyExpenditure;

  // Calculate required disposable income (both fixed amount and percentage of income)
  const requiredDisposableIncome = Math.max(
    config.minDisposableIncome,
    totalMonthlyIncome * config.disposableIncomePercentage
  );

  // Calculate maximum available for loan repayment
  const maxAvailableForLoan =
    currentDisposableIncome - requiredDisposableIncome;

  // If no money is available for loan, return 0
  if (maxAvailableForLoan <= 0) {
    return {
      maxLoanAmount: 0,
      disposableIncome: currentDisposableIncome,
      requiredDisposableIncome,
    };
  }

  // Calculate maximum loan amount
  const monthlyInterestRate = interestRate / 12;
  const totalPayments = loanTermYears * 12;

  // Present value formula: PV = PMT * ((1 - (1 + r)^-n) / r)
  let maxLoanAmount;
  if (monthlyInterestRate === 0) {
    maxLoanAmount = maxAvailableForLoan * totalPayments;
  } else {
    maxLoanAmount =
      maxAvailableForLoan *
      ((1 - Math.pow(1 + monthlyInterestRate, -totalPayments)) /
        monthlyInterestRate);
  }

  // Round down to nearest 1000
  maxLoanAmount = Math.floor(maxLoanAmount / 1000) * 1000;

  return {
    maxLoanAmount,
    disposableIncome: currentDisposableIncome,
    requiredDisposableIncome,
  };
}

// Calculate affordability using Employer-Based model
export function calculateEmployerBasedAffordability(
  income: IncomeDetails,
  config: EmployerBasedModelConfig
): { maxLoanAmount: number; salaryMultiplier: number } {
  // Calculate annual income
  const annualIncome =
    (Number(income.primaryIncome) + Number(income.secondaryIncome)) * 12;

  // Determine appropriate multiplier based on employer type
  let salaryMultiplier = config.selfEmployedMultiplier; // Default to self-employed

  if (income.employerType) {
    switch (income.employerType) {
      case "government":
        salaryMultiplier = config.governmentMultiplier;
        break;
      case "corporate":
        salaryMultiplier = config.corporateMultiplier;
        break;
      case "sme":
        salaryMultiplier = config.smeMultiplier;
        break;
      case "startup":
        salaryMultiplier = config.startupMultiplier || config.smeMultiplier;
        break;
      case "selfEmployed":
        salaryMultiplier = config.selfEmployedMultiplier;
        break;
    }
  }

  // Adjust multiplier based on employment duration
  if (
    income.yearsEmployed &&
    income.yearsEmployed < config.minEmploymentYears
  ) {
    // Reduce multiplier for short employment duration
    salaryMultiplier = Math.max(salaryMultiplier * 0.7, 1.5);
  }

  // Calculate maximum loan amount
  let maxLoanAmount = annualIncome * salaryMultiplier;

  // Round down to nearest 1000
  maxLoanAmount = Math.floor(maxLoanAmount / 1000) * 1000;

  return {
    maxLoanAmount,
    salaryMultiplier,
  };
}

// Calculate affordability using Expenditure Estimation model
export function calculateExpenditureEstimationAffordability(
  income: IncomeDetails,
  expenditure: ExpenditureDetails,
  config: ExpenditureEstimationModelConfig,
  interestRate = 0.07,
  loanTermYears = 5
): {
  maxLoanAmount: number;
  estimatedExpenditure: number;
  expenditurePercentage: number;
  incomeBracket: string;
  locationFactor: number;
} {
  // Calculate monthly income
  const totalMonthlyIncome =
    Number(income.primaryIncome) +
    Number(income.secondaryIncome) +
    Number(income.otherIncome);

  // Determine income bracket
  let expenditurePercentage = config.middleIncomePercentage; // Default to middle income
  let incomeBracket = "middle";

  if (totalMonthlyIncome <= config.lowerIncomeThreshold) {
    expenditurePercentage = config.lowerIncomePercentage;
    incomeBracket = "lower";
  } else if (totalMonthlyIncome >= config.upperIncomeThreshold) {
    expenditurePercentage = config.upperIncomePercentage;
    incomeBracket = "upper";
  }

  // Apply location adjustment if available
  let locationFactor = 1.0; // Default - no adjustment
  if (expenditure.location) {
    switch (expenditure.location) {
      case "urban":
        locationFactor = config.urbanAdjustmentFactor;
        break;
      case "rural":
        locationFactor = config.ruralAdjustmentFactor;
        break;
      case "suburban":
        // Average of urban and rural
        locationFactor =
          (config.urbanAdjustmentFactor + config.ruralAdjustmentFactor) / 2;
        break;
    }
  }

  // Calculate estimated expenditure
  const estimatedExpenditure =
    totalMonthlyIncome * expenditurePercentage * locationFactor;

  // Calculate available income for loan
  const availableForLoan = totalMonthlyIncome - estimatedExpenditure;

  // If no money available for loan, return 0
  if (availableForLoan <= 0) {
    return {
      maxLoanAmount: 0,
      estimatedExpenditure,
      expenditurePercentage,
      incomeBracket,
      locationFactor,
    };
  }

  // Calculate maximum loan amount
  const monthlyInterestRate = interestRate / 12;
  const totalPayments = loanTermYears * 12;

  // Present value formula: PV = PMT * ((1 - (1 + r)^-n) / r)
  let maxLoanAmount;
  if (monthlyInterestRate === 0) {
    maxLoanAmount = availableForLoan * totalPayments;
  } else {
    maxLoanAmount =
      availableForLoan *
      ((1 - Math.pow(1 + monthlyInterestRate, -totalPayments)) /
        monthlyInterestRate);
  }

  // Round down to nearest 1000
  maxLoanAmount = Math.floor(maxLoanAmount / 1000) * 1000;

  return {
    maxLoanAmount,
    estimatedExpenditure,
    expenditurePercentage,
    incomeBracket,
    locationFactor,
  };
}

// Calculate affordability using the specified model type
export function calculateModelAffordability(
  income: IncomeDetails,
  expenditure: ExpenditureDetails,
  model: AffordabilityModel,
  interestRate = 0.07,
  loanTermYears = 5
): any {
  switch (model.type) {
    case "dti":
      return calculateDtiAffordability(
        income,
        expenditure,
        model.config as DtiModelConfig,
        interestRate,
        loanTermYears
      );

    case "disposableIncome":
      return calculateDisposableIncomeAffordability(
        income,
        expenditure,
        model.config as DisposableIncomeModelConfig,
        interestRate,
        loanTermYears
      );

    case "employerBased":
      return calculateEmployerBasedAffordability(
        income,
        model.config as EmployerBasedModelConfig
      );

    case "expenditureEstimation":
      return calculateExpenditureEstimationAffordability(
        income,
        expenditure,
        model.config as ExpenditureEstimationModelConfig,
        interestRate,
        loanTermYears
      );

    default:
      // Fall back to standard affordability calculation
      return calculateMaxLoanAmount(
        income.primaryIncome + income.secondaryIncome + income.otherIncome,
        expenditure.housingCost +
          expenditure.utilitiesCost +
          expenditure.loanRepayments +
          expenditure.otherExpenses,
        interestRate,
        loanTermYears
      );
  }
}
