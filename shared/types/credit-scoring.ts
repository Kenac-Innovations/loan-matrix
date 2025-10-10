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
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  breakdown: ScoreBreakdown[];
}

export enum RiskLevel {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export enum Recommendation {
  APPROVE = "Approve",
  REVIEW = "Review",
  DECLINE = "Decline",
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

// Defaults moved to shared/defaults/credit-scoring.ts
