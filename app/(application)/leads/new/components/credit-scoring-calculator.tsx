"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calculator,
  TrendingUp,
  AlertCircle,
  Info,
  Shield,
  CreditCard,
  User,
  DollarSign,
  Building,
  Calendar,
  Target,
} from "lucide-react";

import { ScoringFactor, CreditScoreResult, ScoreBreakdown, defaultScoringFactors } from "@/types/credit-scoring";

interface CreditScoringCalculatorProps {
  onScoreCalculated?: (result: CreditScoreResult) => void;
  factors?: ScoringFactor[];
}

export function CreditScoringCalculator({
  onScoreCalculated,
  factors = defaultScoringFactors,
}: CreditScoringCalculatorProps) {
  const [formData, setFormData] = useState({
    creditHistory: 650,
    incomeLevel: 50000,
    employmentStatus: "full-time",
    debtToIncomeRatio: 0.3,
    age: 30,
    loanAmount: 200000,
  });

  // Calculate score function
  const calculateScore = (data: typeof formData): CreditScoreResult => {
    const breakdown: ScoreBreakdown[] = [];
    let totalScore = 0;

    factors.forEach((factor) => {
      let score = 0;
      let normalizedValue = 0;

      switch (factor.id) {
        case "credit-history":
          normalizedValue = Math.min(
            Math.max((data.creditHistory - 300) / (850 - 300), 0),
            1
          );
          break;
        case "income-level":
          normalizedValue = Math.min(data.incomeLevel / 100000, 1);
          break;
        case "employment-status":
          const employmentScores = {
            "full-time": 1,
            "part-time": 0.7,
            "self-employed": 0.6,
            unemployed: 0,
          };
          normalizedValue =
            employmentScores[
              data.employmentStatus as keyof typeof employmentScores
            ] || 0;
          break;
        case "debt-to-income":
          normalizedValue = Math.max(1 - data.debtToIncomeRatio, 0);
          break;
        case "age":
          normalizedValue = data.age >= 25 && data.age <= 65 ? 1 : 0.5;
          break;
        case "loan-amount":
          normalizedValue = data.loanAmount <= data.incomeLevel * 5 ? 1 : 0.5;
          break;
        default:
          normalizedValue = 0.5;
      }

      score =
        factor.minScore + normalizedValue * (factor.maxScore - factor.minScore);
      const contribution = (score * factor.weight) / 100;

      breakdown.push({
        factor: factor.name,
        contribution,
        score,
        weight: factor.weight,
      });

      totalScore += contribution;
    });

    const finalScore = Math.round(totalScore);
    const riskLevel: "Low" | "Medium" | "High" =
      finalScore >= 700 ? "Low" : finalScore >= 500 ? "Medium" : "High";
    const recommendation: "Approve" | "Review" | "Decline" =
      finalScore >= 700 ? "Approve" : finalScore >= 500 ? "Review" : "Decline";

    return { totalScore: finalScore, breakdown, riskLevel, recommendation };
  };

  // Real-time score calculation
  const currentScore = useMemo(
    () => calculateScore(formData),
    [formData, factors]
  );

  const getScoreColor = (score: number) => {
    if (score >= 700) return "text-green-600 dark:text-green-400";
    if (score >= 500) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 700) return "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800";
    if (score >= 500) return "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 dark:from-yellow-950/20 dark:to-amber-950/20 dark:border-yellow-800";
    return "bg-gradient-to-br from-red-50 to-rose-50 border-red-200 dark:from-red-950/20 dark:to-rose-950/20 dark:border-red-800";
  };

  const handleCalculate = () => {
    onScoreCalculated?.(currentScore);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-card-foreground">
            <Calculator className="w-5 h-5 text-primary-600" />
            Credit Scoring Calculator
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Evaluate client creditworthiness using comprehensive scoring factors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credit History */}
            <div className="space-y-3">
                                <Label className="text-sm font-medium text-foreground">
                    Credit History Score
                  </Label>
                              <Input
                  type="number"
                  value={formData.creditHistory}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      creditHistory: Number(e.target.value),
                    }))
                  }
                  min={300}
                  max={850}
                  className="h-10 border-border bg-background"
                />
                                 <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                     FICO credit score (300-850 range)
                   </p>
            </div>

            {/* Annual Income */}
            <div className="space-y-3">
                                <Label className="text-sm font-medium text-foreground">
                    Annual Income (USD)
                  </Label>
                              <Input
                  type="number"
                  value={formData.incomeLevel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      incomeLevel: Number(e.target.value),
                    }))
                  }
                  min={0}
                  className="h-10 border-border bg-background"
                />
            </div>

            {/* Employment Status */}
            <div className="space-y-3">
                                <Label className="text-sm font-medium text-foreground">
                    Employment Status
                  </Label>
                              <Select
                  value={formData.employmentStatus}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      employmentStatus: value,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 border-border bg-background">
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time Employment</SelectItem>
                  <SelectItem value="part-time">Part-time Employment</SelectItem>
                  <SelectItem value="self-employed">Self-employed</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Debt-to-Income Ratio */}
            <div className="space-y-3">
                                <Label className="text-sm font-medium text-foreground">
                    Debt-to-Income Ratio
                  </Label>
                              <Input
                  type="number"
                  step="0.01"
                  value={formData.debtToIncomeRatio}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      debtToIncomeRatio: Number(e.target.value),
                    }))
                  }
                  min={0}
                  max={1}
                  className="h-10 border-border bg-background"
                />
                                 <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                     As decimal (0.25 = 25%)
                   </p>
            </div>

            {/* Age */}
            <div className="space-y-3">
                                <Label className="text-sm font-medium text-foreground">Age</Label>
                              <Input
                  type="number"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      age: Number(e.target.value),
                    }))
                  }
                  min={18}
                  max={100}
                  className="h-10 border-border bg-background"
                />
            </div>

            {/* Loan Amount */}
            <div className="space-y-3">
                                <Label className="text-sm font-medium text-foreground">
                    Requested Loan Amount (USD)
                  </Label>
                              <Input
                  type="number"
                  value={formData.loanAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      loanAmount: Number(e.target.value),
                    }))
                  }
                  min={0}
                  className="h-10 border-border bg-background"
                />
            </div>
          </div>

          {/* Score Display */}
          <Card className={`border-2 ${getScoreBgColor(currentScore.totalScore)}`}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div
                  className={`text-5xl font-bold ${getScoreColor(
                    currentScore.totalScore
                  )} mb-2`}
                >
                  {currentScore.totalScore}
                </div>
                               <div className="text-lg font-semibold mb-4 text-muted-foreground dark:text-muted-foreground">
                 Credit Score
               </div>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Badge
                    variant={
                      currentScore.riskLevel === "Low"
                        ? "default"
                        : currentScore.riskLevel === "Medium"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-sm"
                  >
                    Risk Level: {currentScore.riskLevel}
                  </Badge>
                  <Badge
                    variant={
                      currentScore.recommendation === "Approve"
                        ? "default"
                        : currentScore.recommendation === "Review"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-sm"
                  >
                    {currentScore.recommendation}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
                <TrendingUp className="w-4 h-4 text-primary-600" />
                Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentScore.breakdown.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {item.factor}
                      </span>
                                           <span className="text-sm text-muted-foreground dark:text-muted-foreground">
                       {Math.round(item.contribution)} points ({item.weight}%)
                     </span>
                    </div>
                    <Progress
                      value={(item.contribution / currentScore.totalScore) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleCalculate}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-primary-foreground"
          >
            <Shield className="w-4 h-4 mr-2" />
            Calculate Credit Score
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 