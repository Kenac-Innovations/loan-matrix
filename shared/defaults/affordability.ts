export const defaultAffordabilityConfig = {
  interestRate: 0.07, // 7% default interest rate
  loanTermYears: 5, // 5 years default term
  debtToIncomeRatio: 0.36, // 36% maximum DTI ratio
  minimumLoanAmount: 50000, // Minimum loan amount for demonstration
  maxLoanAmount: 5000000, // Maximum loan amount
};

export const defaultLoanOffersConfig = {
  minOffers: 3,
  maxOffers: 5,
  interestRateRange: {
    min: 0.08, // 8%
    max: 0.25, // 25%
  },
  termRange: {
    min: 3, // 3 years
    max: 10, // 10 years
  },
};

export const defaultExpenditureRatios = {
  urban: {
    housing: 0.30,
    utilities: 0.10,
    transportation: 0.15,
    food: 0.25,
    other: 0.20,
  },
  rural: {
    housing: 0.20,
    utilities: 0.05,
    transportation: 0.10,
    food: 0.40,
    other: 0.25,
  },
};
