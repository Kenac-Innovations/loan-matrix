export const defaultLoanTerms = [3, 5, 7, 10];

export const defaultLoanProducts = [
  {
    id: "personal-loan",
    name: "Personal Loan",
    displayName: "Personal Loan",
    interestRate: 0.12, // 12%
    maxAmount: 500000,
    minAmount: 10000,
    maxTermMonths: 60,
    minTermMonths: 3,
  },
  {
    id: "business-loan",
    name: "Business Loan",
    displayName: "Business Loan",
    interestRate: 0.15, // 15%
    maxAmount: 2000000,
    minAmount: 50000,
    maxTermMonths: 84,
    minTermMonths: 6,
  },
  {
    id: "emergency-loan",
    name: "Emergency Loan",
    displayName: "Emergency Loan",
    interestRate: 0.18, // 18%
    maxAmount: 100000,
    minAmount: 5000,
    maxTermMonths: 24,
    minTermMonths: 1,
  },
];

export const defaultMobileMoneyProviders = [
  "EcoCash",
  "OneMoney",
  "Telecash",
  "NetOne",
];

export const defaultBranches = [
  "Harare CBD",
  "Bulawayo CBD", 
  "Mutare CBD",
  "Gweru Branch",
  "Kwekwe Branch",
];

export const defaultBanks = [
  "CBZ",
  "Stanbic",
  "FBC",
  "NMB",
  "ZB Bank",
];
