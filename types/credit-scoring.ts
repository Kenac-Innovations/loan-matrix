// Credit Scoring Types

export interface ScoringFactor {
  id: string;
  name: string;
  weight: number;
  minScore: number;
  maxScore: number;
  description: string;
}

export interface CreditScoreResult {
  totalScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendation: "Approve" | "Review" | "Decline";
  breakdown: ScoreBreakdown[];
}

export interface ScoreBreakdown {
  factor: string;
  contribution: number;
  score: number;
  weight: number;
}

export interface CreditScoringConfig {
  factors: ScoringFactor[];
  thresholds: {
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
  };
}

export const defaultScoringFactors: ScoringFactor[] = [
  {
    id: "credit-history",
    name: "Credit History",
    weight: 35,
    minScore: 300,
    maxScore: 850,
    description: "Payment history, defaults, and credit utilization patterns",
  },
  {
    id: "income-level",
    name: "Income Level",
    weight: 25,
    minScore: 0,
    maxScore: 100,
    description: "Annual income relative to loan amount and regional standards",
  },
  {
    id: "employment-status",
    name: "Employment Status",
    weight: 15,
    minScore: 0,
    maxScore: 100,
    description: "Employment stability, type, and tenure",
  },
  {
    id: "debt-to-income",
    name: "Debt-to-Income Ratio",
    weight: 15,
    minScore: 0,
    maxScore: 100,
    description: "Total monthly debt payments relative to gross monthly income",
  },
  {
    id: "age",
    name: "Age Factor",
    weight: 5,
    minScore: 0,
    maxScore: 100,
    description: "Borrower age and life stage considerations",
  },
  {
    id: "loan-amount",
    name: "Loan Amount",
    weight: 5,
    minScore: 0,
    maxScore: 100,
    description: "Requested loan amount relative to income and collateral",
  },
];

export const defaultThresholds = {
  lowRisk: 700,
  mediumRisk: 500,
  highRisk: 0,
}; 